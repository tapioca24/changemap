---
id: TASK-57
title: 共通祖先からのレビュー比較を選べるようにする
status: Done
assignee:
  - '@codex'
created_date: '2026-10-09 15:13'
updated_date: '2026-10-09 16:10'
labels: []
dependencies: []
ordinal: 38000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitLab MR のレビューで、ブランチ先端同士を直接比較すると target 側だけの変更まで変更ファイルに含まれる。既存の直接比較を維持しながら、手元の Git 参照から MR 向けの比較範囲を選択できるようにする。GitLab API 連携は対象外。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 2つの Git 参照と --merge-base を指定すると共通祖先から第1引数の先端までを比較する
- [x] #2 フラグなしの既存比較と変更ファイルの直接近傍表示を維持する
- [x] #3 2参照以外の指定や共通祖先が存在しない場合は明確なエラーになる
- [x] #4 更新検知と明示更新で両参照を再評価し、取得失敗時は既存スナップショットを保持する
- [x] #5 回帰テスト、CLI ヘルプ、README と利用ガイドを更新する
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. CLI で --merge-base を2参照比較に限定して受け付ける。
2. 解決済みコミットの共通祖先を before に使い、両参照の更新検知とスナップショット保持を維持する。
3. 分岐後の target 側変更、更新、共通祖先なし、無効入力を回帰テストで検証する。
4. README・CLI ヘルプ・利用ガイドに比較範囲とローカル参照の条件を記載する。
5. 型検査・lint・整形・全テスト・レイアウト・配布検証を実行して結果を記録する。

6. ship-change で専用ブランチにコミットし、最新 main の統合・PR 作成・CI 検証・マージまで進める。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
検証: pnpm typecheck、pnpm lint、pnpm format:check、pnpm test（18ファイル・259テスト）、pnpm benchmark:layout 1000（1,278.94 ms）、pnpm test:pack が成功。git diff --check も成功。
対象テストの初回実行では localhost listen がサンドボックスの EPERM で失敗したため、必要な権限で全テストを再実行して成功。配布検証もネットワークと localhost 起動に必要な権限で実行。
分岐 fixture で git diff main...feature と変更ファイル集合が一致し、target 側だけの追加・変更が除外されること、未変更の直接依存が表示されることを確認。両参照の移動・共通祖先再計算・参照消失や共通祖先なしの更新失敗時の保持と復帰・固定コミットID・複数共通祖先エラーを回帰テストで確認。複数の最良共通祖先がある場合は Git が任意の1つを選ぶことを避けるためエラーとし、利用ガイドに明示した。
ビルド時には既存 UI の 500 kB 超チャンク警告が出るが、ビルドと全検証は成功。

最新 origin/main の取り込みに伴い、利用ガイドは共通祖先比較の説明とコードペイン幅保持の説明を両方保持して Backlog CLI で統合した。main 上の別タスクと TASK-56 が重複したため、backlog doctor --fix --yes により今回のタスクだけを TASK-57 に変更した。既存 TASK-56 の画像パスと履歴中の参照は元の幅保持タスクを指すため維持した。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
2参照比較に --merge-base を追加し、共通祖先から第1引数の先端までを取得・解析する。既存の直接比較と直接近傍表示を維持し、両参照の更新検知・更新失敗時の保持を検証。README、CLI ヘルプ、利用ガイドを更新。全259テスト、型検査、lint、整形確認、1,000ノードのレイアウト検証、隔離環境の配布検証が成功。
<!-- SECTION:FINAL_SUMMARY:END -->
