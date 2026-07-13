import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from "recharts";
import {
  Package, ChefHat, ClipboardList, Trash2, BarChart3, Plus, Trash,
  Leaf, ChevronRight, AlertCircle, CheckCircle2, Receipt
} from "lucide-react";
import { supabase } from "./supabaseClient";

const C = {
  forest: "#1F4A34", leaf: "#3D7A5B", sage: "#A8C9AE", mossL: "#E4EEE3",
  ivory: "#F8F4E9", wood: "#8B6B4A", ink: "#24301F", gray: "#5F6B5A",
  white: "#FFFFFF", danger: "#B5533C",
};

const fmtYen = (n) => "¥" + Math.round(n || 0).toLocaleString("ja-JP");
const fmtNum = (n) => (Math.round((n || 0) * 100) / 100).toLocaleString("ja-JP");
const todayStr = () => new Date().toISOString().slice(0, 10);
const WASTE_REASONS = ["品質劣化", "仕込みミス", "期限切れ", "破損", "その他"];
const UNITS = ["g", "kg", "ml", "l", "個", "人前"];

function LeafDivider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "4px 0 14px" }}>
      <Leaf size={14} style={{ color: C.leaf }} />
      <div style={{ flex: 1, height: 1, background: C.sage, opacity: 0.6 }} />
    </div>
  );
}
function Card({ children, style }) {
  return <div style={{ background: C.white, border: `1px solid ${C.sage}55`, borderRadius: 16, padding: 18, boxShadow: "0 2px 10px rgba(31,74,52,0.06)", ...style }}>{children}</div>;
}
function Field({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: C.gray }}>
      <span>{label}</span>{children}
    </label>
  );
}
const inputStyle = { border: `1px solid ${C.sage}`, borderRadius: 10, padding: "8px 10px", fontSize: 14, color: C.ink, background: C.ivory, outline: "none" };
const btnPrimary = { background: C.forest, color: C.white, border: "none", borderRadius: 10, padding: "9px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 };
const btnGhost = { background: "transparent", color: C.danger, border: `1px solid ${C.danger}55`, borderRadius: 8, padding: "6px 10px", fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 };

function Badge({ children, tone = "sage" }) {
  const map = { sage: { bg: C.mossL, fg: C.forest }, danger: { bg: "#F6E4DF", fg: C.danger }, warn: { bg: "#FBF1D6", fg: "#8A6A1E" } };
  const s = map[tone];
  return <span style={{ background: s.bg, color: s.fg, borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{children}</span>;
}

// ==================== データ読み込み・組み立て ====================
async function loadAllData() {
  const [ing, menu, lines, per, pid, pms, waste, receipts] = await Promise.all([
    supabase.from("ingredients").select("*").order("created_at"),
    supabase.from("menu_items").select("*").order("created_at"),
    supabase.from("recipe_lines").select("*"),
    supabase.from("periods").select("*").order("created_at"),
    supabase.from("period_ingredient_data").select("*"),
    supabase.from("period_menu_sales").select("*"),
    supabase.from("waste_logs").select("*").order("created_at"),
    supabase.from("receipt_logs").select("*").order("log_date"),
  ]);
  for (const r of [ing, menu, lines, per, pid, pms, waste, receipts]) {
    if (r.error) throw r.error;
  }

  const ingredients = ing.data.map((r) => ({ id: r.id, name: r.name, unit: r.unit, unitCost: Number(r.unit_cost) }));
  const menuItems = menu.data.map((m) => ({
    id: m.id, name: m.name, price: Number(m.price),
    recipe: lines.data.filter((l) => l.menu_item_id === m.id).map((l) => ({ lineId: l.id, ingredientId: l.ingredient_id, qty: Number(l.qty) })),
  }));
  const periods = per.data.map((p) => {
    const opening = {}, purchases = {}, actual = {};
    pid.data.filter((x) => x.period_id === p.id).forEach((x) => {
      opening[x.ingredient_id] = Number(x.opening);
      purchases[x.ingredient_id] = Number(x.purchases);
      actual[x.ingredient_id] = x.actual === null ? undefined : Number(x.actual);
    });
    const salesQty = {};
    pms.data.filter((x) => x.period_id === p.id).forEach((x) => { salesQty[x.menu_item_id] = Number(x.qty); });
    return { id: p.id, name: p.name, startDate: p.start_date, endDate: p.end_date, closed: p.closed, opening, purchases, actual, salesQty };
  });
  const wasteLogs = waste.data.map((w) => ({ id: w.id, periodId: w.period_id, ingredientId: w.ingredient_id, qty: Number(w.qty), reason: w.reason, date: w.log_date }));
  const receiptLogs = receipts.data.map((r) => ({ id: r.id, date: r.log_date, salesTotal: Number(r.sales_total), customerCount: Number(r.customer_count), avgSpend: Number(r.sales_total) / Number(r.customer_count), note: r.note }));

  return { ingredients, menuItems, periods, wasteLogs, receiptLogs };
}

export default function App() {
  const [tab, setTab] = useState("ingredients");
  const [data, setData] = useState({ ingredients: [], menuItems: [], periods: [], wasteLogs: [], receiptLogs: [] });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const refresh = async () => {
    try {
      const fresh = await loadAllData();
      setData(fresh);
      setErrorMsg("");
    } catch (e) {
      console.error(e);
      setErrorMsg("データベースへの接続に失敗しました。.envの設定を確認してください。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const TABS = [
    { id: "ingredients", label: "食材マスタ", icon: Package },
    { id: "menu", label: "レシピ原価", icon: ChefHat },
    { id: "period", label: "棚卸入力", icon: ClipboardList },
    { id: "waste", label: "廃棄記録", icon: Trash2 },
    { id: "receipt", label: "レジ締め記録", icon: Receipt },
    { id: "dashboard", label: "ダッシュボード", icon: BarChart3 },
  ];

  return (
    <div style={{ fontFamily: "'Yu Gothic','Hiragino Sans',sans-serif", background: C.ivory, color: C.ink, minHeight: "100vh" }}>
      <div style={{ background: C.forest, color: C.white, padding: "18px 24px", display: "flex", alignItems: "center", gap: 10 }}>
        <Leaf size={22} style={{ color: C.sage }} />
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>PLATEAU</div>
          <div style={{ fontSize: 12, color: C.sage }}>棚卸・原価・ロス・客単価をひとつに</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, padding: "10px 16px", background: C.mossL, flexWrap: "wrap" }}>
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10,
              border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
              background: active ? C.forest : "transparent", color: active ? C.white : C.gray,
            }}>
              <Icon size={15} />{t.label}
            </button>
          );
        })}
      </div>

      <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>
        {errorMsg && <div style={{ color: C.danger, marginBottom: 16, display: "flex", gap: 6, alignItems: "center" }}><AlertCircle size={16} />{errorMsg}</div>}
        {loading ? (
          <div style={{ color: C.gray }}>読み込み中...</div>
        ) : (
          <>
            {tab === "ingredients" && <IngredientsTab data={data} refresh={refresh} />}
            {tab === "menu" && <MenuTab data={data} refresh={refresh} />}
            {tab === "period" && <PeriodTab data={data} refresh={refresh} />}
            {tab === "waste" && <WasteTab data={data} refresh={refresh} />}
            {tab === "receipt" && <ReceiptTab data={data} refresh={refresh} />}
            {tab === "dashboard" && <DashboardTab data={data} />}
          </>
        )}
      </div>
    </div>
  );
}

// ==================== 食材マスタ ====================
function IngredientsTab({ data, refresh }) {
  const [form, setForm] = useState({ name: "", unit: "g", unitCost: "" });
  const add = async () => {
    if (!form.name || !form.unitCost) return;
    await supabase.from("ingredients").insert({ name: form.name, unit: form.unit, unit_cost: parseFloat(form.unitCost) || 0 });
    setForm({ name: "", unit: "g", unitCost: "" });
    refresh();
  };
  const remove = async (id) => { await supabase.from("ingredients").delete().eq("id", id); refresh(); };

  return (
    <div>
      <Card style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 700, marginBottom: 8, color: C.forest }}>食材を追加</div>
        <LeafDivider />
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label="品目名"><input style={{ ...inputStyle, width: 180 }} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例: 豚バラ肉" /></Field>
          <Field label="単位">
            <select style={{ ...inputStyle, width: 90 }} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </Field>
          <Field label="仕入単価(円/単位)"><input type="number" style={{ ...inputStyle, width: 130 }} value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} placeholder="例: 12" /></Field>
          <button style={btnPrimary} onClick={add}><Plus size={15} /> 追加</button>
        </div>
      </Card>

      <Card>
        <div style={{ fontWeight: 700, marginBottom: 8, color: C.forest }}>食材一覧({data.ingredients.length}件)</div>
        <LeafDivider />
        {data.ingredients.length === 0 ? <div style={{ color: C.gray, fontSize: 13 }}>まだ食材が登録されていません。</div> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ color: C.gray, textAlign: "left" }}><th style={{ padding: 6 }}>品目名</th><th style={{ padding: 6 }}>単位</th><th style={{ padding: 6 }}>仕入単価</th><th></th></tr></thead>
            <tbody>
              {data.ingredients.map((i) => (
                <tr key={i.id} style={{ borderTop: `1px solid ${C.mossL}` }}>
                  <td style={{ padding: 6 }}>{i.name}</td>
                  <td style={{ padding: 6 }}>{i.unit}</td>
                  <td style={{ padding: 6 }}>{fmtYen(i.unitCost)} / {i.unit}</td>
                  <td style={{ padding: 6, textAlign: "right" }}><button style={btnGhost} onClick={() => remove(i.id)}><Trash size={13} /> 削除</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

// ==================== レシピ原価 ====================
function MenuTab({ data, refresh }) {
  const [form, setForm] = useState({ name: "", price: "" });
  const [selectedMenu, setSelectedMenu] = useState(null);
  const [lineForm, setLineForm] = useState({ ingredientId: "", qty: "" });

  const addMenu = async () => {
    if (!form.name || !form.price) return;
    const { data: inserted } = await supabase.from("menu_items").insert({ name: form.name, price: parseFloat(form.price) || 0 }).select().single();
    setForm({ name: "", price: "" });
    await refresh();
    if (inserted) setSelectedMenu(inserted.id);
  };
  const removeMenu = async (id) => { await supabase.from("menu_items").delete().eq("id", id); if (selectedMenu === id) setSelectedMenu(null); refresh(); };
  const addLine = async () => {
    if (!lineForm.ingredientId || !lineForm.qty || !selectedMenu) return;
    await supabase.from("recipe_lines").insert({ menu_item_id: selectedMenu, ingredient_id: lineForm.ingredientId, qty: parseFloat(lineForm.qty) || 0 });
    setLineForm({ ingredientId: "", qty: "" });
    refresh();
  };
  const removeLine = async (lineId) => { await supabase.from("recipe_lines").delete().eq("id", lineId); refresh(); };

  const ingMap = useMemo(() => { const m = {}; data.ingredients.forEach((i) => (m[i.id] = i)); return m; }, [data.ingredients]);
  const costOf = (menu) => menu.recipe.reduce((sum, r) => sum + (ingMap[r.ingredientId]?.unitCost || 0) * r.qty, 0);
  const current = data.menuItems.find((m) => m.id === selectedMenu);

  return (
    <div>
      <Card style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 700, marginBottom: 8, color: C.forest }}>メニューを追加</div>
        <LeafDivider />
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label="メニュー名"><input style={{ ...inputStyle, width: 200 }} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例: 生姜焼き定食" /></Field>
          <Field label="販売価格(円)"><input type="number" style={{ ...inputStyle, width: 130 }} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="例: 980" /></Field>
          <button style={btnPrimary} onClick={addMenu}><Plus size={15} /> 追加</button>
        </div>
      </Card>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
        <Card style={{ flex: "1 1 320px" }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: C.forest }}>メニュー一覧</div>
          <LeafDivider />
          {data.menuItems.length === 0 && <div style={{ color: C.gray, fontSize: 13 }}>メニューが登録されていません。</div>}
          {data.menuItems.map((m) => {
            const cost = costOf(m);
            const rate = m.price > 0 ? (cost / m.price) * 100 : 0;
            const tone = rate <= 30 ? "sage" : rate <= 35 ? "warn" : "danger";
            return (
              <div key={m.id} onClick={() => setSelectedMenu(m.id)} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 8px",
                borderRadius: 10, cursor: "pointer", background: selectedMenu === m.id ? C.mossL : "transparent", marginBottom: 4,
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: C.gray }}>価格 {fmtYen(m.price)} / 原価 {fmtYen(cost)}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Badge tone={tone}>原価率 {rate.toFixed(1)}%</Badge>
                  <button style={btnGhost} onClick={(e) => { e.stopPropagation(); removeMenu(m.id); }}><Trash size={13} /></button>
                  <ChevronRight size={15} style={{ color: C.gray }} />
                </div>
              </div>
            );
          })}
        </Card>

        <Card style={{ flex: "1 1 320px" }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: C.forest }}>{current ? `${current.name} のレシピ` : "メニューを選択してください"}</div>
          <LeafDivider />
          {current && (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                <Field label="食材">
                  <select style={{ ...inputStyle, width: 160 }} value={lineForm.ingredientId} onChange={(e) => setLineForm({ ...lineForm, ingredientId: e.target.value })}>
                    <option value="">選択</option>
                    {data.ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </Field>
                <Field label="使用量"><input type="number" style={{ ...inputStyle, width: 90 }} value={lineForm.qty} onChange={(e) => setLineForm({ ...lineForm, qty: e.target.value })} /></Field>
                <button style={btnPrimary} onClick={addLine}><Plus size={14} /> 追加</button>
              </div>
              {current.recipe.length === 0 ? <div style={{ color: C.gray, fontSize: 13 }}>レシピ行がありません。</div> : (
                <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                  <thead><tr style={{ color: C.gray, textAlign: "left" }}><th style={{ padding: 6 }}>食材</th><th style={{ padding: 6 }}>使用量</th><th style={{ padding: 6 }}>原価</th><th></th></tr></thead>
                  <tbody>
                    {current.recipe.map((r) => {
                      const ing = ingMap[r.ingredientId];
                      return (
                        <tr key={r.lineId} style={{ borderTop: `1px solid ${C.mossL}` }}>
                          <td style={{ padding: 6 }}>{ing?.name || "(削除済み)"}</td>
                          <td style={{ padding: 6 }}>{fmtNum(r.qty)} {ing?.unit}</td>
                          <td style={{ padding: 6 }}>{fmtYen((ing?.unitCost || 0) * r.qty)}</td>
                          <td style={{ padding: 6, textAlign: "right" }}><button style={btnGhost} onClick={() => removeLine(r.lineId)}><Trash size={13} /></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              <div style={{ marginTop: 10, fontSize: 13, color: C.forest, fontWeight: 700 }}>
                合計原価: {fmtYen(costOf(current))} / 原価率: {current.price > 0 ? ((costOf(current) / current.price) * 100).toFixed(1) : "0.0"}%
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

// ==================== 棚卸入力（期間） ====================
function computeTheoreticalUsage(period, menuItems) {
  const usage = {};
  menuItems.forEach((m) => {
    const soldQty = period.salesQty?.[m.id] || 0;
    if (!soldQty) return;
    m.recipe.forEach((r) => { usage[r.ingredientId] = (usage[r.ingredientId] || 0) + r.qty * soldQty; });
  });
  return usage;
}
function computeWasteByIngredient(periodId, wasteLogs) {
  const map = {};
  wasteLogs.filter((w) => w.periodId === periodId).forEach((w) => { map[w.ingredientId] = (map[w.ingredientId] || 0) + w.qty; });
  return map;
}

function PeriodTab({ data, refresh }) {
  const [selected, setSelected] = useState(data.periods[data.periods.length - 1]?.id || null);
  const [newName, setNewName] = useState("");

  useEffect(() => { if (!selected && data.periods.length > 0) setSelected(data.periods[data.periods.length - 1].id); }, [data.periods]);

  const createPeriod = async () => {
    const name = newName || `${new Date().getFullYear()}年${new Date().getMonth() + 1}月`;
    const prev = data.periods[data.periods.length - 1];
    const { data: inserted } = await supabase.from("periods").insert({ name, start_date: todayStr(), closed: false }).select().single();
    if (inserted && data.ingredients.length > 0) {
      const rows = data.ingredients.map((i) => ({ period_id: inserted.id, ingredient_id: i.id, opening: prev ? (prev.actual?.[i.id] ?? 0) : 0, purchases: 0, actual: null }));
      await supabase.from("period_ingredient_data").insert(rows);
    }
    setNewName("");
    await refresh();
    if (inserted) setSelected(inserted.id);
  };

  const period = data.periods.find((p) => p.id === selected);

  const setIngredientField = async (ingredientId, field, value) => {
    const num = parseFloat(value) || 0;
    await supabase.from("period_ingredient_data").upsert(
      { period_id: period.id, ingredient_id: ingredientId, [field]: num },
      { onConflict: "period_id,ingredient_id" }
    );
    refresh();
  };
  const setSalesQty = async (menuItemId, value) => {
    const num = parseFloat(value) || 0;
    await supabase.from("period_menu_sales").upsert(
      { period_id: period.id, menu_item_id: menuItemId, qty: num },
      { onConflict: "period_id,menu_item_id" }
    );
    refresh();
  };
  const closePeriod = async () => { await supabase.from("periods").update({ closed: true, end_date: todayStr() }).eq("id", period.id); refresh(); };

  const usage = period ? computeTheoreticalUsage(period, data.menuItems) : {};
  const wasteMap = period ? computeWasteByIngredient(period.id, data.wasteLogs) : {};

  return (
    <div>
      <Card style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <Field label="期間名(新規作成時)"><input style={{ ...inputStyle, width: 180 }} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="例: 2026年7月" /></Field>
          <button style={btnPrimary} onClick={createPeriod}><Plus size={15} /> 新しい棚卸期間を作成</button>
          <select style={{ ...inputStyle, width: 200 }} value={selected || ""} onChange={(e) => setSelected(e.target.value)}>
            <option value="">期間を選択</option>
            {data.periods.map((p) => <option key={p.id} value={p.id}>{p.name} {p.closed ? "(確定済)" : "(進行中)"}</option>)}
          </select>
        </div>
      </Card>

      {!period && <div style={{ color: C.gray, fontSize: 13 }}>棚卸期間を作成、または選択してください。</div>}

      {period && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: C.forest }}>{period.name}</div>
            {period.closed ? <Badge tone="sage"><CheckCircle2 size={12} style={{ verticalAlign: -2 }} /> 確定済み</Badge> : <Badge tone="warn">進行中</Badge>}
          </div>

          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 8, color: C.forest }}>売上数量(メニュー別・期間合計)</div>
            <LeafDivider />
            {data.menuItems.length === 0 ? <div style={{ color: C.gray, fontSize: 13 }}>メニューが未登録です。先にレシピ原価タブで登録してください。</div> : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px,1fr))", gap: 10 }}>
                {data.menuItems.map((m) => (
                  <Field key={m.id} label={m.name}>
                    <input type="number" disabled={period.closed} style={inputStyle} defaultValue={period.salesQty?.[m.id] ?? ""} onBlur={(e) => setSalesQty(m.id, e.target.value)} placeholder="販売数" />
                  </Field>
                ))}
              </div>
            )}
          </Card>

          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 8, color: C.forest }}>食材別 仕入数量・実棚卸数量</div>
            <LeafDivider />
            {data.ingredients.length === 0 ? <div style={{ color: C.gray, fontSize: 13 }}>食材が未登録です。先に食材マスタタブで登録してください。</div> : (
              <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: C.gray, textAlign: "left" }}>
                    <th style={{ padding: 6 }}>食材</th><th style={{ padding: 6 }}>期首在庫</th><th style={{ padding: 6 }}>仕入数量</th>
                    <th style={{ padding: 6 }}>理論使用量</th><th style={{ padding: 6 }}>廃棄数量</th><th style={{ padding: 6 }}>理論期末在庫</th>
                    <th style={{ padding: 6 }}>実棚卸数量</th><th style={{ padding: 6 }}>差異ロス</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ingredients.map((i) => {
                    const opening = period.opening?.[i.id] || 0;
                    const purchase = period.purchases?.[i.id] || 0;
                    const used = usage[i.id] || 0;
                    const waste = wasteMap[i.id] || 0;
                    const theoretical = opening + purchase - used - waste;
                    const actual = period.actual?.[i.id];
                    const diff = actual !== undefined ? theoretical - actual : null;
                    const diffCost = diff !== null ? diff * i.unitCost : null;
                    return (
                      <tr key={i.id} style={{ borderTop: `1px solid ${C.mossL}` }}>
                        <td style={{ padding: 6, fontWeight: 600 }}>{i.name}</td>
                        <td style={{ padding: 6 }}>{fmtNum(opening)} {i.unit}</td>
                        <td style={{ padding: 6 }}><input type="number" disabled={period.closed} style={{ ...inputStyle, width: 80, padding: "5px 8px" }} defaultValue={period.purchases?.[i.id] ?? ""} onBlur={(e) => setIngredientField(i.id, "purchases", e.target.value)} /></td>
                        <td style={{ padding: 6, color: C.gray }}>{fmtNum(used)} {i.unit}</td>
                        <td style={{ padding: 6, color: C.gray }}>{fmtNum(waste)} {i.unit}</td>
                        <td style={{ padding: 6, fontWeight: 600 }}>{fmtNum(theoretical)} {i.unit}</td>
                        <td style={{ padding: 6 }}><input type="number" disabled={period.closed} style={{ ...inputStyle, width: 80, padding: "5px 8px" }} defaultValue={period.actual?.[i.id] ?? ""} onBlur={(e) => setIngredientField(i.id, "actual", e.target.value)} /></td>
                        <td style={{ padding: 6 }}>
                          {diff === null ? <span style={{ color: C.gray }}>未入力</span> : diff > 0 ? <Badge tone="danger">{fmtNum(diff)} {i.unit} / {fmtYen(diffCost)}</Badge> : <Badge tone="sage">{fmtNum(diff)} {i.unit} / {fmtYen(diffCost)}</Badge>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>

          {!period.closed && <button style={btnPrimary} onClick={closePeriod}><CheckCircle2 size={15} /> この期間を確定して次期へ繰越</button>}
        </>
      )}
    </div>
  );
}

// ==================== 廃棄記録 ====================
function WasteTab({ data, refresh }) {
  const [form, setForm] = useState({ periodId: data.periods.find((p) => !p.closed)?.id || "", ingredientId: "", qty: "", reason: WASTE_REASONS[0], date: todayStr() });

  useEffect(() => { const open = data.periods.find((p) => !p.closed); if (open && !form.periodId) setForm((f) => ({ ...f, periodId: open.id })); }, [data.periods]);

  const ingMap = useMemo(() => { const m = {}; data.ingredients.forEach((i) => (m[i.id] = i)); return m; }, [data.ingredients]);

  const add = async () => {
    if (!form.periodId || !form.ingredientId || !form.qty) return;
    await supabase.from("waste_logs").insert({ period_id: form.periodId, ingredient_id: form.ingredientId, qty: parseFloat(form.qty) || 0, reason: form.reason, log_date: form.date });
    setForm({ ...form, ingredientId: "", qty: "" });
    refresh();
  };
  const remove = async (id) => { await supabase.from("waste_logs").delete().eq("id", id); refresh(); };
  const periodName = (id) => data.periods.find((p) => p.id === id)?.name || "-";

  return (
    <div>
      <Card style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 700, marginBottom: 8, color: C.forest }}>廃棄を記録</div>
        <LeafDivider />
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label="対象期間">
            <select style={{ ...inputStyle, width: 160 }} value={form.periodId} onChange={(e) => setForm({ ...form, periodId: e.target.value })}>
              <option value="">選択</option>
              {data.periods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="食材">
            <select style={{ ...inputStyle, width: 160 }} value={form.ingredientId} onChange={(e) => setForm({ ...form, ingredientId: e.target.value })}>
              <option value="">選択</option>
              {data.ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </Field>
          <Field label="数量"><input type="number" style={{ ...inputStyle, width: 90 }} value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></Field>
          <Field label="理由">
            <select style={{ ...inputStyle, width: 130 }} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
              {WASTE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="日付"><input type="date" style={{ ...inputStyle, width: 140 }} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <button style={btnPrimary} onClick={add}><Plus size={15} /> 記録</button>
        </div>
      </Card>

      <Card>
        <div style={{ fontWeight: 700, marginBottom: 8, color: C.forest }}>廃棄ログ({data.wasteLogs.length}件)</div>
        <LeafDivider />
        {data.wasteLogs.length === 0 ? <div style={{ color: C.gray, fontSize: 13 }}>記録がありません。</div> : (
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead><tr style={{ color: C.gray, textAlign: "left" }}><th style={{ padding: 6 }}>日付</th><th style={{ padding: 6 }}>期間</th><th style={{ padding: 6 }}>食材</th><th style={{ padding: 6 }}>数量</th><th style={{ padding: 6 }}>金額</th><th style={{ padding: 6 }}>理由</th><th></th></tr></thead>
            <tbody>
              {[...data.wasteLogs].reverse().map((w) => {
                const ing = ingMap[w.ingredientId];
                return (
                  <tr key={w.id} style={{ borderTop: `1px solid ${C.mossL}` }}>
                    <td style={{ padding: 6 }}>{w.date}</td>
                    <td style={{ padding: 6 }}>{periodName(w.periodId)}</td>
                    <td style={{ padding: 6 }}>{ing?.name || "(削除済み)"}</td>
                    <td style={{ padding: 6 }}>{fmtNum(w.qty)} {ing?.unit}</td>
                    <td style={{ padding: 6 }}>{fmtYen((ing?.unitCost || 0) * w.qty)}</td>
                    <td style={{ padding: 6 }}><Badge tone="warn">{w.reason}</Badge></td>
                    <td style={{ padding: 6, textAlign: "right" }}><button style={btnGhost} onClick={() => remove(w.id)}><Trash size={13} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

// ==================== レジ締め記録(レシート風デザイン) ====================
function ReceiptPreview({ date, salesTotal, customerCount, note }) {
  const sales = parseFloat(salesTotal) || 0;
  const count = parseFloat(customerCount) || 0;
  const avg = count > 0 ? sales / count : 0;
  const zigzag = "polygon(0% 0%,100% 0%,100% 100%,97% 94%,94% 100%,91% 94%,88% 100%,85% 94%,82% 100%,79% 94%,76% 100%,73% 94%,70% 100%,67% 94%,64% 100%,61% 94%,58% 100%,55% 94%,52% 100%,49% 94%,46% 100%,43% 94%,40% 100%,37% 94%,34% 100%,31% 94%,28% 100%,25% 94%,22% 100%,19% 94%,16% 100%,13% 94%,10% 100%,7% 94%,4% 100%,1% 94%,0% 100%)";
  return (
    <div style={{
      background: C.white, width: 260, margin: "0 auto", padding: "22px 20px 34px",
      fontFamily: "'Courier New', monospace", color: C.ink, fontSize: 13,
      boxShadow: "0 6px 16px rgba(31,74,52,0.12)", clipPath: zigzag,
    }}>
      <div style={{ textAlign: "center", fontWeight: 700, letterSpacing: 2, marginBottom: 4 }}>
        <Receipt size={16} style={{ verticalAlign: -3, marginRight: 4, color: C.leaf }} />
        RECEIPT
      </div>
      <div style={{ textAlign: "center", color: C.gray, fontSize: 11, marginBottom: 12 }}>{date || todayStr()}</div>
      <div style={{ borderTop: `1px dashed ${C.wood}`, margin: "8px 0" }} />
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span>売上合計</span><span>{fmtYen(sales)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span>客数</span><span>{count || 0}人</span>
      </div>
      <div style={{ borderTop: `1px dashed ${C.wood}`, margin: "8px 0" }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
        <span>客単価</span><span>{fmtYen(avg)}</span>
      </div>
      {note && <div style={{ marginTop: 10, fontSize: 11, color: C.gray }}>memo: {note}</div>}
      <div style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: C.gray }}>* * * THANK YOU * * *</div>
    </div>
  );
}

function ReceiptTab({ data, refresh }) {
  const [form, setForm] = useState({ date: todayStr(), salesTotal: "", customerCount: "", note: "" });

  const add = async () => {
    const sales = parseFloat(form.salesTotal);
    const count = parseFloat(form.customerCount);
    if (!sales || !count) return;
    await supabase.from("receipt_logs").insert({ log_date: form.date, sales_total: sales, customer_count: count, note: form.note });
    setForm({ date: todayStr(), salesTotal: "", customerCount: "", note: "" });
    refresh();
  };
  const remove = async (id) => { await supabase.from("receipt_logs").delete().eq("id", id); refresh(); };

  return (
    <div>
      <Card style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 700, marginBottom: 10, color: C.forest, display: "flex", alignItems: "center", gap: 6 }}>
          <Receipt size={16} /> レジ締め結果を記録
        </div>
        <LeafDivider />
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 300, flex: "1 1 260px" }}>
            <label style={{ fontSize: 13, color: C.gray }}>日付<input type="date" style={{ ...inputStyle, width: "100%", marginTop: 4 }} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
            <label style={{ fontSize: 13, color: C.gray }}>合計売上金額(円)<input type="number" style={{ ...inputStyle, width: "100%", marginTop: 4 }} value={form.salesTotal} onChange={(e) => setForm({ ...form, salesTotal: e.target.value })} /></label>
            <label style={{ fontSize: 13, color: C.gray }}>客数(取引件数)<input type="number" style={{ ...inputStyle, width: "100%", marginTop: 4 }} value={form.customerCount} onChange={(e) => setForm({ ...form, customerCount: e.target.value })} /></label>
            <label style={{ fontSize: 13, color: C.gray }}>メモ(任意)<input style={{ ...inputStyle, width: "100%", marginTop: 4 }} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
            <button style={btnPrimary} onClick={add}><Plus size={15} /> 記録する</button>
            <div style={{ fontSize: 12, color: C.gray }}>
              ※ レシートのAI自動読み取りは今後の拡張予定です。今はここに手入力してください。
            </div>
          </div>
          <div style={{ flex: "0 0 260px" }}>
            <ReceiptPreview date={form.date} salesTotal={form.salesTotal} customerCount={form.customerCount} note={form.note} />
          </div>
        </div>
      </Card>


      <Card>
        <div style={{ fontWeight: 700, marginBottom: 8, color: C.forest }}>記録一覧({data.receiptLogs.length}件)</div>
        <LeafDivider />
        {data.receiptLogs.length === 0 ? <div style={{ color: C.gray, fontSize: 13 }}>まだ記録がありません。</div> : (
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead><tr style={{ color: C.gray, textAlign: "left" }}><th style={{ padding: 6 }}>日付</th><th style={{ padding: 6 }}>売上高</th><th style={{ padding: 6 }}>客数</th><th style={{ padding: 6 }}>客単価</th><th></th></tr></thead>
            <tbody>
              {[...data.receiptLogs].reverse().map((l) => (
                <tr key={l.id} style={{ borderTop: `1px solid ${C.mossL}` }}>
                  <td style={{ padding: 6 }}>{l.date}</td>
                  <td style={{ padding: 6 }}>{fmtYen(l.salesTotal)}</td>
                  <td style={{ padding: 6 }}>{l.customerCount}人</td>
                  <td style={{ padding: 6, fontWeight: 600 }}>{fmtYen(l.avgSpend)}</td>
                  <td style={{ padding: 6, textAlign: "right" }}><button style={btnGhost} onClick={() => remove(l.id)}><Trash size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
// ==================== ダッシュボード ====================
function DashboardTab({ data }) {
  const [periodId, setPeriodId] = useState(data.periods[data.periods.length - 1]?.id || "");
  useEffect(() => { if (!periodId && data.periods.length > 0) setPeriodId(data.periods[data.periods.length - 1].id); }, [data.periods]);

  const period = data.periods.find((p) => p.id === periodId);
  const ingMap = useMemo(() => { const m = {}; data.ingredients.forEach((i) => (m[i.id] = i)); return m; }, [data.ingredients]);

  const periodReceipts = period ? data.receiptLogs.filter((l) => l.date >= period.startDate && (!period.endDate || l.date <= period.endDate)) : data.receiptLogs;
  const totalReceiptSales = periodReceipts.reduce((s, l) => s + l.salesTotal, 0);
  const totalReceiptCustomers = periodReceipts.reduce((s, l) => s + l.customerCount, 0);
  const avgSpend = totalReceiptCustomers > 0 ? totalReceiptSales / totalReceiptCustomers : 0;
  const chartData = [...data.receiptLogs].slice(-14).map((l) => ({ date: l.date.slice(5), 客単価: Math.round(l.avgSpend) }));

  if (!period) return <div style={{ color: C.gray, fontSize: 13 }}>棚卸期間を作成すると、ここに分析が表示されます。</div>;

  const usage = computeTheoreticalUsage(period, data.menuItems);
  const wasteMap = computeWasteByIngredient(period.id, data.wasteLogs);

  let revenue = 0;
  data.menuItems.forEach((m) => { revenue += (period.salesQty?.[m.id] || 0) * m.price; });

  let theoreticalCost = 0, diffLossCost = 0, wasteLossCost = 0;
  const perIngredient = [];
  data.ingredients.forEach((i) => {
    const opening = period.opening?.[i.id] || 0;
    const purchase = period.purchases?.[i.id] || 0;
    const used = usage[i.id] || 0;
    const waste = wasteMap[i.id] || 0;
    const theoretical = opening + purchase - used - waste;
    const actual = period.actual?.[i.id];
    const diff = actual !== undefined ? theoretical - actual : 0;
    const diffCost = diff * i.unitCost;
    const wCost = waste * i.unitCost;
    theoreticalCost += used * i.unitCost;
    diffLossCost += diffCost;
    wasteLossCost += wCost;
    if (diffCost !== 0 || wCost !== 0) perIngredient.push({ name: i.name, 差異ロス: Math.round(diffCost), 廃棄ロス: Math.round(wCost) });
  });

  const totalLoss = diffLossCost + wasteLossCost;
  const costRate = revenue > 0 ? (theoreticalCost / revenue) * 100 : 0;
  const lossRate = revenue > 0 ? (totalLoss / revenue) * 100 : 0;

  const wasteReasonAgg = {};
  data.wasteLogs.filter((w) => w.periodId === period.id).forEach((w) => {
    const cost = (ingMap[w.ingredientId]?.unitCost || 0) * w.qty;
    wasteReasonAgg[w.reason] = (wasteReasonAgg[w.reason] || 0) + cost;
  });
  const pieData = Object.entries(wasteReasonAgg).map(([reason, value]) => ({ name: reason, value: Math.round(value) }));
  const pieColors = [C.forest, C.leaf, C.sage, C.wood, "#8AA9C9", C.danger];
  const barData = perIngredient.sort((a, b) => (b.差異ロス + b.廃棄ロス) - (a.差異ロス + a.廃棄ロス)).slice(0, 8);

  const menuRows = data.menuItems.map((m) => {
    const cost = m.recipe.reduce((s, r) => s + (ingMap[r.ingredientId]?.unitCost || 0) * r.qty, 0);
    const rate = m.price > 0 ? (cost / m.price) * 100 : 0;
    return { ...m, cost, rate, sold: period.salesQty?.[m.id] || 0 };
  });

  const StatCard = ({ label, value, tone }) => (
    <Card style={{ flex: "1 1 150px", textAlign: "center" }}>
      <div style={{ fontSize: 12, color: C.gray, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: tone || C.forest }}>{value}</div>
    </Card>
  );

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <Field label="対象期間">
          <select style={{ ...inputStyle, width: 220 }} value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
            {data.periods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <StatCard label="レジ実績売上高" value={fmtYen(totalReceiptSales)} />
        <StatCard label="客単価" value={fmtYen(avgSpend)} />
        <StatCard label="理論原価" value={fmtYen(theoreticalCost)} />
        <StatCard label="原価率" value={costRate.toFixed(1) + "%"} tone={costRate > 32 ? C.danger : C.forest} />
        <StatCard label="差異ロス" value={fmtYen(diffLossCost)} tone={diffLossCost > 0 ? C.danger : C.forest} />
        <StatCard label="廃棄ロス" value={fmtYen(wasteLossCost)} tone={wasteLossCost > 0 ? C.danger : C.forest} />
        <StatCard label="総ロス率" value={lossRate.toFixed(1) + "%"} tone={C.danger} />
      </div>

      <Card style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 700, marginBottom: 8, color: C.forest }}>客単価の推移(直近14件のレジ締め記録)</div>
        <LeafDivider />
        {chartData.length === 0 ? <div style={{ color: C.gray, fontSize: 13 }}>レジ締め記録タブでデータを入れると表示されます。</div> : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.mossL} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => fmtYen(v)} />
              <Line type="monotone" dataKey="客単価" stroke={C.forest} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 18 }}>
        <Card style={{ flex: "1 1 400px" }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: C.forest }}>食材別ロス金額(上位8件)</div>
          <LeafDivider />
          {barData.length === 0 ? <div style={{ color: C.gray, fontSize: 13 }}>データがありません。</div> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.mossL} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => fmtYen(v)} />
                <Legend />
                <Bar dataKey="差異ロス" stackId="a" fill={C.danger} radius={[0, 4, 4, 0]} />
                <Bar dataKey="廃棄ロス" stackId="a" fill={C.wood} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card style={{ flex: "1 1 300px" }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: C.forest }}>廃棄理由別 金額内訳</div>
          <LeafDivider />
          {pieData.length === 0 ? <div style={{ color: C.gray, fontSize: 13 }}>廃棄記録がありません。</div> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} label>
                  {pieData.map((_, idx) => <Cell key={idx} fill={pieColors[idx % pieColors.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => fmtYen(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card>
        <div style={{ fontWeight: 700, marginBottom: 8, color: C.forest }}>メニュー別 原価率</div>
        <LeafDivider />
        {menuRows.length === 0 ? <div style={{ color: C.gray, fontSize: 13 }}>メニューが登録されていません。</div> : (
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead><tr style={{ color: C.gray, textAlign: "left" }}><th style={{ padding: 6 }}>メニュー</th><th style={{ padding: 6 }}>販売数</th><th style={{ padding: 6 }}>価格</th><th style={{ padding: 6 }}>原価</th><th style={{ padding: 6 }}>原価率</th></tr></thead>
            <tbody>
              {menuRows.map((m) => (
                <tr key={m.id} style={{ borderTop: `1px solid ${C.mossL}` }}>
                  <td style={{ padding: 6, fontWeight: 600 }}>{m.name}</td>
                  <td style={{ padding: 6 }}>{m.sold}</td>
                  <td style={{ padding: 6 }}>{fmtYen(m.price)}</td>
                  <td style={{ padding: 6 }}>{fmtYen(m.cost)}</td>
                  <td style={{ padding: 6 }}><Badge tone={m.rate <= 30 ? "sage" : m.rate <= 35 ? "warn" : "danger"}>{m.rate.toFixed(1)}%</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {(diffLossCost > 0 || wasteLossCost > 0) && (
        <div style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "center", color: C.danger, fontSize: 13 }}>
          <AlertCircle size={15} />
          このロス金額はデータ入力(仕入・売上・実棚卸・廃棄)に基づく試算です。入力精度がそのまま結果の精度になります。
        </div>
      )}
    </div>
  );
}
