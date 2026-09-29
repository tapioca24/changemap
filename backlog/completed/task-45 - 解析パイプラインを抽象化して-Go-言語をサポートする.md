---
id: TASK-45
title: 解析パイプラインを抽象化して Go 言語をサポートする
status: Done
assignee:
  - '@codex'
created_date: '2026-09-26 09:04'
updated_date: '2026-09-26 18:34'
labels: []
dependencies: []
type: feature
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
現在の解析パイプラインは TypeScript の依存関係解析を前提としており、Go プロジェクトの変更影響を同じレビュー画面で確認できない。言語固有の解析と共通のグラフ処理を分離し、Go の解析結果も既存の変更レビューで扱えるようにする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 言語ごとの依存解析を共通の解析パイプラインから利用できる
- [x] #2 Go のソースコードからファイル間の依存関係を解析できる
- [x] #3 Go の解析結果が既存のグラフと変更レビューに反映される
- [x] #4 Go 以外の既存言語解析の振る舞いが維持される
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 言語共通の解析入口を導入し、TypeScript の振る舞いを維持する。
2. スナップショットだけを読む Go 標準解析ヘルパーを実装する。単一 go.mod、定義元ファイルへの静的参照、同一パッケージ・両形式のテストを扱う。
3. Go 実行環境の検出と失敗時の診断、OS・アーキテクチャ・ビルドタグの CLI 設定を追加し、比較の前後へ同じ設定を適用する。
4. 解析結果と構成を既存レビューへ統合し、利用方法・制限を記載する。
5. Go 解析・混在リポジトリ・配布の回帰テストを追加し、型検査、lint、整形、全テスト、レイアウト、配布検証を行う。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
grilling で合意済み。Go インストール必須。未導入でも TS 解析を継続。外部ファイル・インストール済み依存は解析しない。部分結果を保持して不完全さを明示。インターフェースは静的宣言へ結ぶ。複数モジュール、go.work、実装候補探索、外部プラグインは対象外。実装開始をユーザー承認済み。

実装: analyzeSnapshot と LanguageAnalyzer で組み込み解析器を統合。Go 標準の parser/types/build を使う同梱ヘルパーを一時ディレクトリへコンパイルし、取得済みソースを stdin JSON で解析する。対象コードの実行、外部依存の読込、依存・ツールチェーンのダウンロードは行わない。CLI に --go-os/--go-arch/--go-tags を追加し構成を表示。cgo は無効、blank import の初期化依存は未解決として明示。README に範囲と制限を記載。

検証: pnpm test は 16 ファイル・205 件成功（Go 回帰 24 件、既存 TypeScript、CLI、UI、サーバーを含む）。pnpm typecheck / lint / format:check、git diff --check、go vet 成功。pnpm benchmark:layout 1000 は 1,000 ノード・3,000 経路、約 2,016 ms。pnpm test:pack は最新 tarball の隔離インストール、Go/TS 混在の依存線、設定、リフレッシュまで成功。macOS・Node 24.14.1・Go 1.26.5 で実施。Linux/Windows の実行は未実施で、既存 CI マトリクスに Go 導入を追加。Vite の既存の 500 kB 超チャンク警告は残る。

ブラウザー確認: 単一モジュールの checkout.go が LegacyDiscount から Discount へ参照先を変える例で、追加・削除の依存線、呼び出し元 checkout_test.go、Go の linux/amd64・タグ・バージョン表示、コード差分を確認。[スクリーンショット](../../.github/assets/go-support.png)。初回の CLI 検証は sandbox の listen EPERM で失敗したが権限拡張後に成功。解析失敗テストの注入先を共通パイプラインへ更新して、失敗時の旧スナップショット保持を確認した。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
言語共通の解析パイプラインと Go の定義元ファイルへの静的依存解析を実装。単一 go.mod、同一パッケージ・両形式のテスト、OS/arch/タグ指定、部分解析の診断を既存レビューへ統合した。全205テスト・型/lint/整形・Go vet・レイアウト・配布検証が成功。ブラウザーで依存先変更と差分表示を確認し、スクリーンショットを保存した。
<!-- SECTION:FINAL_SUMMARY:END -->
