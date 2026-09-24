---
id: TASK-10
title: リネームを考慮した統合グラフと差分判定を実装する
status: Done
assignee: []
created_date: '2026-09-23 05:20'
updated_date: '2026-09-24 03:52'
labels: []
milestone: m-3
dependencies: []
documentation:
  - backlog/docs/doc-2 - architecture.md
---

## Acceptance Criteria

- [x] Gitのrenameを両端で正規化して辺の追加・削除・不変を判定する
- [x] ファイルの変更状態、旧新パス、状態別の解析対象区分を保持する
- [x] 統合近傍をsnapshot/refresh APIに含める
- [x] パス再利用、rename、初回コミット、解析対象外とAPI更新を検証する

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
全71テストがmacOS / Node.js 24.14.1で成功。詳細と配布検証は[当時の資料](https://github.com/tapioca24/changemap/blob/b9cb948563aba5bbcbb180692e20ca0b67e4c571/docs/phase-3.md)。CIと他OSは未実行。
<!-- SECTION:FINAL_SUMMARY:END -->
