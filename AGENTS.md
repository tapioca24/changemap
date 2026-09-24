# Repository Guidelines

## プロジェクト構成

changemap は Git の変更と TypeScript のファイル依存関係を可視化する CLI です。
`src/git/` が差分・スナップショット取得、`src/analysis/` が依存解析、`src/graph/` がグラフ統合・選択を担当します。
`src/review/` はレビューセッション、`src/server/` はローカル HTTP サーバー、`src/cli/` は起動処理です。
React UI と CSS・HTML は `src/ui/`、共有型は `src/shared/`、設定処理は `src/config/` に置きます。
テストは `tests/`、共通ヘルパーは `tests/helpers/`、検証スクリプトは `scripts/`、設計・利用・測定資料は `backlog/docs/`、タスクは `backlog/tasks/`、未合意の候補は `backlog/drafts/` にあります。`dist/` は生成物です。

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

## Backlog.md の概要（CLI）

このプロジェクトでは、Backlog.md を使って機能追加・バグ修正・計画的な作業をタスクとして管理します。

### Backlog を使うタイミング

計画・意思決定・引き継ぎメモが必要な作業は、タスクを作成してください。

「どう進めるかを考える必要があるか？」を判断基準にします。

- はい: まず既存タスクを検索し、必要に応じて新規作成します。
- いいえ: 小さな機械的変更は、そのまま実施します。

調査が必要なバグ修正、機能追加、API 変更、リファクタリングなど、実施する作業としてレビューすべきものはタスク化します。質問への回答、説明、簡単な調べ物、明らかな機械的編集ではタスク作成を省略します。

### 各依頼で最初に確認すること

この概要を使って、次に読むガイドや実行するコマンドを判断してください。

変更前に、既存タスクを検索して内容を確認します。

- `backlog search "query" --plain`
- `backlog task list --status "<todo status>" --plain`
- `backlog task list --status "<active status>" --plain`
- `backlog task list --search "login" --labels frontend,bug --limit 20 --plain`
- `backlog task view TASK-123 --plain`

スクリプトでバージョン管理された安定したフィールドが必要な場合は、`task list`、`task view`、`task <id>`、`search` で `--plain` の代わりに `--json` を使います。両方のフラグを同時に指定しないでください。

### 詳細ガイド

**必須: タスクの作成・実行・完了処理の前に、以下の該当ガイドを読んでください。これらの操作を、この概要だけに基づいて進めないでください。** この概要は操作のタイミングを示し、詳細ガイドは必要な手順を定めています。省略するとタスクやメタデータに不整合が生じます。

- `backlog instructions task-creation`: タスク作成前に読みます。検索・スコープの設定・作成方法を説明します。
- `backlog instructions task-execution`: 作業の計画や更新前に読みます。計画・更新・実行の進め方を説明します。
- `backlog instructions task-finalization`: タスク完了前に読みます。検証・要約・完了処理を説明します。

不慣れな操作の前には `backlog <command> --help` を確認してください。ヘルプには入力項目、読み取り・書き込みの動作、出力形式、使用例が記載されています。

### 基本原則

Backlog は、何を構築・修正・変更するかという、実施を決めた作業を管理します。メタデータ、ファイル名、関連付け、履歴の整合性を保つため、Backlog の変更には CLI を使ってください。

重要: Backlog のタスク・下書き・ドキュメント・意思決定・マイルストーンの Markdown ファイルを直接編集しないでください。自動生成されるメタデータを完全に保つため、Backlog コマンドを使用してください。
