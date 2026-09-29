---
id: TASK-48
title: 次回リリースで npm 自動公開を実地確認する
status: To Do
assignee: []
created_date: '2026-09-29 13:56'
labels: []
dependencies:
  - TASK-42
type: chore
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-42 では新バージョンを発行せず公開ワークフローと Trusted Publisher を設定するため、OIDC 認証と npm への実公開は未実証。次回の正式リリースで公開フローを確認し、運用上の不具合があれば修正する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 通常の GitHub Release 公開を起点に、3 OS の検証後、対応するバージョンが npm に自動公開される
- [ ] #2 公開ジョブの成功表示と npm 上のバージョン・provenance を確認する
- [ ] #3 公開版を新規環境に導入し、CLI の起動とバージョン表示を確認する
<!-- AC:END -->
