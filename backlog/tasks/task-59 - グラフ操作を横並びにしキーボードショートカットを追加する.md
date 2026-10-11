---
id: TASK-59
title: グラフ操作を横並びにしキーボードショートカットを追加する
status: Done
assignee:
  - '@codex'
created_date: '2026-10-11 05:49'
updated_date: '2026-10-11 05:56'
labels: []
dependencies: []
ordinal: 40000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
グラフの表示倍率を操作位置で把握し、レビュー中の操作をキーボードから実行したい。添付画像に合わせた操作バーと設定内のヘルプを用意する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 縮小・倍率・拡大・全体表示が横並びになり倍率が追従する
- [x] #2 指定されたショートカットが動作し入力中やダイアログ操作と競合しない
- [x] #3 設定ダイアログとREADMEに一覧を表示し?で設定を開ける
- [x] #4 回帰テストと必要な検証を実行する
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 横並びのグラフ操作バーと倍率追従を追加する。
2. 入力・ダイアログを保護するショートカットを追加し、ファイル操作を共通化する。
3. 設定内の一覧とREADMEの表を追加する。
4. 回帰テスト、品質チェック、ブラウザでの表示確認を行う。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
横並びの操作バーと倍率追従をブラウザで確認（23%→28%）。設定にDisplayとKeyboard shortcutsのタブを設け、?で一覧を直接表示する。1280×633の画面で全8行がダイアログ内に収まることを確認。スクリーンショット: backlog/docs/assets/task-59-graph-controls.png、backlog/docs/assets/task-59-shortcuts.png。全291テスト、typecheck、lint、format:check、benchmark:layout 1000、test:packが通過。初回はtestとtest:packのビルド競合で1件失敗し直列実行で解消。別の実行でlocalhostのEPERMが発生し、許可された環境で全体テストを再実行して通過。ビルド時の500kB超チャンク警告は残る。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
グラフ操作を−・倍率・＋・Fitの横並びにし、指定されたショートカットを追加した。入力・IME・ブラウザの修飾キー・ダイアログ操作を保護し、E/Cは選択中ならペインを閉じた後も動作する。設定タブとREADME表に一覧を追加。回帰テストを含む291件、品質・レイアウト・配布検証、ブラウザの表示とキー操作確認で検証済み。
<!-- SECTION:FINAL_SUMMARY:END -->
