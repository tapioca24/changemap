---
id: TASK-14
title: 初版のバージョンを設定しnpmへ公開する
status: In Progress
assignee:
  - '@codex'
created_date: '2026-09-23 14:06'
updated_date: '2026-09-29 13:23'
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
- [x] #1 ユーザーの指示に基づく初版バージョンがパッケージ情報と必要な関連ファイルに反映されている
- [ ] #2 公開対象コミットのCI成功と配布tarballの隔離導入・CLI起動が確認されている
- [ ] #3 ユーザーの公開指示に基づきnpmへ初版が公開され、公開済みバージョンのクリーンな導入とCLI起動が確認されている
- [ ] #4 公開バージョン・対象コミット・公開先・検証結果が記録されている
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. changemap@0.1.0 を latest として手動公開する合意を記録し、公開権限と現在の CI を確認する。
2. 初版バージョンを設定し、型検査・lint・整形・全テスト・レイアウト・隔離配布検証を実行する。
3. 変更をコミット・push し、公開対象コミットの CI 成功を確認する。
4. 検証済み tarball を npm に公開し、公開版のクリーン導入・CLI 起動を検証する。
5. v0.1.0 タグと GitHub Release を作成し、公開先・コミット・検証結果を記録する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ユーザーとの grilling で、現行コードを基準とする初版、バージョン 0.1.0、スコープなし changemap、latest 公開、ローカル手動公開、必要なコミット・push、v0.1.0 タグと GitHub Release 作成まで合意。公開自動化は対象外。

package.json を 0.1.0 に更新。CLI は package.json からバージョンを取得し、CLI テストと隔離導入の --version 確認が成功。ローカル Node.js v24.14.1 / Go 1.26.5 で typecheck、lint、format:check、全205テスト（16ファイル）、benchmark:layout 1000（約665ms）、test:pack が成功。Vite は既存の500kB超チャンク警告を出すがビルド成功。GitHub 認証と main の既存 CI 成功を確認。npm は401のためブラウザ再ログイン待ち。
<!-- SECTION:NOTES:END -->
