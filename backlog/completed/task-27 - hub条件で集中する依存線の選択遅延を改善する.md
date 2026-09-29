---
id: TASK-27
title: hub条件で集中する依存線の選択遅延を改善する
status: Done
assignee:
  - '@codex'
created_date: '2026-09-25 14:27'
updated_date: '2026-09-25 14:34'
labels:
  - graph
  - ui
dependencies: []
references:
  - backlog/docs/doc-4 - rendering-performance.md
  - 'https://github.com/tapioca24/changemap/pull/13'
type: bug
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
1,000ファイルのhub形状では1ノードに999本の依存線が集中し、選択操作が約1.4秒かかる。TASK-26のgrouped改善後も残る問題。端のフェードと全関連線の円の移動を維持する描画方式を優先して検証する。簡略化が必要なら適用条件と表示上の変更を明示する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 1,000ファイル・999辺のhub条件で選択・テーマ変更・ホバーが各300ms以内となる
- [x] #2 選択とホバーの優先・復帰が正しく、対象の全関連線で円が約80px/秒・約120px間隔で動く
- [x] #3 円は線の両端で自然に出入りし、動きを減らす設定では消え、強調線は残る
- [x] #4 grouped・layeredと変更状態を含む表示で線・矢印・ラベルの薄さや色に退行がない
- [x] #5 測定結果と表示仕様の変更があれば適用条件を描画性能資料に記録する
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. hubの現行選択遅延を再現し、マスクのみ変更した試作でも300ms未達と確認する。
2. 前進する曲線は円の線色に進行軸の線形グラデーションを使い、短い線と折り返し線はSVGマスクを維持する。
3. 発光フィルターを太い半透明線の重ね描きに替え、円の移動・両端フェード・全関連線の強調を維持する。
4. 実ブラウザーでSVGの端の透明度・優先と復帰・色・動きの抑制を確認し、hub反復、grouped・layered・変更状態と必須チェックの結果を資料に記録する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
hub変更前1,374.8ms、グラデーションのみ約946.6ms、発光の重ね描き後は3回のhub測定で選択最大97.1/92.6/96.0ms。999辺の円移動、ホバー優先と復帰、両テーマ、動きを減らす設定、SVGフェードの実描画（不透明度3/255/0）をブラウザーで確認。grouped/layered/変更状態混在も300ms以内。全129テスト、型、lint、整形、配置layered/grouped、配布tarball、diff --checkが成功。見た目の差と測定の限界はdoc-4に記録。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
hubで999本の円を動かす選択操作を約1.4秒から最大97.1msへ改善。前進する線の端は線形グラデーションでフェードし、発光は半透明線の重ね描きへ変更。hubの3回測定、grouped・layered・変更状態混在のブラウザー検証、全129テストと静的・配置・配布検証が成功。表示差と測定範囲はdoc-4に記録。
<!-- SECTION:FINAL_SUMMARY:END -->
