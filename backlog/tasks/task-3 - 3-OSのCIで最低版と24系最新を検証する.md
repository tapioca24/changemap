---
id: TASK-3
title: 3 OSのCIで最低版と24系最新を検証する
status: Done
assignee: []
created_date: '2026-09-17 11:22'
updated_date: '2026-09-17 11:45'
labels: []
milestone: m-0
dependencies: []
ordinal: 3000
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 macOS・Linux・Windowsと24.11.0・24.xのCIを設定する
- [x] #2 6ジョブの導入・品質チェック・ビルド・配布検証の成功を確認する
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
初回CIはWindowsのCRLF変換によりformat:checkが失敗。.gitattributesでLFに統一し、再実行で6ジョブすべて成功。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
macOS・Linux・Windows × Node.js 24.11.0・24.xで固定ロック導入、型チェック、lint、format、12テスト、build、隔離配布検証が成功。https://github.com/tapioca24/changemap/actions/runs/35217178260
<!-- SECTION:FINAL_SUMMARY:END -->
