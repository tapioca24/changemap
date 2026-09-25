---
id: TASK-39
title: CLIヘルプの古い依存グラフ案内を修正するか確認する
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
TASK-15で発見済み。src/cli/main.tsのヘルプには「Dependency graphs are planned.」が残る一方、グラフは実装済み。現行仕様との一致を確認する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 CLIヘルプを現行仕様と照合し、古い案内が残っていれば修正する。ビルド後のCLI出力で案内が仕様と一致することを確認する。
<!-- AC:END -->
