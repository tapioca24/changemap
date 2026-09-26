---
id: TASK-45
title: 解析パイプラインを抽象化して Go 言語をサポートする
status: To Do
assignee: []
created_date: '2026-09-26 09:04'
labels: []
dependencies: []
type: feature
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
現在の解析パイプラインは TypeScript の依存関係解析を前提としており、Go プロジェクトの変更影響を同じレビュー画面で確認できない。言語固有の解析と共通のグラフ処理を分離し、Go の解析結果も既存の変更レビューで扱えるようにする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 言語ごとの依存解析を共通の解析パイプラインから利用できる
- [ ] #2 Go のソースコードからファイル間の依存関係を解析できる
- [ ] #3 Go の解析結果が既存のグラフと変更レビューに反映される
- [ ] #4 Go 以外の既存言語解析の振る舞いが維持される
<!-- AC:END -->
