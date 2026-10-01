---
id: TASK-48
title: 次回リリースで npm 自動公開を実地確認する
status: Done
assignee:
  - '@tapioca24'
created_date: '2026-09-29 13:56'
updated_date: '2026-10-01 02:27'
labels: []
dependencies:
  - TASK-42
references:
  - 'https://github.com/tapioca24/changemap/releases/tag/v0.2.0'
  - 'https://github.com/tapioca24/changemap/actions/runs/36805311345'
  - 'https://www.npmjs.com/package/changemap/v/0.2.0'
type: chore
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-42 では新バージョンを発行せず公開ワークフローと Trusted Publisher を設定するため、OIDC 認証と npm への実公開は未実証。次回の正式リリースで公開フローを確認し、運用上の不具合があれば修正する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 通常の GitHub Release 公開を起点に、3 OS の検証後、対応するバージョンが npm に自動公開される
- [x] #2 公開ジョブの成功表示と npm 上のバージョン・provenance を確認する
- [x] #3 公開版を新規環境に導入し、CLI の起動とバージョン表示を確認する
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. v0.2.0 の通常版 GitHub Release とタグの対象コミットを確認する。
2. publish.yml の validate、Linux・macOS・Windows の check、publish ジョブと表示版を確認する。
3. npm registry の changemap@0.2.0 と provenance を確認する。
4. 空の隔離環境に公開版を導入し、CLI 起動と --version を検証する。
5. 実測結果を TASK-48 と TASK-50 に記録し、Backlog の変更を PR で main に届ける。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
v0.2.0 は通常版 GitHub Release（https://github.com/tapioca24/changemap/releases/tag/v0.2.0）として公開され、タグは main の 2f7d1642124437935a32e6282bb893654d2c9daa を指す。publish.yml run https://github.com/tapioca24/changemap/actions/runs/36805311345 で validate、Linux・macOS・Windows の check、publish がすべて成功。publish ログに + changemap@0.2.0、署名付き provenance と透明性ログへの登録を確認。npm registry の latest=0.2.0、0.2.0 の attestations に npm publish attestation と SLSA provenance がある。空の一時プロジェクトと専用 pnpm store に 0.2.0 を導入し、changemap --version は 0.2.0、--help は正常終了。ローカルの minimumReleaseAge=10080 分のため、隔離プロジェクトだけで changemap@0.2.0 を例外にして検証した。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
v0.2.0 の通常版 Release から npm への自動公開が完了。3 OS、publish ジョブ、npm 版と provenance、新規環境の CLI 起動・版表示を確認した。
<!-- SECTION:FINAL_SUMMARY:END -->
