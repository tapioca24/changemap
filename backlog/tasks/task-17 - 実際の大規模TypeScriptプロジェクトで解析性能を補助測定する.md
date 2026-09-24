---
id: TASK-17
title: 実際の大規模TypeScriptプロジェクトで解析性能を補助測定する
status: To Do
assignee: []
created_date: '2026-09-24 03:26'
labels: []
dependencies: []
references:
  - scripts/analysis-benchmark.ts
documentation:
  - backlog/docs/doc-3 - analysis-performance.md
type: spike
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
旧フェーズ2資料は実リポジトリでの補助測定を合意し、大規模プロジェクトへの拡大を後続へ残していた。記録にある実リポジトリは21/28 TSファイルで、10,000ファイル測定は約143 bytes/ファイルの合成データ。TASK-12の描画測定は合成ReviewSummaryであり、実プロジェクトの解析性能を検証したものではない。既存の測定を一般的な性能保証と誤認しないよう不足する測定を補う。TASK-16から移管。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 代表的な大規模TypeScriptリポジトリについて対象commit・差分・設定・ファイル数・総バイト数・参照数と実行環境が再現可能な形で記録されている
- [ ] #2 Git取得と両状態の解析・近傍抽出を分離し、初回・同一プロセス再解析・ピークRSS・未解決状況が記録されている
- [ ] #3 合成fixtureの目標と実測との差、適用限界、必要な改善候補が記録され、結果を一般的な性能保証と扱っていない
<!-- AC:END -->
