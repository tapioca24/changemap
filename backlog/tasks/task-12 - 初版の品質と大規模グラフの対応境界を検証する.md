---
id: TASK-12
title: 初版の品質と大規模グラフの対応境界を検証する
status: Done
assignee: []
created_date: '2026-09-23 07:10'
updated_date: '2026-09-24 03:51'
labels: []
milestone: m-5
dependencies:
  - TASK-11
documentation:
  - backlog/docs/doc-4 - rendering-performance.md
ordinal: 11000
---

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 全入力モードの配布CLIとUI状態遷移の統合テストを補強する
- [x] #2 合意した100/1,000ノードの性能目標と10,000ノードの限界を測定・記録する
- [x] #3 配置失敗時も固定コードの閲覧を維持する
- [x] #4 隔離配布検証と英語READMEの初版範囲を整える
- [x] #5 今回の変更に対する3 OS・2 Node版のCI成功を確認する
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
全98テスト・型・lint・build・隔離配布がmacOSで成功。1,000ノード/3,000辺の初期描画781–826ms、操作43ms以下。10,000ノードは配置スタック上限。ファイル選択からコード閲覧を維持する。実装コミット `4d09593` をpush済み。[CI run 35848465588](https://github.com/tapioca24/changemap/actions/runs/35848465588)でLinux/macOS/Windows × Node.js 24.11.0/24.xの全6ジョブ成功を2026-09-23に確認。詳細は[当時の資料](https://github.com/tapioca24/changemap/blob/b9cb948563aba5bbcbb180692e20ca0b67e4c571/docs/phase-5.md)。
<!-- SECTION:NOTES:END -->
