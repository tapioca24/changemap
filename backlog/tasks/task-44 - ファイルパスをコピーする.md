---
id: TASK-44
title: ファイルパスをコピーする
status: Done
assignee:
  - '@tapioca24'
created_date: '2026-09-26 09:04'
updated_date: '2026-09-26 11:28'
labels: []
dependencies: []
type: feature
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
レビュー中にファイルパスを別のツールやエディタで使うため、画面から手作業で選択してコピーする手間をなくしたい。対象ファイルのパスをすぐにクリップボードへコピーできるようにする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 レビュー画面でファイルパスをコピーする操作ができる
- [x] #2 コピー後に成功したことがユーザーに分かる
- [x] #3 コピーに失敗した場合はそのことがユーザーに分かる
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. コードペインの新旧ファイルパスにコピー用アイコンボタンを配置する。
2. クリップボードへのコピー結果をボタン付近に表示する。
3. UI の型・整形を確認し、受け入れ条件を照合する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
コードペインの表示パスをリポジトリ相対でコピー。リネーム時は新旧それぞれに操作を配置。clipboard.writeText の成功時はチェック表示と読み上げ通知、失敗時は「コピーできませんでした」を表示。pnpm build、pnpm typecheck、pnpm lint、pnpm format:check、pnpm exec vitest run tests/code-pane-highlight.test.ts（4件成功）で確認。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
コードペインのファイルパス横にコピー用アイコンを追加し、リネーム時は新旧パスを個別にコピー可能にした。成功時のチェック表示と失敗時の通知を UI テストで確認し、ビルド・型検査・lint・整形確認が通過した。
<!-- SECTION:FINAL_SUMMARY:END -->
