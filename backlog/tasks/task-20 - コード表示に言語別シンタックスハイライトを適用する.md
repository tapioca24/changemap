---
id: TASK-20
title: コード表示に言語別シンタックスハイライトを適用する
status: To Do
assignee: []
created_date: '2026-09-24 06:04'
labels:
  - ui
  - diff
dependencies: []
type: enhancement
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
レビュー時にコードの構文を読み取りやすくするため、差分および変更前後のフルファイル表示に言語別シンタックスハイライトを適用する。差分行は既存の背景色を保ち、削除・追加を背景色で識別しながら構文色も読める表示にする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 差分コードと変更前後のフルファイルコードに、ファイルの言語に応じた構文色が表示される
- [ ] #2 追加・削除行は背景色で識別でき、差分記号に依存せずコードを読める
- [ ] #3 既存の追加・削除の色分けとテーマ表示が維持される
<!-- AC:END -->
