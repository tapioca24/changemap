---
id: TASK-24
title: 追加・編集・削除ノードの状態表現を見直す
status: Done
assignee:
  - '@tapioca24'
created_date: '2026-09-24 06:04'
updated_date: '2026-09-25 16:26'
labels:
  - graph
  - ui
dependencies: []
references:
  - backlog/docs/assets/task-24-mixed-states-latte.png
  - backlog/docs/assets/task-24-mixed-states-mocha.png
type: enhancement
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
現在はノード左辺の色だけで追加・編集・削除を表すため、変更状態が目立ちにくく、対象ファイルをすばやく見分けにくい。変更状態をより明確に識別できるノード表現を検討し、レビュー画面に適用する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 追加・編集・削除の各状態をノード上で視覚的に識別できる
- [x] #2 状態表現の違いをグラフ上で判別できる
- [x] #3 ノード名や依存関係の視認性を損なわない
- [x] #4 状態表現の組み合わせを含む表示を確認できる
- [x] #5 追加・編集・削除・リネームのノードは、状態色の枠線が四辺とも同じ1pxで表示される
- [x] #6 未変更ノードは中立色の枠線が四辺とも同じ1pxで表示され、選択中の外側の枠も判別できる
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 追加・編集・削除・リネームのノードを、それぞれ異なる淡い背景色と文字バッジで示す。未変更は中立背景・バッジなしにする。
2. 凡例を表示と一致させ、選択枠・未解決参照・名前・依存辺の視認性を保つ。
3. 全ノードの枠線を四辺均一の1pxにする。変更ノードは各状態色、未変更ノードは中立色を使う。
4. 複数状態が混在する画面を明暗テーマと選択状態で確認し、スクリーンショットを更新する。
5. 型検査・lint・整形確認・テスト・レイアウト検証・配布検証を実行し、結果を記録する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
追加・編集・削除・リネームを同じ強さの淡い背景色と文字バッジで表示。未変更は中立背景でバッジなし。凡例とリネームのコードペイン／解析対象外リストも状態色に一致させた。
検証: 混在状態の実ブラウザー表示を Latte / Mocha で確認し、ノード名・依存辺・選択枠を確認。スクリーンショットは References の2点。jsdom の混在状態回帰テストを追加。pnpm test (130件), pnpm typecheck, pnpm lint, pnpm format:check, pnpm benchmark:layout 1000, pnpm test:pack, git diff --check が成功。

追加確認: 変更ノードの四辺を状態色の2px、未変更ノードの四辺を中立色の1pxに変更。Mocha の実ブラウザーで5状態の computed style を確認し、各辺の太さと色が一致することを検証。Latte / Mocha の混在状態スクリーンショットを更新し、選択中の紫の外枠、名前・依存辺の視認性も確認。pnpm test (130件), pnpm typecheck, pnpm lint, pnpm format:check, pnpm benchmark:layout 1000, pnpm test:pack, git diff --check が成功。

最終調整: 2px の枠線は強すぎるとのフィードバックを受け、変更ノードも四辺均一の1pxに変更。状態色・背景色・バッジと未変更ノードの中立1pxは維持。実ブラウザーで5状態すべての四辺の computed style を確認し、Latte / Mocha のスクリーンショットを更新。選択枠、ファイル名、依存辺の視認性を確認。pnpm test (130件), pnpm typecheck, pnpm lint, pnpm format:check, pnpm benchmark:layout 1000, pnpm test:pack, git diff --check が成功。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
ノード状態を淡い背景色と文字バッジで示し、変更ノードの四辺を状態色の1px、未変更ノードの四辺を中立色の1pxにした。明暗テーマの実画面と5状態の枠線計算値、選択枠・依存辺を確認。130件のテストと型・lint・整形・レイアウト・配布検証に合格した。
<!-- SECTION:FINAL_SUMMARY:END -->
