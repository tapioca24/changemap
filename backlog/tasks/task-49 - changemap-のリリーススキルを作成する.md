---
id: TASK-49
title: changemap のリリーススキルを作成する
status: Done
assignee:
  - '@codex'
created_date: '2026-09-29 14:24'
updated_date: '2026-09-29 14:27'
labels: []
dependencies: []
references:
  - backlog/tasks/task-42 - npm-への公開を自動化する.md
  - backlog/tasks/task-48 - 次回リリースで-npm-自動公開を実地確認する.md
modified_files:
  - .agents/skills/release-changemap/SKILL.md
type: chore
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
npm 自動公開は GitHub Release を起点に実装済みだが、版の決定から公開結果の確認までを一貫して進める手順がない。合意したリリース運用をリポジトリ内の再利用可能なスキルにする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 前回タグ以降の main 全変更を確認し、SemVer 候補と根拠を示してバージョンの決定を待つ
- [x] #2 版更新から PR、検証、タグ、GitHub Release 公開、npm 公開結果と導入確認までの手順を示す
- [x] #3 公開直前の最終確認と、公開失敗時の調査・再実行確認を明記する
- [x] #4 スキルの構文と内容を検証する
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 既存の公開ワークフローと初版リリースの記録から、スキルに必要な条件と確認点を整理する。
2. リポジトリ内にリリーススキルを作成し、合意した判断・公開前確認・失敗時の停止条件を記述する。
3. スキル検証と内容確認を行い、Backlog の受け入れ条件を照合する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
公開フロー・初版リリース記録と照合し、通常版の全変更対象、SemVer 決定待ち、PR と検証、公開直前の最終確認、npm の版・provenance・隔離導入確認、失敗後の再実行確認を手順化。Ruby YAML パーサーで frontmatter、許可キー、名前・説明、未完了プレースホルダーを検証し成功。git diff --check 成功。公式 quick_validate.py は PyYAML が環境に無く実行不可だったため同等の構造検証を実施。実リリースはこのタスクの対象外。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
リポジトリ内に通常版リリーススキルを作成。合意した版の決定と公開前後の確認点を記述し、YAML 構文・必須項目と手順内容を検証した。
<!-- SECTION:FINAL_SUMMARY:END -->
