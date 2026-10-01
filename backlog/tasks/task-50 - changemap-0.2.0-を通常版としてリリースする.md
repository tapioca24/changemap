---
id: TASK-50
title: changemap 0.2.0 を通常版としてリリースする
status: Done
assignee:
  - '@tapioca24'
created_date: '2026-10-01 02:08'
updated_date: '2026-10-01 02:27'
labels: []
dependencies: []
references:
  - 'https://github.com/tapioca24/changemap/pull/23'
  - 'https://github.com/tapioca24/changemap/pull/24'
  - 'https://github.com/tapioca24/changemap/releases/tag/v0.2.0'
type: chore
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
v0.1.0 以降のレビュー画面改善と npm 自動公開ワークフローを利用者に届ける。公開ワークフローは今回が初回の実公開となるため、TASK-48 で公開結果を別途検証する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 0.2.0 の版更新 PR が main にマージされ、必要な CI が成功する
- [x] #2 v0.2.0 のタグと通常版 GitHub Release が検証済みの main コミットを指す
- [x] #3 GitHub Release 公開後、npm の changemap@0.2.0 を確認し、結果を報告する
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. main と 0.2.0 の未使用状態を確認し、専用ブランチで package.json を更新する。lockfile はプロジェクト版番号を含まないため変更不要。
2. 型検査・lint・整形確認・テスト・レイアウト・配布検証を実行し、版更新 PR を作成する。
3. PR の差分と 3 OS の CI を確認して main にマージする。
4. main とタグ対象を照合し、前回タグ以降の変更からリリースノートを作る。公開直前に最終確認を得る。
5. 通常版 GitHub Release を公開し、npm 自動公開・provenance・新規環境での CLI を検証する。TASK-48 に実測結果を記録する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
0.2.0 は npm registry で 404、GitHub の v0.2.0 タグも 404。main=203e6758fc349629415a6c99f97f4f43cd130dda を確認。pnpm typecheck/lint/format:check、pnpm test（211件）、pnpm benchmark:layout 1000、pnpm test:pack はすべて成功。lockfile にプロジェクト版番号はなく変更不要。

PR #24（https://github.com/tapioca24/changemap/pull/24）をマージし、PR と main の Linux・macOS・Windows CI が成功。main=2f7d1642124437935a32e6282bb893654d2c9daa に v0.2.0 タグを付け、通常版 GitHub Release https://github.com/tapioca24/changemap/releases/tag/v0.2.0 を公開。公開ワークフロー https://github.com/tapioca24/changemap/actions/runs/36805311345 の 3 OS と publish が成功し、npm registry の changemap@0.2.0 と provenance を確認。隔離環境で公開版の --version=0.2.0 と --help を確認。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
changemap 0.2.0 を検証済み main から通常版として公開。PR・3 OS CI・npm 自動公開が成功し、公開版の provenance と CLI 起動を確認した。
<!-- SECTION:FINAL_SUMMARY:END -->
