---
id: TASK-23
title: 依存関係のエッジを曲線で読みやすくする
status: Done
assignee:
  - '@tapioca24'
created_date: '2026-09-24 06:04'
updated_date: '2026-09-25 06:23'
labels:
  - graph
  - ui
dependencies: []
type: enhancement
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
現在の依存関係エッジは直線的で、折れ曲がりが不自然に見えることがある。依存の流れを追いやすい、より柔らかな曲線の矢印表現に改善する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 依存関係の矢印が曲線で表示され、接続元と接続先を追いやすい
- [x] #2 矢印の向きと接続先が明確に保たれる
- [x] #3 ノード数や配置が異なるグラフでもエッジが視認できる
- [x] #4 同じ経路に集中する依存線はずらして表示され、個々の接続を追える
- [x] #5 エッジまたはファイルノードのホバーで関連する依存線が強調され、動きを減らす設定でも判別できる
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. TASK-22 の階層配置を保ち、辺の経路とSVG描画を曲線化する。共通の接続元・接続先から出る線には安定した扇形のずれを与える。
2. エッジのホバーではその線、ファイルノードのホバーでは接続する線を強調し、他の線を抑える。アニメーションは prefers-reduced-motion に従う。
3. 曲線の両端・方向・重なり・ホバー動作を回帰テストと実ブラウザーで確認する。型・lint・整形・全テスト・配置／描画性能・配布検証も行う。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
最初にDagreの全経路点を通る曲線を試したが、逆向きの辺が輪のように膨らんだ。端点を固定した三次Bezier曲線と、逆向きだけ外側を回る二本の曲線へ修正した。

検証: 曲線の端点・四方向・扇形の分離・逆向き経路を tests/edge-path.test.ts で確認。実ブラウザーでノード/エッジのホバー強調、prefers-reduced-motion でアニメーション停止を確認。100ファイル/41ディレクトリ/300辺の描画ベンチマーク成功（初期153ms、選択とテーマ各33ms程度、ホバー34ms以下）。1,000ファイル/41ディレクトリ/3,000辺は初期描画370-406msと配置85msだが、選択・テーマ・ホバーの一部が300ms目標を超過（最大約485ms）。更新範囲を縮める案も改善せず戻した。この高密度条件の応答性は制約として残る。pnpm test は129件成功、typecheck、lint、format:check、benchmark:layout 1000、test:pack、backlog doctor、git diff --check 成功。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
依存線を端点を保つBezier曲線にし、接続元・接続先で扇形にずらした。エッジとファイルノードのホバーで関係する線を強調し、動きを減らす設定では静止表示にした。129テスト、実ブラウザー、100ファイル/41ディレクトリの描画測定、型・lint・整形・配布検証で確認。1,000ファイル/41ディレクトリ/3,000辺では一部操作が300ms目標を超える制約を記録した。
<!-- SECTION:FINAL_SUMMARY:END -->
