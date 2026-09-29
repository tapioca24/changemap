---
id: TASK-16
title: docsのMVP作業資料を整理し未完了作業をBacklogへ移管する
status: Done
assignee:
  - '@codex'
created_date: '2026-09-23 14:25'
updated_date: '2026-09-24 03:54'
labels: []
dependencies: []
references:
  - README.md
  - CONTRIBUTING.md
documentation:
  - backlog/docs/doc-2 - architecture.md
  - backlog/docs/doc-3 - analysis-performance.md
  - backlog/docs/doc-4 - rendering-performance.md
type: docs
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
docsにはMVP構築時の計画、フェーズ別作業記録、引き継ぎ、測定値が残り、現在の仕様や残作業と過去の状態が混在している。例としてroadmapとphase-5にはPR未マージという古い記述がある一方、TASK-13は完了済み。永続的に保守する価値がある情報だけを残し、作業管理はBacklogへ集約する。README整理タスクと情報の移動先を整合させる。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 docs内の全ファイルについて、現行仕様・設計判断・再現に必要な情報と、一時的な作業資料が区別され、保持・統合・削除の判断が記録されている
- [x] #2 完了したMVPの計画や引き継ぎなど一時資料が整理され、永続文書には現在も有効な情報だけが矛盾なく残っている
- [x] #3 残作業を実装と既存Backlogに照合し、実施が決まっている未完了作業は重複なくタスク化され、移管先IDを追跡できる
- [x] #4 Deferred backlogなど未合意の拡張候補は実施決定済み作業と区別され、必要な候補はBacklogのDraft等に保存されている
- [x] #5 削除・統合対象へのREADME、AGENTS.md、ソース、Backlogを含む参照が確認され、必要なリンクが更新されている。Backlogの変更はCLI経由で行われている
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. docs全10ファイルと実装・既存Backlogを照合し、保持する設計判断・測定根拠と残作業を整理する。
2. 永続情報をBacklog文書へ統合し、実施決定済み残作業はTask、未合意候補はDraftへCLIで移管する。
3. 全ファイルの判断・移管先を本タスクへ記録し、参照を更新して既存docsを撤去する。
4. リンク・情報の整合、型検査・lint・整形・テスト・レイアウト・配布検証を実施して結果を記録する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 合意と整理結果

永続文書をbacklog/docsへ集約し、旧docs全10ファイルを撤去する。利用者向けusageは英語、設計・測定は日本語。測定根拠・条件・再現方法を保持し、時点別の作業経緯はGit履歴と完了タスクへ委ねる。コード変更は行わない。

| 旧docs内ファイル | 移管先 | 判断理由 |
| --- | --- | --- |
| design.md | usage・doc-2へ統合 | 現行仕様と判断理由を保持。古い未確定表記は実装と照合して除去。拡張候補はDraftへ。 |
| roadmap.md | doc-2・既存Tasks・Draftへ統合 | 完了フェーズの計画は重複のため削除。PRマージはTASK-13完了、公開はTASK-14で継続。 |
| plan.md | CONTRIBUTING・doc-2へ統合 | 単一パッケージ・対応環境・配布検証の判断を保持。フェーズ0の作業手順と重複ログを削除。Node 26はDRAFT-11。 |
| handoff.md | doc-2・3・4と既存Tasksへ統合 | 累積した時点別進捗、古い次フェーズ案内を削除。仕様・測定・残作業は各正本へ。 |
| phase-1.md | usage・doc-2へ統合 | 読み取り専用、取得検証、固定全文、一時bare diff、ポーリングの判断を保持。内部API一覧はソースを正本とする。 |
| phase-2.md | usage・doc-2・3へ統合 | 解析境界、方式比較、採用根拠、測定目標・値・再現条件を保持。大規模実測の不足はTASK-17。 |
| phase-3.md | doc-2へ統合 | 前後の同一性・IDの有効範囲・rename両端の正規化を保持。完了手順と重複検証ログを削除。 |
| phase-4.md | usage・doc-2へ統合 | Dagre採用理由、辺経路、設定保存、応答競合、CSPの判断を保持。検証経緯は完了タスクとGit履歴へ。 |
| phase-5.md | doc-2・4へ統合 | 性能目標、測定条件・方法・値・限界を保持。古いPR未マージ表記と完了手順は削除。 |
| phase-5-measurements.json | doc-4のJSONブロックへ移管 | 全生データを保持し、JSONとして元データと一致することを検証。 |

文書ID: doc-1=usage、doc-2=architecture、doc-3=analysis-performance、doc-4=rendering-performance。

## 残作業と候補の照合

- TASK-1〜12の実装はsrc/git・analysis・graph・review・server・ui・config、tests、scriptsと照合。roadmapのCLI境界、TOML/XDG、解析対応、レイアウト・辺表示、通知通信、Node対応範囲は実装済みで再タスク化しない。
- PRマージはTASK-13の完了記録と整合。バージョン・公開・公開名の確認は既存TASK-14へ集約し、新規作成・公開実行はしない。
- 実リポジトリの補助測定のうち大規模プロジェクトへの拡大は記録がなく、TASK-17へ移管。既存のTASK-12は合成グラフによる描画測定であり重複しない。
- Deferred backlogの8項目はDRAFT-1〜9へ移管。画像=DRAFT-1、PR/MR=DRAFT-2、行コメント・AIコピー=DRAFT-3、追加展開=DRAFT-4、集約・フィルター=DRAFT-5、監視=DRAFT-6、プロジェクト設定=DRAFT-7、独自テーマ=DRAFT-8、Go=DRAFT-9。設定とテーマは別候補へ分割した。
- その他の条件付き候補: 別配置方式・worker=DRAFT-10、Node 26のサポート検討=DRAFT-11。TASK-15で発見された古いCLIヘルプはDRAFT-12。コード修正の実施決定はしていない。
- 別々のグラフ・コードテーマ、構文ハイライト、CLIテーマ上書き、複数パッケージ化などは現在の非対応範囲または必要時検討の記述であり、実施合意や独立した拡張要望がないため新規Taskを作らない。

## 参照の移行

READMEのusageリンクは維持。CONTRIBUTINGとAGENTSの現行文書案内を更新。ソース・テスト・スクリプトに旧docsへの文書参照はない。TASK-4・7〜14の文書メタデータを更新し、過去の検証証拠への参照は削除前commit固定URLに変更する。

Backlog 1.51.0のmilestone CLIには説明文の編集機能がない。m-2〜5の完了マイルストーンに残る旧docsの平文参照は当時の参照として保持し、本表で移管先を追跡する。現行文書へのリンクとして使わず、元資料は以下の固定commitから参照できる。BacklogのMarkdownは直接編集していない。

[整理前のdocs一覧](https://github.com/tapioca24/changemap/blob/b9cb948563aba5bbcbb180692e20ca0b67e4c571/docs)

検証（2026-09-24、macOS / Node.js 24.14.1）: typecheck・lint・format:check成功。全テストは初回81成功/17失敗（sandboxのlisten EPERM）、制限外の再実行で全98成功。benchmark:layout 1000は1,000ノード/3,000経路・約711ms・ピーク約365MiBで成功。空のstore/cacheによるtest:pack成功。ローカルMarkdownリンク33件と履歴URLのGitオブジェクトの存在、移管した生測定値のJSON一致、docs撤去を確認。backlog doctorでID重複・自己依存・循環なし。git diff --check成功。コード・テスト・パッケージ設定の変更なし。今回の他OS CI・ブラウザ性能再測定は未実施。既存ステージ済みTASK-16は保持し、コミット・公開は行っていない。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
旧docs全10ファイルを整理し、現行仕様は既存usage、設計判断と測定根拠はdoc-2〜4へ集約。大規模実プロジェクトの補助測定をTASK-17、未合意候補をDRAFT-1〜12へ移管した。既存公開タスクTASK-14は維持。参照を更新し、CLIで説明を編集できない完了マイルストーンの旧平文参照は移管表で追跡する。98テスト・静的検査・配置・隔離配布検証、33ローカルリンク、JSON一致、Backlog整合を確認。
<!-- SECTION:FINAL_SUMMARY:END -->
