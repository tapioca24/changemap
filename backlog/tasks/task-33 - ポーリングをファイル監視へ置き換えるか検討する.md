---
id: TASK-33
title: ポーリングをファイル監視へ置き換えるか検討する
status: To Do
assignee: []
created_date: '2026-09-24 03:26'
updated_date: '2026-09-25 16:11'
labels: []
dependencies: []
documentation:
  - backlog/docs/doc-2 - architecture.md
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
更新検知の読み取り負荷を改善する候補。現在はGit状態の内容照合とHTTPポーリングを使う。OS差、インデックス・参照・未追跡・設定の変更検知と固定表示の維持を評価する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ファイル監視のOS差と必要な変更検知対象、固定表示への影響を評価し、採否と根拠を記録する。採用する場合は対象範囲と受け入れ条件を確定する。
<!-- AC:END -->
