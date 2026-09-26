---
id: TASK-28
title: PNG・JPEG・GIF・WebP のプレビューを実装する
status: Done
assignee:
  - '@mitani'
created_date: '2026-09-24 03:26'
updated_date: '2026-09-26 08:31'
labels: []
dependencies: []
documentation:
  - backlog/docs/doc-2 - architecture.md
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
変更前後の画像内容を固定スナップショットから安全に確認できるようにする。対象は PNG・JPEG・GIF・WebP。形式・サイズ・寸法を検証し、Diff と Before／After に画像または表示できない理由を示す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 対象形式・サイズ上限・安全な配信方法を評価し、実施可否と根拠を記録する。実施する場合は合意した範囲と受け入れ条件を確定する。
- [x] #2 PNG・JPEG・GIF・WebP を内容で判定し、固定スナップショットから安全に配信する。10 MiB、各辺 8,192 px、2,400 万画素の上限と、symlink・submodule の除外を検証する。
- [x] #3 Diff で変更前後、Before／After で各画像を表示し、片側だけ表示可能な場合や非対応・超過・破損時の理由を表示する。アニメーションと元の寸法表示を含む。
- [x] #4 サーバー・UI の回帰テスト、型検査、lint、整形、全テスト、レイアウト・配布検証を実行し結果を記録する。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 画像形式・寸法を実バイトから検証する純粋な判定処理を追加する。
2. 固定スナップショット専用の画像 API を追加し、MIME・上限・同一オリジン・スナップショット ID を守る。
3. コードペインへ前後画像のプレビューと各種フォールバックを追加する。
4. サーバーと UI の回帰テストを追加し、各種検証とドキュメント更新を行う。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
合意: PNG/JPEG/GIF/WebP、各画像10 MiB・各辺8192 px・2400万画素。Diffは前後併記、単独タブは片側表示。アニメーションはブラウザ標準再生、ズームなし。専用APIから固定スナップショットの実バイトを配信。形式は内容で判定する。

検証: pnpm test（13ファイル・134テスト成功）、pnpm typecheck、pnpm lint、pnpm format:check、pnpm benchmark:layout 1000（1000ノード・3000ルート、約694ms）、pnpm test:pack、git diff --check に成功。実ブラウザで64×64 PNGの変更前後がDiffで並び、寸法が表示されることを確認。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
PNG・JPEG・GIF・WebP のプレビューを実装。形式・容量・寸法・ファイルモードを検証した固定スナップショット専用APIから配信し、Diff/Before/Afterに表示する。表示不可時は理由を示す。利用ガイドと設計判断を更新。134テスト、静的検査、レイアウト・配布検証、ブラウザ表示確認に成功。
<!-- SECTION:FINAL_SUMMARY:END -->
