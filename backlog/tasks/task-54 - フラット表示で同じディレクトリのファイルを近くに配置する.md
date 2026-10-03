---
id: TASK-54
title: フラット表示で同じディレクトリのファイルを近くに配置する
status: Done
assignee:
  - '@mitani'
created_date: '2026-10-03 17:22'
updated_date: '2026-10-03 17:27'
labels: []
dependencies: []
type: enhancement
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ディレクトリ枠を非表示にしたフラット表示では、Dagre が依存関係だけで順序を決めるため、同じディレクトリのファイルが離れて見える。ファイル単位のグラフを維持しつつ、配置にディレクトリの近接性を反映したい。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 groupByDirectory=false でも、依存方向とノード非重複を維持しながら同一ディレクトリのファイルを近づける
- [x] #2 ファイルと依存線の数・端点・選択可能性は変わらない
- [x] #3 groupByDirectory=true の従来配置は変わらない
- [x] #4 複数方向と孤立ファイルを含む回帰テスト、レイアウト性能の検証を行う
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. フラット配置の Dagre 結果を依存方向に沿う段ごとに整理し、同じ親ディレクトリのファイルが同じ段で隣接するよう並び替える。
2. ノード間隔を保って位置を再計算し、移動後の依存線経路を更新する。
3. 複数方向・孤立ファイル・配置性能を検証し、利用ガイドへ振る舞いを記録する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dagre の依存方向に沿う段と既存の配置スロットを維持し、段内で同じ親ディレクトリのファイルを隣接させる。フラット表示だけ移動後の依存線を再計算。4方向の近接・非重複・孤立ファイル・端点、実際のファイル選択をテストで確認。pnpm test 228件、typecheck、lint、format:check、test:pack 成功。1,000ファイル/3,000経路の grouped 形状はフラット約734 ms、グループ化あり約95 ms。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
フラット表示で同じディレクトリのファイルが依存の同一段内で近づくよう配置を調整。依存方向・ファイルと経路・選択を維持し、4方向のテストと性能測定で確認。
<!-- SECTION:FINAL_SUMMARY:END -->
