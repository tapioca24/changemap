---
id: TASK-53
title: ディレクトリ単位のグラフ表示を設定で切り替える
status: Done
assignee:
  - '@mitani'
created_date: '2026-10-03 13:13'
updated_date: '2026-10-03 17:20'
labels: []
dependencies: []
type: feature
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
現在の依存グラフは常にディレクトリ単位で配置される。全ファイルの依存関係を一つの配置で確認したいときに切り替えられないため、既存の表示を維持しつつフラット表示を選べるようにする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 groupByDirectory は既定で true で、既存の設定ファイルでも従来の表示になる
- [x] #2 設定画面と config.toml で値を変更でき、画面上の変更は即時反映される
- [x] #3 無効時はディレクトリ枠がなく、全ファイルと依存線が再配置される
- [x] #4 無効時はファイル名の下に親ディレクトリの相対パスを表示し、直下のファイルでは省略する
- [x] #5 切り替え時は選択中のファイルを維持し、新しい配置を表示範囲へ収める
- [x] #6 不正な設定値には従来と同じ警告が出る
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 設定の型・読み込み・保存と設定画面に groupByDirectory を追加する。
2. レイアウトにフラット配置を追加し、ノードと経路を再計算する。
3. 無効時のパス表示と切り替え時の表示範囲調整を組み込む。
4. 回帰テスト・文書・検証を更新する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
設定の既定値・旧 config.toml 互換・不正値警告、UI 切り替えと選択維持、フラット配置とパス表示をテストで確認。pnpm test (224件)、pnpm typecheck、pnpm lint、pnpm format:check、pnpm test:pack が成功。1,000 ノード/3,000 経路のレイアウト検証はグループ化あり 688ms、なし 665ms。

実画面で設定項目の表示崩れが報告されたため、既存のチェックボックス用 CSS との衝突を調査して修正する。

設定項目のラベルに既存の settings-checkbox クラスを誤用していたため、既存の Base UI Checkbox 構成へ統一。agent-browser で修正前を再現し、修正後を 1100×900 画面で撮影して重なりと二重枠の解消を確認。pnpm test (224件)、pnpm test:pack、型検査、lint、整形確認が通過。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
ディレクトリグルーピング切り替えを実装し、設定ダイアログのチェック項目の表示崩れも修正。agent-browser の実画面と全224テスト・配布検証で確認。
<!-- SECTION:FINAL_SUMMARY:END -->
