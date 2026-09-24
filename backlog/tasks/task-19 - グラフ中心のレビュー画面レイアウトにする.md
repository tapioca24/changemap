---
id: TASK-19
title: グラフ中心のレビュー画面レイアウトにする
status: To Do
assignee: []
created_date: '2026-09-24 06:04'
labels:
  - ui
  - layout
dependencies: []
type: enhancement
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
依存関係グラフが画面に対して小さく、主要な情報を確認しづらい。ヘッダーの下をグラフ中心の広いキャンバスと右側の差分コードペインに分け、レビュー対象を見渡しやすくする。キャンバス上のリフレッシュ操作と、依存範囲外として解析されたファイルの縦方向の配置も扱う。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ヘッダーの下でグラフキャンバスが画面の大部分を占め、差分コードを右側の縦長ペインで表示できる
- [ ] #2 差分コードペインがメインキャンバスより狭く、画面の縦方向を活用する
- [ ] #3 リフレッシュ操作にキャンバス上からアクセスできる
- [ ] #4 依存関係の範囲外として解析されたファイルが、1列に縦方向へ並んで表示される
<!-- AC:END -->
