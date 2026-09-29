---
id: TASK-42
title: npm への公開を自動化する
status: Done
assignee:
  - '@codex'
created_date: '2026-09-26 08:59'
updated_date: '2026-09-29 14:05'
labels: []
dependencies: []
references:
  - 'https://github.com/tapioca24/changemap/pull/21'
type: chore
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リリースのたびに npm への公開を手作業で行う必要があり、公開忘れや手順のばらつきが起きやすい。タグ付けなど定めたリリース操作を起点に、検証済みのパッケージを npm へ公開できるようにする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 リリース操作を起点に npm への公開が自動実行される
- [x] #2 公開前にプロジェクトで定めたビルドと配布物の検証が成功している
- [x] #3 公開処理の失敗が CI 上で確認でき、成功時には公開バージョンが分かる
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Release 公開時だけ起動するワークフローを追加し、通常版・main 上のタグ・v<package.version> の一致を確認する。
2. 既存 CI を再利用して Linux/macOS/Windows の全検証を通し、隔離検証済みの tarball を保存して同じファイルを公開する。
3. npm Trusted Publishing (OIDC) を設定し、失敗を CI に表示、成功時に npm の公開バージョンを表示する。
4. ローカルと CI で可能な検証を行い、初回の実公開確認は別タスクで追跡する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
GitHub Release published の通常版のみを対象とし、タグと package.json の一致・main 上のコミットを検証。既存 3 OS CI を workflow_call で再利用し、公開ジョブが隔離検証した tarball を保存して同一ファイルを npm publish に渡す。npm パッケージ設定画面で Trusted Publisher tapioca24/changemap / publish.yml を登録し、npm publish 権限が表示されることを確認。Node 24.11.0 同梱の npm 11.6.1 は OIDC の必要最小 11.5.1 を満たす。

ローカルで型検査・lint・整形・全206テスト・レイアウト1000・test:pack・actionlint が成功。npm publish dry-run は既存 0.1.0 の再公開不可として失敗し、これは想定内。実公開は合意どおり TASK-48 で確認する。

PR #21 (https://github.com/tapioca24/changemap/pull/21) の CI run 36579619225 で Linux・macOS・Windows の全 check が成功。公開ワークフローの構文は actionlint で確認。実際の release イベントと OIDC 公開は新バージョンを発行しないため未実施で、TASK-48 に分離。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
GitHub Release 公開を起点とする npm 公開ワークフローと OIDC Trusted Publisher を設定。タグ・main 条件、3 OS CI、検証済み tarball の公開、CI の結果表示を実装した。ローカル全206テスト・配布検証・actionlint と PR #21 の 3 OS CI が成功。初回の実公開確認は TASK-48 で追跡する。
<!-- SECTION:FINAL_SUMMARY:END -->
