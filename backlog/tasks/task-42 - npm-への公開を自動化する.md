---
id: TASK-42
title: npm への公開を自動化する
status: To Do
assignee: []
created_date: '2026-09-26 08:59'
labels: []
dependencies: []
type: chore
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リリースのたびに npm への公開を手作業で行う必要があり、公開忘れや手順のばらつきが起きやすい。タグ付けなど定めたリリース操作を起点に、検証済みのパッケージを npm へ公開できるようにする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 リリース操作を起点に npm への公開が自動実行される
- [ ] #2 公開前にプロジェクトで定めたビルドと配布物の検証が成功している
- [ ] #3 公開処理の失敗が CI 上で確認でき、成功時には公開バージョンが分かる
<!-- AC:END -->
