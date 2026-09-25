---
id: TASK-22
title: 依存グラフをディレクトリ単位でグルーピングする
status: Done
assignee:
  - '@tapioca24'
created_date: '2026-09-24 06:04'
updated_date: '2026-09-24 19:06'
labels:
  - graph
  - ui
dependencies: []
references:
  - 'https://github.com/ysk8hori/typescript-graph'
type: enhancement
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ファイルノードがフラットに並ぶと、どのディレクトリに属しているかを把握しにくい。ディレクトリのまとまりを視覚化し、入れ子の構造を追いやすくする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ファイルノードが所属ディレクトリのグループ内に表示される
- [x] #2 ネストしたディレクトリ構造を階層として識別できる
- [x] #3 ディレクトリグループを導入しても依存関係の接続とファイル選択が利用できる
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 表示対象ファイルのパスから、必要なディレクトリと親階層を生成する。リネームは新パス、削除は旧パスを使い、直下のファイルはグループ外に置く。
2. ディレクトリ階層を下から順に配置する。各階層では直下のファイルと子ディレクトリを Dagre に渡し、階層をまたぐ依存は代表ノード間の辺として扱う。最終ファイル座標から依存線の経路を作り、React Flow の親子ノードで表示する。
3. 既存テーマになじむグループ枠と階層名を実装し、ファイルカードの重複パス表示を整理する。ファイル選択・表示位置補正・四方向の配置を維持する。
4. 階層・移動・削除・大量の階層間依存・選択の回帰テストを追加し、型・lint・整形・全テスト・1,000ノード配置・配布・ブラウザー表示を確認する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
複合 Dagre に多数の階層間依存を与えると rectangle intersection 例外が発生したため、階層ごとの配置へ変更。

検証: 入れ子・移動・削除・ルートファイル・四方向の辺端点を tests/ui.test.ts で確認し、120ファイル/8兄弟ディレクトリの多辺ケースでも全ノード・辺を確認。実ブラウザーで入れ子枠、依存線、ファイル選択からコード表示を確認し、コンソールエラーなし。pnpm test は全122件成功。pnpm typecheck、lint、format:check、git diff --check、test:pack、backlog doctor 成功。pnpm benchmark:layout 1000 は1,000ファイル/3,000辺・約696ms。ブラウザー測定は100ファイル約140ms、1,000ファイル約743msで初期描画目標内、選択・テーマ変更も300ms以内。macOS / Node.js 24.14.1 / Chromium 153 で実施。階層をまたぐ線は密集時に重なり得る。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
表示対象ファイルをディレクトリの入れ子枠に配置し、ファイル間の依存線と選択を維持した。階層ごとの配置により、多数の階層間依存で複合Dagreが例外になるケースを回避。全122テスト、静的検査、1,000ファイル描画・配置測定、配布検証、実ブラウザー表示で確認した。
<!-- SECTION:FINAL_SUMMARY:END -->
