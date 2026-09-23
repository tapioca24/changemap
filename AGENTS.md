# Repository Guidelines

## プロジェクト構成

changemap は Git の変更と TypeScript のファイル依存関係を可視化する CLI です。
`src/git/` が差分・スナップショット取得、`src/analysis/` が依存解析、`src/graph/` がグラフ統合・選択を担当します。
`src/review/` はレビューセッション、`src/server/` はローカル HTTP サーバー、`src/cli/` は起動処理です。
React UI と CSS・HTML は `src/ui/`、共有型は `src/shared/`、設定処理は `src/config/` に置きます。
テストは `tests/`、共通ヘルパーは `tests/helpers/`、検証スクリプトは `scripts/`、設計資料は `docs/`、タスクは `backlog/` にあります。`dist/` は生成物です。

## 開発・ビルドコマンド

Node.js `>=24.11.0 <25`、pnpm `10.33.0`、Git を使用します。

- `pnpm install --frozen-lockfile`: ロックファイルどおりに依存関係を導入します。
- `pnpm build`: tsdown と Vite で CLI・UI を `dist/` に生成します。
- `node dist/cli.mjs . --no-open`: HEAD と作業ツリーを比較し、閲覧 URL を表示します。
- `pnpm test`: ビルド後に Vitest の全テストを実行します。
- `pnpm typecheck`: TypeScript の型検査を行います。
- `pnpm lint`: Oxlint で警告もエラーとして検査します。
- `pnpm format` / `pnpm format:check`: Oxfmt による整形／整形確認です。
- `pnpm test:pack`: 配布 tarball を隔離環境に導入して検証します。レジストリアクセスが必要です。
- `pnpm benchmark:layout 1000`: 1,000 ノードのレイアウトを検証します。

## コーディング規約

TypeScript の strict モードと ESM を使用します。既存コードに合わせ、インデントは 2 スペース、文字列はダブルクォート、文末にはセミコロンを付け、Oxfmt を適用してください。
関数・変数は camelCase、型・React コンポーネントは PascalCase、複合語のファイル名は `code-pane.tsx` のような kebab-case にします。
相対 import は `.js` 拡張子を使い、型のみの import は `import type` で記述します。

## テスト方針

`tests/**/*.test.ts` を Vitest で実行します。通常は Node 環境、React の振る舞いは jsdom と Testing Library で検証します。
対象を絞る場合は、ビルド後に `pnpm exec vitest run tests/graph.test.ts` を実行してください。
数値のカバレッジ閾値は未設定です。振る舞いの変更には回帰テストを追加し、Git 操作には一時リポジトリのヘルパーを利用します。
CI は Linux・macOS・Windows と Node.js の最小対応版・最新 24.x を検証します。

## コミット・Pull Request

履歴に合わせて Conventional Commits を使用し、説明は日本語で書きます。例: `feat(graph): リネーム対応のグラフ差分を実装`。
PR には変更の目的、変更後の振る舞い、関連 Issue、実行した検証を記載してください。UI の変更にはスクリーンショットを添えます。
提出前に型検査・lint・整形確認・テスト・レイアウト検証・配布検証を実行し、失敗や未実施事項を明記してください。

## アーキテクチャとエージェント向け指示

比較対象リポジトリは読み取り専用に保ちます。依存解析は取得済みスナップショット内に限定し、外部ファイルやインストール済み依存関係を読み込まないでください。
応答は日本語とし、`npm` / `npx` より `pnpm` / `pnpm dlx` を優先します。
