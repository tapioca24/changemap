---
id: TASK-20
title: コード表示に言語別シンタックスハイライトを適用する
status: Done
assignee:
  - '@mitani'
created_date: '2026-09-24 06:04'
updated_date: '2026-09-24 15:56'
labels:
  - ui
  - diff
dependencies: []
type: enhancement
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
レビュー時にコードの構文を読み取りやすくするため、差分および変更前後のフルファイル表示に言語別シンタックスハイライトを適用する。差分行は既存の背景色を保ち、削除・追加を背景色で識別しながら構文色も読める表示にする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 差分コードと変更前後のフルファイルコードに、ファイルの言語に応じた構文色が表示される
- [x] #2 追加・削除行は背景色で識別でき、差分記号に依存せずコードを読める
- [x] #3 既存の追加・削除の色分けとテーマ表示が維持される
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Shiki の対象言語・テーマ・Worker 構成を実装し、サイズ上限と失敗時の通常表示を用意する。
2. unified diff を変更前後の行へ対応付け、全文取得後の構文トークンを差分と全文表示に適用する。
3. 追加・削除の背景とテーマ配色を整え、記号を非表示にして読み上げ情報を付ける。
4. 回帰テストと静的検査・ビルド・性能確認を行い、TASK-20 の受け入れ条件を検証する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shiki 4.4.3 を JavaScript 正規表現エンジンと ES module Worker で導入し、23言語の文法を必要時に読み込む。差分はハンク行番号で変更前後の全文トークンへ対応付けた。差分記号と Git ファイルヘッダーを非表示にし、追加・削除背景と読み上げ用ラベルを残した。300,000文字または5,000行を超える場合と失敗時は通常表示と理由に戻す。12,000行・約31万文字の TypeScript の単発解析は Node 上で約313ms。Chromium で差分・全文と4テーマの構文色を確認済み。

検証: pnpm test は全112件成功。pnpm typecheck、pnpm lint、pnpm format:check、pnpm benchmark:layout 1000（786.97ms）、pnpm test:pack は成功。23言語の Shiki 文法を実行時に読み込み、全件エラーなし。Chromium で差分・Before/After 全文の構文トークン、追加・削除背景、記号の非表示、Latte/Frappé/Macchiato/Mocha の色切り替えを確認。macOS・Node 24.14.1 で実施し、他 OS の CI は未実行。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
差分と変更前後の全文に23言語の構文色を追加。差分記号を除き、追加・削除背景と4テーマを維持した。Worker とサイズ上限により表示を保護し、失敗時は理由を示して通常表示へ戻す。112テスト、静的検査、レイアウト・配布検証、Chromium 操作で確認した。
<!-- SECTION:FINAL_SUMMARY:END -->
