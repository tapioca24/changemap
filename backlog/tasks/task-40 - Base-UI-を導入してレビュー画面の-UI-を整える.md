---
id: TASK-40
title: Base UI を導入してレビュー画面の UI を整える
status: Done
assignee:
  - '@tapioca24'
created_date: '2026-09-25 17:20'
updated_date: '2026-10-01 01:46'
labels:
  - ui
  - frontend
dependencies: []
references:
  - 'https://base-ui.com'
priority: medium
type: enhancement
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
現在のレビュー画面は画面ごとに操作部品の見た目や状態表現が分散しており、今後の UI 改善で一貫性を保ちにくい。Base UI を共通の UI プリミティブとして導入し、既存のグラフ・差分コード・設定操作を保ったまま、操作部品の見た目、状態、フォーカス、レスポンシブ表示を整える。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Base UI がプロジェクトの依存関係と UI 実装で利用可能になり、導入方針と対象範囲がコードまたはドキュメントから確認できる
- [x] #2 レビュー画面の主要な操作部品（ボタン、メニュー、ダイアログ、タブ、選択操作など）が一貫した見た目と状態表現で表示される
- [x] #3 既存のグラフ表示、差分コードペイン、テーマ設定、更新、ペイン開閉・切り替えの操作と状態保持が維持される
- [x] #4 キーボード操作、フォーカス表示、適切な ARIA セマンティクスが主要な操作部品で機能する
- [x] #5 デスクトップ幅と狭い画面の両方でレイアウト崩れや不要な画面はみ出しがなく、既存 UI の視認性が改善される
- [x] #6 変更した UI の振る舞いに回帰テストを追加または更新し、型検査・lint・整形確認・テストが成功する
- [x] #7 上部ヘッダーが比較情報と更新を一段に集約し、スナップショット詳細と設定ダイアログを備える
- [x] #8 Other Files とコードペインが広い画面でグラフと同時操作でき、初期表示時の領域配分と開閉位置が適切である
- [x] #9 未変更ファイルと内容不変のリネームで重複するコード表示の選択肢を示さない
- [x] #10 自前 SVG を Lucide React に置き換え、設定のアイコン・選択矢印・チェック表示・方向ラベルを整える
- [x] #11 コードペインと Other Files の幅を合意した値に調整し、グラフの最小幅を守る
- [x] #12 両方の情報ポップオーバーが前面に表示され、共通の変更種別タグとグラフ操作ボタンの間隔が適切である
- [x] #13 README のメイン画像が現行 UI の実画面を示し、差分コードと依存関係の変化が読み取れる
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 自前の SVG アイコンを Lucide React に置き換え、Diff layout のアイコン・方向ラベル・select/checkbox の位置を整える。
2. コードペインの最大幅を 70%/1920px に拡大し、Other Files を 280px/220px に広げつつグラフを最低 320px 確保する。
3. ポップオーバーの重なり順を修正し、グラフヘルプを撤去する。React Flow の操作ボタン間隔を調整する。
4. 変更種別タグを共通化してグラフ・Other Files・コードペインで統一する。
5. 回帰テストと agent-browser で 1280px/768px の実画面を確認し、型検査・lint・整形・全テスト・配布検証を実行する。

6. コードペイン見出し内のタグとファイルパスの縦位置を揃え、実画面で確認する。

7. 一時 Git リポジトリで checkout の依存先切り替えを再現し、現行 UI の README 画像を撮り直して表示を確認する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Base UI 1.8.0 を導入。Dialog、Popover、Tabs、Radio、Checkbox、Button をレビュー UI の状態を持つ操作に適用し、テーマと方向の長い選択肢はネイティブ select を維持。設定警告はダイアログ外でも通知する。

検証: pnpm test 210/210、pnpm typecheck、pnpm lint、pnpm format:check、pnpm benchmark:layout 1000、pnpm test:pack が成功。ブラウザーで 1280px と 768px の表示、Other Files とグラフ・コードの同時表示、設定ダイアログ、Diff/Before タブの矢印キーと Enter 操作を確認。

追加調整: Lucide React に自前 SVG を置換。Diff layout に TextAlignStart / Columns2 を使い、Graph direction の表記、select 矢印、checkbox の配置を修正。コードペイン最大 70% / 1920px、Other Files 280px / 220px、グラフ最小 320px。変更種別タグを共通化し、両 Popover を前面表示、グラフヘルプを削除、React Flow コントロール間隔を拡大。検証: pnpm test 211/211、pnpm typecheck、pnpm lint、pnpm format:check、pnpm benchmark:layout 1000、pnpm test:pack、agent-browser の 1280px / 768px 実画面で設定 UI・両 Popover・Other Files とコードペインの同時表示を確認。1280px では Other Files 280px、コードペイン最大時のグラフ本体 320px を実測。

追補: コードペインの変更種別タグは共通スタイルの align-self: flex-start によりファイルパスより上に寄っていたため、この見出し内では中央揃えにした。agent-browser で両要素の中央座標が 102.5px で一致することを実測。pnpm build、pnpm format:check、pnpm typecheck、pnpm lint、git diff --check が成功。

README 画像: 一時 checkout-example Git リポジトリの HEAD→作業ツリー比較を agent-browser で 1600×900 撮影。checkout.ts の差分、追加 discount.ts、削除 legacy-discount.ts と依存線を画面で確認し、.github/assets/changemap.png を差し替えた。README の参照先と代替テキストは撮影内容に一致。PNG 形式・1600×900、画像コピーの一致、git diff --check を確認。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Base UI のレビュー画面を整理し、Lucide アイコン、共通変更種別タグ、設定表示、両ペインの幅、Popover、コードペイン見出し位置を改善。README のメイン画像を現行 UI の 1600×900 実画面で更新。全 211 テストと型検査・lint・整形・レイアウト・配布検証が成功し、追加の見た目と画像内容を agent-browser で確認。
<!-- SECTION:FINAL_SUMMARY:END -->
