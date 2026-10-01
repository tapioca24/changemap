---
id: TASK-50
title: changemap 0.2.0 を通常版としてリリースする
status: In Progress
assignee:
  - '@tapioca24'
created_date: '2026-10-01 02:08'
updated_date: '2026-10-01 02:09'
labels: []
dependencies: []
references:
  - 'https://github.com/tapioca24/changemap/pull/23'
type: chore
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
v0.1.0 以降のレビュー画面改善と npm 自動公開ワークフローを利用者に届ける。公開ワークフローは今回が初回の実公開となるため、TASK-48 で公開結果を別途検証する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 0.2.0 の版更新 PR が main にマージされ、必要な CI が成功する
- [ ] #2 v0.2.0 のタグと通常版 GitHub Release が検証済みの main コミットを指す
- [ ] #3 GitHub Release 公開後、npm の changemap@0.2.0 を確認し、結果を報告する
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. main の内容と 0.2.0 の未使用状態を再確認し、専用ブランチで package.json と lockfile を更新する。
2. 型検査・lint・整形確認・テスト・レイアウト・配布検証を実行し、版更新 PR を作成する。
3. PR の差分と 3 OS の CI を確認して main にマージする。
4. main とタグ対象を照合し、前回タグ以降の変更からリリースノートを作る。公開直前に最終確認を得る。
5. 通常版 GitHub Release を公開し、npm 自動公開・provenance・新規環境での CLI を検証する。TASK-48 に実測結果を記録する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
0.2.0 は npm registry で 404、GitHub の v0.2.0 タグも 404。main=203e6758fc349629415a6c99f97f4f43cd130dda を確認。pnpm typecheck/lint/format:check、pnpm test（211件）、pnpm benchmark:layout 1000、pnpm test:pack はすべて成功。lockfile にプロジェクト版番号はなく変更不要。
<!-- SECTION:NOTES:END -->
