---
id: TASK-18
title: プロジェクト用 ship-change スキルを作成する
status: Done
assignee:
  - '@tapioca24'
created_date: '2026-09-24 04:10'
updated_date: '2026-09-24 04:13'
labels: []
dependencies: []
modified_files:
  - .agents/skills/ship-change/SKILL.md
  - .agents/skills/ship-change/agents/openai.yaml
type: chore
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
実装済みの変更をブランチ、意味単位のコミット、PR、検証、マージまで一括で届ける手順をこのリポジトリで再利用したい。既存ブランチと無関係な変更を安全に扱い、失敗時にマージを止める判断を明文化する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 明示的に呼び出せるプロジェクト用 skill が配置される
- [x] #2 main 上の変更と既存作業ブランチの両方を扱い、対象変更だけを意味単位でコミットし既存コミットは保持する
- [x] #3 検証と GitHub チェックの成功を確認してからマージコミットでマージし、失敗時は原因を修正するか停止する
- [x] #4 スキルの形式と呼び出し設定を検証する
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 合意した操作範囲と停止条件を短い SKILL.md にまとめる。
2. 明示起動のポリシーを設定し、プロジェクト内に配置する。
3. 構文検証と内容のレビューを行い、Backlog の完了条件を確認する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
SKILL.md と明示起動ポリシーを追加。付属 quick_validate.py は PyYAML を一時環境に導入して実行し、Skill is valid! を確認した。openai.yaml は Ruby の YAML パーサーでも確認した。

手動シナリオ確認: main 上の変更では先にブランチを作成する。既存ブランチではコミットを保持する。別件混在は対象だけを選び、切り分け不能なら停止する。GitHub チェック失敗時は修正・再検証し、解決不能ならマージしない。これは指示文のレビューであり、実際の PR 実行テストではない。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
プロジェクト用 ship-change スキルを追加し、明示起動に限定した。付属バリデーターで形式を、YAML パーサーで設定を確認し、主要な分岐と停止条件を手動レビューした。
<!-- SECTION:FINAL_SUMMARY:END -->
