# 棋譜帖

KIF ファイルを取り込み、将棋盤で再生・振り返りできる棋譜管理アプリです。Next.js、PostgreSQL（Supabase）、Supabase Auth を使い、Vercel へデプロイできる構成です。

## 主な機能

- KIF / KIFU ファイルの取り込み（UTF-8 / Shift_JIS、1件 2 MB まで）
- 棋譜の盤面表示、自動再生、速度変更、一手移動、盤面反転
- 駒の移動アニメーション、持ち駒、駒打ち、成り、主要な駒落ち
- 棋譜の検索、タグ付け、メモ、ブックマーク
- 元の KIF ファイルを保持したままエクスポート
- Supabase のメールリンク認証と、ユーザーごとのクラウド保存
- Supabase 未設定時はブラウザーの Local Storage で利用可能

## ローカル起動

Node.js 20.9 以降が必要です。

```bash
npm install
npm run dev
```

`http://localhost:3000` を開きます。Supabase を設定しなくても、サンプル棋譜とブラウザー保存を利用できます。

## Supabase の設定

1. Supabase でプロジェクトを作成します。
2. SQL Editor で `supabase/migrations/001_games.sql` を実行します。テーブル、インデックス、RLS ポリシーが作成されます。
3. `.env.example` を `.env.local` にコピーし、Project Settings の API 設定にある URL と publishable key（または anon key）を設定します。
4. Authentication の URL Configuration で Site URL と Redirect URLs にローカル URL、本番の Vercel URLを登録します。

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

ブラウザー保存の棋譜は、ログイン後に「使い方・保存について」からクラウドへコピーできます。

## Vercel へのデプロイ

リポジトリを Vercel に接続し、上記2つの環境変数を Project Settings に設定してデプロイします。Supabase 側の Redirect URLs に発行された Vercel URL を追加してください。

## 検証

```bash
npm test
npm run typecheck
npm run build
npx playwright test
```

局面図から開始する棋譜と KI2 形式には未対応です。分岐を含む KIF は本譜だけを再生しますが、元の KIF はそのまま保持してエクスポートします。アプリ内のメモとタグは KIF 本文には書き込みません。
