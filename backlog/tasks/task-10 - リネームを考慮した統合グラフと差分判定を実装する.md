---
id: TASK-10
title: リネームを考慮した統合グラフと差分判定を実装する
status: Done
assignee: []
created_date: '2026-09-23 05:20'
labels: []
milestone: m-3
dependencies: []
documentation:
  - docs/phase-3.md
---

## Acceptance Criteria

- [x] Gitのrenameを両端で正規化して辺の追加・削除・不変を判定する
- [x] ファイルの変更状態、旧新パス、状態別の解析対象区分を保持する
- [x] 統合近傍をsnapshot/refresh APIに含める
- [x] パス再利用、rename、初回コミット、解析対象外とAPI更新を検証する

## Final Summary

全71テストがmacOS / Node.js 24.14.1で成功。詳細と配布検証はdocs/phase-3.md。CIと他OSは未実行。
