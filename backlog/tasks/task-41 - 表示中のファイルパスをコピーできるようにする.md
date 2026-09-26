---
id: TASK-41
title: 表示中のファイルパスをコピーできるようにする
status: To Do
assignee: []
created_date: '2026-09-26 08:45'
labels: []
dependencies: []
type: feature
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
レビュー画面でファイルを見つけても、別のツールや会話にパスを渡すには画面上の文字列を選択する必要がある。コードペインに表示されるリポジトリ相対パスを手早く再利用したい。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 コードペインで表示中のファイルパスを操作一つでクリップボードにコピーできる
- [ ] #2 追加・変更・リネーム済みのファイルでは表示中の新しいパス、削除済みのファイルでは削除前のパスがコピーされる
- [ ] #3 コピー操作をキーボードから実行でき、成功または失敗が画面上で分かる
- [ ] #4 コピーするパスの選択とコピー操作の振る舞いを回帰テストで確認できる
<!-- AC:END -->
