---
id: TASK-56
title: コードペインの幅をpxで保持する
status: Done
assignee:
  - '@codex'
created_date: '2026-10-09 14:38'
updated_date: '2026-10-09 15:01'
labels: []
dependencies: []
modified_files:
  - src/ui/workspace.tsx
  - tests/app.test.ts
  - backlog/docs/doc-1 - usage.md
type: enhancement
ordinal: 37000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ウィンドウ幅を変えるとコードペインが画面幅に比例して伸縮し、読みやすく調整した幅を保てない。grillingで合意した挙動として、指定幅を記憶し、表示領域が足りない場合だけ一時的に縮める。既存の割合設定を引き継ぎ、狭い画面の切り替え表示も維持する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 広い画面ではウィンドウ幅を変えてもコードペインの指定px幅を維持する
- [x] #2 グラフ最低幅320pxとOther filesの領域を確保するため一時的に縮小し、領域を広げたら記憶した幅へ戻る
- [x] #3 960px未満の全幅表示を維持し、広い画面へ戻ったら記憶した幅を復元する
- [x] #4 最大70%制限を撤廃し、コードペイン上限1920pxを維持する
- [x] #5 幅未設定の初回は広い画面でコードを開いたときの45%をpx換算し、既存の割合設定も初回表示時に換算して引き継ぐ
- [x] #6 ポインターとキーボードで調整したpx幅を再読み込み後も保持する
- [x] #7 回帰テストと実ブラウザーでリサイズ・復元・移行を確認する
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 保存設定に幅の単位を持たせ、旧割合設定と初回45%を初めて広い画面でペインを開くときにpxへ移行する。
2. 希望幅と表示幅を分け、表示幅だけをグラフ領域・Other files領域・1920px上限で制限する。狭い画面の全幅表示は既存CSSを維持する。
3. ポインター操作をpx計算に変え、矢印キーは20px刻み、Home/Endは表示可能な最小/最大幅として操作する。読み上げにも幅の単位を示す。
4. 初回・既存設定移行・保存と再表示・ウィンドウ伸縮・一時縮小と復元・Other files・狭い画面の回帰テストを追加する。
5. 実ブラウザーで寸法とスクリーンショットを確認し、型検査・lint・整形確認・全テスト・レイアウト検証・配布検証を実施する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
幅の単位をcookieに追加し、pxの希望幅と制約下での表示幅を分離した。初回・既存割合設定の換算は初めて960px以上でペインを開くまで待ち、狭い画面で保存値を上書きしない。矢印キーは20px刻みとし、読み上げにpixelsを付けた。

検証: pnpm typecheck、pnpm lint、pnpm format:check、pnpm test（17ファイル・234テスト）、pnpm benchmark:layout 1000（1000ノード、約1000ms）、pnpm test:pack はすべて成功。ビルドには500kB超のチャンク警告が残る。

実ブラウザー: ドラッグで800pxへ変更し、1440→1800pxで800px維持、1100pxで774pxへ一時縮小、Other filesを開くと494pxかつグラフ320pxを確認。Other filesの開閉アニメーション完了を待って寸法を検証した。390pxでは全幅・グラフinert・リサイザー非表示となり、1800pxへ戻すと800pxへ復元。再読み込み後も800pxを維持。1500px画面でEndにより1174px（70%超）まで拡大でき、2560px画面で1920px上限を維持。旧60%設定は1400px画面で840pxへ換算し、1800pxで再読み込みしても840px維持。390px起動では割合設定の換算を保留し、960pxへ広げた時点で576pxへ移行した。

実測結果とスクリーンショット: /private/tmp/changemap-pane-size-qa/（dimensions.json、migration.json、1440-fixed.png、1800-fixed.png、1100-fixed.png、390-full-width.png、1800-restored.png）。広い画面と狭い画面の画像を目視確認済み。

ship-changeで最新origin/mainのGoパッケージ表示を取り込んだ。タスク番号重複はbacklog doctorの修復により今回のタスクをTASK-56へ変更し、既存のGoタスクTASK-55は保持した。設定読み込みの既定値とフォーカス処理を両方維持して競合を解消し、Goパッケージ一覧とコード表示で幅保持・一時縮小・復元を共有する回帰テストを追加した。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
ウィンドウ伸縮時にコードペインの指定px幅を保つよう変更した。表示領域が不足する場合だけ一時縮小し、広げた際に保存幅へ戻す。初回45%と旧割合設定の移行、狭い画面の全幅表示、1920px上限、操作後の永続化を維持。全234テスト、型検査・lint・整形確認、1000ノードのレイアウト検証、配布検証、実ブラウザーでの寸法・移行・復元の確認が成功した。
<!-- SECTION:FINAL_SUMMARY:END -->
