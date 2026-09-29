---
id: TASK-46
title: Catppuccin以外の定番テーマを選べるようにする
status: Done
assignee:
  - '@tapioca24'
created_date: '2026-09-26 11:58'
updated_date: '2026-09-26 12:59'
labels: []
dependencies: []
references:
  - 'https://github.com/tokyo-night/tokyo-night-vscode-theme'
  - 'https://github.com/rose-pine/rose-pine-palette'
  - 'https://github.com/antfu/vscode-theme-vitesse'
  - 'https://github.com/rebelot/kanagawa.nvim'
  - 'https://github.com/sainnhe/everforest'
type: enhancement
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
現在のレビュー画面で選べるのは Catppuccin の4テーマのみ。ほかの定番配色を好む利用者も、追加設定なしで画面全体のテーマを選べるようにしたい。ユーザー独自テーマの読み込み可否は TASK-35 で別途検討する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 元の配布元にある Tokyo Night 3種、Rosé Pine 3種、Vitesse 5種、Kanagawa 3種、Everforest 6種の計20種類を同梱し、採用元とライセンスを記録する。
- [x] #2 既存4種類と追加20種類を現在のテーマ選択欄に一覧表示し、選択したテーマをグラフ、コード、状態表示を含む画面全体に適用する。既定の Mocha は維持する。
- [x] #3 追加テーマの選択は再起動後も保持され、既存4種類の設定も引き続き有効である。
- [x] #4 追加20種類すべてについて通常の文字4.5:1、意味のある線・操作部品3:1を目標にコントラストを数値と実画面で確認し、必要な色の割り当てを調整する。表示と設定保存の回帰テストを追加する。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 各公開元の配色とライセンスを固定データとして取り込み、20種類の識別子・表示名・明暗を定義する。
2. 配色を既存の画面用トークンへ割り当て、必要な箇所のコントラストを調整する。既存 Catppuccin と Mocha の既定値は維持する。
3. テーマ選択欄・設定検証・保存を20種類へ拡張し、グラフとコードを含む画面全体に反映する。
4. 24種類の選択・保存の回帰テスト、追加20種類のコントラスト検査、実画面確認、型・lint・整形・ビルド・テスト・配布検証を行う。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
20種類の配色を元の配布元から固定データとして取り込み、出典コミットと MIT ライセンス全文を THIRD_PARTY_THEME_NOTICES.md に記録。配布 tarball への同梱を隔離配布検証で確認。
Catppuccin の4件は表示名と保存 ID の両方に系列名を付けた。既定値は catppuccin-mocha。未リリースのため短い旧 ID は受け付けず、旧設定が不正として保護されることをテストで確認。
数値検証: 追加20種類の文字・状態色が主な背景で4.5:1以上、境界色が3:1以上。ブラウザーで20種類を切り替え、コードペインを含む適用を確認。代表的な明暗をスクリーンショットで確認し、再読込後の復元も確認。axe は明暗とも違反0件。ただし既存グラフの SVG テキストや color-mix を使う要素は自動判定不能で手動確認扱い。
最終検証: pnpm test（167件成功）、pnpm typecheck、pnpm lint、pnpm format:check、pnpm benchmark:layout 1000、pnpm benchmark:rendering 100、pnpm test:pack、git diff --check が成功。描画ベンチマークは旧 ID の残存で一度失敗したが修正後に成功。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Tokyo Night、Rosé Pine、Vitesse、Kanagawa、Everforest の公式20バリエーションを追加し、既存 Catppuccin 4種類と合わせて選択・保存できるようにした。Catppuccin の表示名・保存 ID は catppuccin-mocha などに統一。出典とライセンスを配布物へ記録。全167テスト、型・lint・整形、レイアウト・描画ベンチマーク、隔離配布検証が成功。ブラウザーで全20種類の画面・コード適用と再読込後の復元を確認。axe 違反0件だが、既存グラフの一部は自動コントラスト判定の対象外。
<!-- SECTION:FINAL_SUMMARY:END -->
