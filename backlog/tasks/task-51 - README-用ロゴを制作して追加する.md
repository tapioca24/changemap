---
id: TASK-51
title: README 用ロゴを制作して追加する
status: Done
assignee:
  - '@codex'
created_date: '2026-10-03 11:31'
updated_date: '2026-10-03 11:38'
labels: []
dependencies: []
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
changemap の変更と依存関係を伝えるブランド表現を README に加える。ユーザーと合意した赤緑・直線基調・シンボルと文字の構成で、分岐型、差し替え型、C 型の3案から選択する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 3案を明暗背景で比較できる
- [x] #2 ユーザーが選んだロゴを README 冒頭に追加する
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 合意した分岐型・差し替え型・C型のSVGロゴを制作する。
2. 明暗背景の比較画像を作成して表示確認し、ユーザーに選択してもらう。
3. 選択された案を仕上げ、READMEに追加して表示を確認する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
分岐型・差し替え型・C型のSVGを明暗2配色で作成。.github/assets/logo-proposals/comparison.png に比較画像を保存し、描画結果を確認。ユーザーの案選択待ち。READMEへの追加は選択後に行う。

ユーザーが分岐型と明暗自動切り替えを選択。logo-light.svg と logo-dark.svg を正式アセットとして追加し、README冒頭に中央配置のpictureを追加。比較画像で両配色を描画確認済み。jsdomでREADMEのpicture DOM、dark用media、lightフォールバック、両URLに対応するローカルSVGの存在とXML解析を検証。oxfmt README検査・git diff --check成功。mainのraw URLを使用するためGitHub上の画像表示はmain反映後。実ブラウザーでのテーマ切り替えと全コード検証・配布検証は未実施（文書と画像のみ変更）。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
分岐型ロゴの明暗SVGを制作しREADME冒頭へ追加。3案の比較描画、README DOMとSVG解析、整形・差分検査で確認。
<!-- SECTION:FINAL_SUMMARY:END -->
