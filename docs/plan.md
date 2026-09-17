# フェーズ0：プロジェクト基盤

状態：フェーズ0の実装とmacOSでのローカル検証は完了。3 OS × Node.js 2バージョンのCI実行確認待ち。全受け入れ条件の完了とはまだ扱わない。

全体計画は [roadmap.md](roadmap.md)、製品仕様は [design.md](design.md)、引き継ぎは [handoff.md](handoff.md) を参照する。このファイルはフェーズ0だけを扱う。

## 目的と既定の範囲

クリーンなチェックアウトからpnpmで導入・ビルドし、`changemap` コマンドを実行できる開発基盤を整える。

- Backlog.mdの初期化と最初のマイルストーンの登録。
- pnpm・TypeScriptのプロジェクト構成とnpmパッケージ `changemap` のメタデータ。
- Node.js対応範囲、ビルド成果物、実行コマンド名、ローカルサーバーの起動・終了方針。
- 英語READMEの導入方法とCLI利用例。未実装機能は区別する。
- test、typecheck、lint、format、buildコマンド。

## 合意済みの判断

フェーズ0のCLIは `--help` と `--version` を実行できるところまでとする。サーバーの起動・終了方針は文書化し、サーバーとReact画面の実装はフェーズ1で行う。ユーザー承認済み。

全体計画を `docs/roadmap.md`、フェーズ0専用計画を `docs/plan.md` とする配置を維持する。ユーザー承認済み。

配布単位は単一のnpmパッケージ `changemap` とし、CLI・サーバー・UIは同じパッケージ内のディレクトリで分ける。複数パッケージのワークスペース化は必要が生じた段階で検討する。フェーズ0ではCLIの基盤を作り、サーバー・UIの実装は追加しない。ユーザー承認済み。

ローカルサーバーはCLIのフォアグラウンドプロセスで動かし、Ctrl+Cで終了する。ブラウザのタブを閉じてもサーバーは継続する。バックグラウンド常駐やタブ閉鎖に連動した自動終了は初版では提供しない。フェーズ0では方針の文書化のみを行い、実装・終了処理の検証はフェーズ1で行う。ユーザー承認済み。

初版の正式サポートと開発の基準はNode.js 24系とする。22系は対象外。ユーザー承認済み。対応する最低マイナーバージョンは開発ツールの要件を確認して決める。26系はLTS移行後に検証して追加を判断する。

調査（2026-09-17）：[Node.js公式リリース一覧](https://nodejs.org/en/about/previous-releases)では22・24がLTS、26がCurrent、20がEOL。Context7の検索では関連する公式資料を得られなかったため、公式サイトで直接確認した。

初版はmacOS・Linux・Windowsをサポート対象とし、フェーズ0から各OSでNode.js 24系の導入・品質チェック・ビルド・CLI起動をCIで検証する。ユーザー承認済み。ローカルで実行した検証とCIで実行した検証は区別して記録する。

フェーズ0でも配布用tarballを作り、リポジトリ外の一時ディレクトリへインストールして `changemap --help` と `changemap --version` の正常終了を検証する。開発用依存やソースが手元にあることで配布不備が隠れるのを防ぐ。npm公開は行わない。フェーズ5では完成した製品全体について配布検証を行う。ユーザー承認済み。

## 合意済みの開発ツール

次の構成を採用する。ユーザー承認済み。

| 用途       | 採用ツール                   |
| ---------- | ---------------------------- |
| CLIビルド  | tsdownでNode.js向けESMを出力 |
| 型チェック | TypeScriptの `tsc --noEmit`  |
| テスト     | Vitest                       |
| lint       | Oxlint                       |
| format     | Oxfmt                        |

Node.jsで実行するnpmパッケージとして配布し、Node.js自体を含む単体実行ファイルは作らない。具体的なバージョンとNode.jsの最低マイナーバージョンは、導入時に各パッケージの要件を照合し、ロックファイルとCIで再現性を確保する。

調査（2026-09-17）：tsdownはNode.js向けESMのCLI構成とshebangの扱いを確認した。Vitest、Oxlint、Oxfmtは公式の導入資料を確認した。組み合わせの実行検証は未実施。

- [tsdown CLI構成](https://github.com/rolldown/tsdown/blob/main/skills/tsdown/references/option-shims.md)
- [Vitest](https://vitest.dev/guide/)
- [Oxlint](https://oxc.rs/docs/guide/usage/linter)
- [Oxfmt](https://oxc.rs/docs/guide/usage/formatter)

## 実装手順

以下は合意した範囲を実装作業へ落とし込んだもの。計画全体の確認は完了しており、この手順に沿って着手する。

1. Backlog.mdの現行の初期化手順を公式資料で確認し、このリポジトリに初期化する。「フェーズ0：プロジェクト基盤」のマイルストーンと、以下の作業に対応するタスク・受け入れ条件を登録する。後続フェーズの詳細タスクは作らない。
2. 単一パッケージの `package.json`、pnpmロックファイル、TypeScript設定を作る。pnpmの利用バージョンを固定し、Node.js 24系内の最低対応バージョンを依存ツールの要件から決める。既存のLICENSEを保持し、メタデータと整合させる。npm名の利用可否を読み取りで確認し、使えない場合は名称変更を独断で行わず報告する。
3. `src/cli/` にCLI入口を作り、tsdownで `dist/` にESMを出力する。`package.json` の `bin` から `changemap` として実行可能にする。`--help` は実装済みの利用方法を表示し、`--version` はパッケージのバージョンと一致させる。レビュー機能は実装せず、未対応の呼び出しはその旨を示して非ゼロで終了する。
4. Vitest・TypeScript・Oxlint・Oxfmtの設定と下記コマンドを用意する。テストはCLIを子プロセスとして実行し、ヘルプ・バージョンの出力と終了コード、未対応呼び出しを確認する。
5. 配布対象ファイルを明示し、tarballを一時ディレクトリへインストールする検証を作る。開発用依存がない環境で、インストールされたコマンド経由のヘルプ・バージョンを確認する。Windowsを含めて動くよう、検証処理を特定のシェルに依存させない。
6. GitHub ActionsにmacOS・Linux・Windows × Node.js 24系の検証を設定する。ロックファイル固定の導入、品質チェック、ビルド、配布検証を実行する。最低対応バージョンと24系の最新パッチを検証対象に含める。
7. 英語READMEに必要環境、開発・ローカルインストール方法、実装済みのCLI例を記載する。将来のレビュー機能とサーバーの起動・終了方針は未実装として区別する。npm公開済みと誤認させる案内はしない。
8. クリーンな環境で受け入れ条件を検証し、Backlog.mdと引き継ぎ文書に実行結果・未検証事項を記録する。CIの設定作成だけを実行成功とは扱わない。

## 開発コマンド

| コマンド            | 役割                                         |
| ------------------- | -------------------------------------------- |
| `pnpm test`         | Vitestを一回実行                             |
| `pnpm typecheck`    | 型チェック。成果物は出力しない               |
| `pnpm lint`         | Oxlintによるチェック                         |
| `pnpm format`       | Oxfmtによる整形                              |
| `pnpm format:check` | ファイルを書き換えず整形状態を検証           |
| `pnpm build`        | CLIの配布成果物を生成                        |
| `pnpm test:pack`    | tarballの生成・隔離インストール・CLI起動確認 |

## 受け入れ条件

クリーンなチェックアウトで `pnpm install --frozen-lockfile` が成功し、test・typecheck・lint・format:check・buildがすべて成功する。ビルド成果物の `changemap --help` と `changemap --version` が正常終了し、バージョン表示はパッケージメタデータと一致する。

macOS・Linux・WindowsのCIで、Node.js 24系の導入・品質チェック・ビルド・CLI起動を検証する。

配布用tarballをリポジトリ外へインストールし、開発用ソースに依存せず `changemap --help` と `changemap --version` が正常終了することを各OSで検証する。

Backlog.mdにフェーズ0のマイルストーンと実績が記録され、英語READMEの実装済みコマンド例が実態と一致している。

## 対象外と後続への引き継ぎ

サーバー・React画面の実装、Git差分取得、依存解析、グラフ表示、設定保存、npm公開は今回の対象外。ポート選択、ブラウザ起動、サーバーの通信方式、詳細なGit引数処理はフェーズ1着手時に具体化する。

UIビルドツールや依存解析基盤は今回のツール選定に含めない。新しい製品用語や変更コストの高い設計判断は今回追加していないため、用語集・ADRは新規作成しない。

## 実装・検証記録（2026-09-17）

- 単一パッケージ、Node.js `>=24.11.0 <25`、pnpm 10.33.0、ESM成果物 `dist/cli.mjs`、bin `changemap` を設定。
- 採用版：tsdown 0.23.0、TypeScript 7.0.2、Vitest 5.0.0、Oxlint 1.82.0、Oxfmt 0.67.0、Backlog.md 1.51.0。ロックファイルを作成。既存の公開後7日間の待機設定を維持した。
- npmメタデータで直接・間接依存のNode.js要件を照合。24系の最低版を決める要件はtsdownの `^24.11.0`。
- npm名 `changemap` は読み取り照会で404。既存公開パッケージは確認されなかったが、名前の予約や実際の公開可否は未確認。npm公開はしていない。
- Backlog.mdは公式CLIで初期化。`--no-git --integration-mode none` により自動コミットとエージェント設定の生成を無効化。マイルストーンm-0とTASK-1〜3に実績を記録。
- macOS / Node.js 24.14.1で、クリーンな一時コピー（`.git`・`node_modules`・`dist`なし）への `pnpm install --frozen-lockfile` と、typecheck・lint・format:check・test（12件）・build・test:packがすべて成功。コミット前のため「クリーンなチェックアウト」そのものの検証はCIに残る。
- tarballの収録内容は `dist/cli.mjs`・`package.json`・`README.md`・`LICENSE`。隔離先でprod/offline/ignore-scriptsにより導入し、開発依存が存在しないことと、インストール済みbin経由のhelp/versionを確認。
- 初回の型チェックでJSONの名前付きimportが失敗したためdefault importに修正。配布検証ではmiseのpnpm実行バイナリと通常のJS版を両方扱うよう修正し、pnpmが生成する補助ディレクトリと開発依存の混入を区別して検証した。
- GitHub ActionsはmacOS・Linux・Windows × `24.11.0`・`24.x` の6ジョブを設定。まだ実行しておらず、TASK-3はIn Progress。最低版・他OS・24系最新の成功をローカル結果から推定しない。

導入資料はfind-docsスキルでContext7経由の公式資料を確認した。

- [Backlog.md](https://github.com/mrlesk/Backlog.md)：非対話init、milestone、task操作。採用版のCLI helpでもオプションを確認。
- [tsdown](https://github.com/rolldown/tsdown)：entry・ESM・shebangと実行権限・outExtensions。
- [Vitest](https://vitest.dev/config/)：Node環境とテスト対象設定。
- [Oxlint](https://oxc.rs/docs/guide/usage/linter/config-file-reference.html)、[Oxfmt](https://oxc.rs/docs/guide/usage/formatter/ignore-files.html)：設定ファイルと除外指定。
