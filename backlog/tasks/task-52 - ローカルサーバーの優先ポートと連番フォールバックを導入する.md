---
id: TASK-52
title: ローカルサーバーの優先ポートと連番フォールバックを導入する
status: Done
assignee:
  - '@tapioca24'
created_date: '2026-10-03 12:12'
updated_date: '2026-10-03 12:20'
labels: []
dependencies: []
ordinal: 34000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
現在は起動ごとにOSが空きポートを選ぶため、ブラウザーで使うURLを予測しづらい。既存の--port指定も使用中のポートで起動に失敗するため、指定番号を優先しつつ連番で空きポートを探したい。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 既定で18473を優先し、使用中なら連番で最大100個まで試す
- [x] #2 --port指定も同じ探索を行い、--port 0はOSによる空きポート選択を維持する
- [x] #3 65535を超えず、使用中以外のエラーでは探索を続けない
- [x] #4 代替ポートを使った場合は理由と実際のURLが分かり、ヘルプと利用資料が新仕様を説明する
- [x] #5 ポート競合と境界条件を回帰テストで検証する
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. CLIの既定ポートを18473にし、サーバー起動時にEADDRINUSEだけを対象として指定番号から最大100個のポートを順に試す。--port 0は従来動作を保つ。
2. 代替ポートを使った場合に理由を表示し、ヘルプと利用資料を更新する。
3. 競合・上限・非競合エラーをテストし、型検査・lint・整形・テスト等を確認する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
既定18473、最大100ポートの順次探索、--port 0の互換動作、65535上限、競合時のCLI表示を実装。100ポート連続占有テストで発見したリスナー残留も修正した。検証: pnpm test (215件)、pnpm typecheck、pnpm lint、pnpm format:check、pnpm benchmark:layout 1000、pnpm test:pack、git diff --check。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
CLIの既定優先ポートを18473に変更し、指定ポートが使用中なら最大100個を順に探索するようにした。--port 0は維持し、代替ポートの案内と利用資料を更新。全215件のテスト、型検査、lint、整形、レイアウト検証、配布検証を通過した。
<!-- SECTION:FINAL_SUMMARY:END -->
