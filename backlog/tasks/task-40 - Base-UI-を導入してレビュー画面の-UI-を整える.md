---
id: TASK-40
title: Base UI を導入してレビュー画面の UI を整える
status: To Do
assignee: []
created_date: '2026-09-25 17:20'
labels:
  - ui
  - frontend
dependencies: []
references:
  - 'https://base-ui.com'
priority: medium
type: enhancement
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
現在のレビュー画面は画面ごとに操作部品の見た目や状態表現が分散しており、今後の UI 改善で一貫性を保ちにくい。Base UI を共通の UI プリミティブとして導入し、既存のグラフ・差分コード・設定操作を保ったまま、操作部品の見た目、状態、フォーカス、レスポンシブ表示を整える。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Base UI がプロジェクトの依存関係と UI 実装で利用可能になり、導入方針と対象範囲がコードまたはドキュメントから確認できる
- [ ] #2 レビュー画面の主要な操作部品（ボタン、メニュー、ダイアログ、タブ、選択操作など）が一貫した見た目と状態表現で表示される
- [ ] #3 既存のグラフ表示、差分コードペイン、テーマ設定、更新、ペイン開閉・切り替えの操作と状態保持が維持される
- [ ] #4 キーボード操作、フォーカス表示、適切な ARIA セマンティクスが主要な操作部品で機能する
- [ ] #5 デスクトップ幅と狭い画面の両方でレイアウト崩れや不要な画面はみ出しがなく、既存 UI の視認性が改善される
- [ ] #6 変更した UI の振る舞いに回帰テストを追加または更新し、型検査・lint・整形確認・テストが成功する
<!-- AC:END -->
