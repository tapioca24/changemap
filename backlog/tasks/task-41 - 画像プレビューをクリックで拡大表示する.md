---
id: TASK-41
title: 画像プレビューをクリックで拡大表示する
status: Done
assignee:
  - '@mitani'
created_date: '2026-09-26 08:37'
updated_date: '2026-09-26 08:41'
labels: []
dependencies: []
type: enhancement
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
画像の全体表示だけでは細部を確認しにくい。プレビュー画像をクリックして大きく見られるようにする。TASK-28 の画像プレビューを拡張する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 表示可能な画像をクリックすると拡大表示され、変更前後のどちらの画像かと元の寸法が分かる。
- [x] #2 閉じるボタン、Escape キー、背景クリックで拡大表示を閉じられ、元の操作位置へ戻れる。
- [x] #3 小さい画面でも画像が表示領域に収まり、UI の回帰テストとブラウザ確認で検証される。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 画像カードを操作可能なプレビューボタンにする。
2. ネイティブ dialog で拡大画像・ラベル・寸法を表示し、閉じる操作とフォーカス復帰を実装する。
3. レスポンシブなスタイル、回帰テスト、利用ガイドを更新して検証する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
検証: pnpm test（13ファイル・135テスト成功）、pnpm typecheck、pnpm lint、pnpm format:check、pnpm benchmark:layout 1000（約717ms）、pnpm test:pack、git diff --check。実ブラウザで画像クリックによる拡大、Escape・背景クリックでの終了、390×844画面での表示を確認。UIテストでは閉じるボタン・背景クリック後のフォーカス復帰を確認。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
画像プレビューをクリックで拡大するダイアログを追加。前後ラベル・元の寸法を表示し、閉じるボタン・Escape・背景クリックで閉じられる。フォーカス復帰と狭い画面での表示をテスト・実ブラウザで確認し、利用ガイドを更新した。
<!-- SECTION:FINAL_SUMMARY:END -->
