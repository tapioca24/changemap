---
id: TASK-14
title: 初版のバージョンを設定しnpmへ公開する
status: To Do
assignee: []
created_date: '2026-09-23 14:06'
updated_date: '2026-09-24 03:51'
labels: []
dependencies:
  - TASK-13
documentation:
  - backlog/docs/doc-4 - rendering-performance.md
  - README.md
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
[当時の資料](https://github.com/tapioca24/changemap/blob/b9cb948563aba5bbcbb180692e20ca0b67e4c571/docs/handoff.md) の2026-09-23時点の残作業を移管する。初版の英語README・MITライセンス・ビルド・隔離導入検証はフェーズ5までに整備されたが、初版バージョン設定とnpm公開は未実施と記録されている。バージョン更新・npm公開には別途ユーザー指示が必要であり、このタスク登録を実行許可として扱わない。公開対象はフェーズ0〜5を統合した成果とし、着手時にパッケージ名の利用可否・公開権限・リリース手順を確認する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ユーザーの指示に基づく初版バージョンがパッケージ情報と必要な関連ファイルに反映されている
- [ ] #2 公開対象コミットのCI成功と配布tarballの隔離導入・CLI起動が確認されている
- [ ] #3 ユーザーの公開指示に基づきnpmへ初版が公開され、公開済みバージョンのクリーンな導入とCLI起動が確認されている
- [ ] #4 公開バージョン・対象コミット・公開先・検証結果が記録されている
<!-- AC:END -->
