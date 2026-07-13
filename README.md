# PLATEAU

食材マスタ・レシピ原価・棚卸(差異ロス)・廃棄記録・レジ締め記録(客単価)・ダッシュボードをまとめたWebアプリです。
データはSupabase(Postgres)に保存されるので、どのブラウザ・端末からアクセスしても同じデータを見られます。

## 1. ローカルで動かす

```bash
npm install
npm run dev
```

`http://localhost:5173` で開けます。`.env`にはすでにSupabaseへの接続情報が入っています。

## 2. 本番公開する(Vercelの例)

1. このフォルダをGitHubリポジトリにpushする
2. [vercel.com](https://vercel.com) でそのリポジトリを import する
3. 環境変数(Settings → Environment Variables)に以下を設定する
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   (値は同梱の`.env`を参照。GitHubには`.env`をコミットしないよう`.gitignore`済みです)
4. Deployを押すと、`https://自分のプロジェクト名.vercel.app` のようなURLが発行されます

Netlifyでもほぼ同じ手順(ビルドコマンド `npm run build`、公開フォルダ `dist`)で公開できます。

## 3. 今のセキュリティ状態(重要)

今回は素早く動かすことを優先し、**Supabaseの行レベルセキュリティ(RLS)を「誰でも読み書き可」に設定**しています。
つまり、この`anon key`とURLさえ知っていれば、ログイン不要で誰でもデータの閲覧・編集ができる状態です。

- 身内(オーナーとパートナー)だけで使う分には現状で問題ありません
- ただし、このURLや`.env`の中身を不用意に公開しないでください
- 本格的に外部へ共有したり、複数店舗・複数人での利用を想定する場合は、Supabase Authでログイン機能を追加し、RLSを「ログインuser_idが一致する行のみ」に絞る改修が必要です。その際は改めてご相談ください

## 4. レシートAI読み取りについて

現時点では手入力のみです(前回のClaudeアーティファクト版にあったAI画像読み取りは未実装)。
実装する場合は、APIキーをブラウザに置けないため、Supabase Edge Functionでサーバー側からAnthropic APIを呼ぶ構成が必要になります。必要になったら追加できます。

## テーブル構成(Supabaseプロジェクト: kaji-design's Project)

- `ingredients` 食材マスタ
- `menu_items` / `recipe_lines` メニューとレシピ
- `periods` / `period_ingredient_data` / `period_menu_sales` 棚卸期間ごとのデータ
- `waste_logs` 廃棄記録
- `receipt_logs` レジ締め記録(客単価計算用)
