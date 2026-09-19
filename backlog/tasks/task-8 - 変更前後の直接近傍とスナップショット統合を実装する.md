---
id: TASK-8
title: 変更前後の直接近傍とスナップショット統合を実装する
status: Done
assignee: []
created_date: '2026-09-19 08:47'
updated_date: '2026-09-19 08:52'
labels: []
milestone: m-2
dependencies: []
documentation:
  - docs/phase-2.md
ordinal: 8000
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 直接依存先と利用元の和集合と選択ノード間の両状態の辺を保持する
- [x] #2 Git入力・設定・未追跡ファイルの固定性と更新失敗時の保持を検証する
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
両状態の直接近傍と全選択辺、解析対象外の変更を保持。summary.graphへ接続し、index/worktree・未追跡・設定の固定、rename、解析失敗と更新復帰をテストした。
<!-- SECTION:FINAL_SUMMARY:END -->
