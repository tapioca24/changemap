---
id: TASK-2
title: 配布tarballを隔離環境で検証する
status: Done
assignee: []
created_date: '2026-09-17 11:22'
updated_date: '2026-09-17 11:32'
labels: []
milestone: m-0
dependencies: []
ordinal: 2000
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ソース・開発依存なしの隔離インストールでbinのヘルプとバージョンが動く
- [x] #2 クリーンなコピーで固定ロックファイルの導入と全チェックが成功する
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
macOS / Node.js 24.14.1のクリーンな一時コピーで固定ロック導入と全チェック成功。tarballをリポジトリ外へprod/offline/ignore-scriptsで導入し、開発依存不在とインストール済みbinのhelp/versionを確認。
<!-- SECTION:FINAL_SUMMARY:END -->
