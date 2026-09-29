---
id: TASK-15
title: READMEを利用者向けに整理しライセンスの案内を統一する
status: Done
assignee:
  - '@codex'
created_date: '2026-09-23 14:25'
updated_date: '2026-09-24 02:24'
labels: []
dependencies: []
references:
  - README.md
  - LICENSE
  - package.json
documentation:
  - backlog/docs/doc-1 - usage.md
  - CONTRIBUTING.md
type: docs
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
READMEに内部APIのデータ構造、MVP開発経緯、詳細な測定記録、開発用コマンドが混在し、利用者が導入と使い方を把握しにくい。利用者に必要な情報を中心に再構成し、いつnpm公開してもそのまま使える完成したREADMEにする。現在は未公開だが、開発中・npm未公開という一時的な状況説明は不要であり、公開時の削除や書き換えを前提とする案内を残さない。ルートのLICENSEにはMIT本文がすでにあり、READMEのLicense節はリンクのみであるため、新規切り出しではなくこの構成の維持と配布設定の整合を確認する。npm公開自体は既存TASK-14の範囲。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 英語READMEからツールの目的、必要環境、npmからの導入方法、代表的な比較コマンド、起動と終了方法を把握でき、公開時に導入案内を書き換える必要がない
- [x] #2 利用者向けの設定と重要な制約は残し、内部API仕様、フェーズ別進捗、詳細な測定記録など利用に不要な情報が本文から整理されている
- [x] #3 保守に必要な開発情報は適切な永続文書に集約され、不要な情報は削除されている
- [x] #4 ライセンス本文はルートLICENSEを正本とし、READMEの短い案内、package.jsonのlicense、配布物のLICENSEが整合している
- [x] #5 This project is in development and has not been published to npm. などの開発中・未公開を説明する一時的な断り書きがない。コマンドとリンクは公開予定のパッケージ名・配布仕様と整合し、公開前に実行できないレジストリ経由の導入確認はTASK-14で行う
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. READMEを英語の初回利用ガイドへ再構成し、npx changemap .、基本比較、設定、主要な制約、MIT案内を記載する。
2. 詳細仕様をBacklog CLIでusage文書へ、開発・検証手順をルートCONTRIBUTING.mdへ移す。内部API説明を削除し、既存docs全体の整理はTASK-16に残す。
3. 小さなTypeScriptサンプルを実際のUIで表示してスクリーンショットを撮影し、READMEに掲載する。
4. 文書リンク・CLI仕様・ライセンス配布を確認し、型検査・lint・整形・テスト・レイアウト・配布検証を実行する。
5. 検証結果を記録し、差分をレビュー可能な状態で提示する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
READMEを307行から114行へ整理。利用者向け導入はnpx changemap .、継続利用はnpm install --global。Backlog CLIの命名規則により利用ガイドはbacklog/docs/doc-1 - usage.mdとして作成。CONTRIBUTING.mdに開発・配布・測定手順を集約し、既存測定記録への参照を維持した。内部API説明は削除。TASK-16の既存docs全体整理には着手していない。
一時Gitリポジトリの4ファイルで依存先の切替を実際のUIに表示し、1440×1000のスクリーンショットを.github/assets/changemap.pngへ保存・目視確認。ブラウザ設定は一時XDG_CONFIG_HOMEに隔離。
macOS / Node.js 24.14.1でtypecheck・lint・format:check・98テスト・benchmark:layout 1000・test:packが成功。初回テストはサンドボックスのlisten EPERMで17件失敗し、制限外で再実行して98件成功。リンク先13件の存在を確認し、tarballのLICENSEとREADMEが原本とバイト一致、license=MITと第三者ライセンス同梱も確認。
READMEのGitHubリンク・画像URLはmainへの反映後に利用可能。公開レジストリ経由のnpx導入確認は合意どおりTASK-14に残す。今回の変更に対する他OSのCIは未実行。CLI --help末尾のDependency graphs are planned.は既存の古い記述として発見したが、本タスクでは変更していない。
レビュー用にdifitを起動。既存のTASK-15・16のステージ済み内容を保持し、追加ファイルはdifitがintent-to-addとして登録。コミット・公開は未実施。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
英語READMEを初回利用向けに再構成し、npx導入・基本比較・操作・設定・主要制約と実画面画像を掲載。詳細仕様をBacklog文書、開発手順をCONTRIBUTING.mdへ分離。MITの案内と配布物を照合し、全98テスト・静的検査・レイアウト・隔離配布検証が成功。公開はTASK-14、既存docs全体整理はTASK-16に残す。
<!-- SECTION:FINAL_SUMMARY:END -->
