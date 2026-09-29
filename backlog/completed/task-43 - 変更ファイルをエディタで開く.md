---
id: TASK-43
title: 変更ファイルをエディタで開く
status: Done
assignee:
  - '@tapioca24'
created_date: '2026-09-26 08:59'
updated_date: '2026-09-26 11:55'
labels: []
dependencies: []
type: feature
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
レビュー中に変更ファイルの内容を詳しく確認したいとき、パスを手作業でコピーしてエディタへ移る必要がある。レビュー画面から対象ファイルをエディタで開けるようにし、確認作業をスムーズにする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 レビュー画面から対象ファイルをエディタで開く操作ができる
- [x] #2 操作したファイルが現在の比較対象リポジトリ内の正しいパスで開かれる
- [x] #3 エディタを起動できない場合、原因がユーザーに分かる形で表示される
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. CLI に --editor を追加し、VISUAL → EDITOR を代替として使用する。引数はシェルを使わず解析する。
2. 選択ノードから作業ツリーの実ファイルを検証する API とエディタ起動 API を作る。
3. コードペインに起動ボタン、内容差の案内、失敗理由を表示する。
4. 回帰テストと提出前検証を実施する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
CLI のエディタ指定、作業ツリー内のパス検証、起動 API、コードペインの操作を実装。サーバー・CLI の対象回帰テスト 36 件が成功。

検証: pnpm test（143 件）、pnpm typecheck、pnpm lint、pnpm format:check、pnpm benchmark:layout 1000、pnpm test:pack が成功。追加の UI/API 回帰テストで未変更ファイル、存在しないファイル、リポジトリ外 symlink、起動失敗を確認。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
コードペインから作業ツリーの実ファイルをエディタで開けるようにした。CLI 指定と VISUAL/EDITOR を使い、内容差・ファイル不在・起動失敗を画面に表示する。UI/API 回帰テストと全 143 テスト、型検査、lint、整形、レイアウト、配布検証で確認した。
<!-- SECTION:FINAL_SUMMARY:END -->
