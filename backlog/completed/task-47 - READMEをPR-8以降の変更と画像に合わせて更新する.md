---
id: TASK-47
title: 'READMEをPR #8以降の変更と画像に合わせて更新する'
status: Done
assignee:
  - '@tapioca24'
created_date: '2026-09-26 12:45'
updated_date: '2026-09-26 13:54'
labels: []
dependencies: []
references:
  - README.md
  - .github/assets/changemap.png
priority: medium
type: docs
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-15で利用者向けに整理したREADMEを、その後の実装・仕様変更に追随させる。Pull Request #8以降を確認し、READMEに反映すべき機能、コマンド、設定、制約などの変更が漏れていないか調査する。掲載画像も現行UIと利用手順に合っているか確認し、必要な差し替え・追加・説明の修正を行う。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 PR #8以降の内容を確認し、READMEに反映が必要な変更が反映されている
- [x] #2 READMEに記載するコマンド、設定、仕様、制約が現在の実装と一致し、誤記や古い案内がない
- [x] #3 README掲載画像を現行UI・説明と照合し、必要な更新または追加を行い、画像リンクと代替テキストが正しい
- [x] #4 関連するリンクと画像を確認し、READMEから参照できる
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. PR #8〜#18 と現行実装を README・usage guide に照合し、誤記と説明不足を特定する。
2. 現行 UI で依存関係の変化が伝わる画面を撮り直し、README の画像・代替テキスト・リンクを更新する。
3. README の操作説明を整理し、対応範囲やスナップショットなど誤解しやすい仕様を正す。npx の例と PR #18 のテーマ値表を維持する。
4. 記述・画像・リンクを実装と照合し、必要な確認結果をタスクに記録する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PR #8〜#18 を first-parent 履歴と変更ファイルで照合。#10〜#14 のレイアウト・表示変更は新しいメイン画像に反映し、#15 の画像プレビュー対応範囲と #12 の空白無視がグラフへ影響しない点を README に記載。#16 のパスコピーと #11 の構文色は画像で確認でき、#17 のエディタ案内、#18 の24テーマ設定表は現行記述を維持。
1600×900 の現行 UI を一時 Git リポジトリで撮影し、checkout.ts の変更、追加・削除の依存線、現行コードペインを目視確認。CLI ヘルプと設定 ID を実装に照合。README の画像・4リンクはローカル参照先がすべて存在。pnpm build、pnpm exec oxfmt --check README.md、git diff --check が成功。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
PR #8〜#18 と現行実装に照らし、README の説明を誤解しやすい仕様へ絞り、画像プレビューと空白無視の動作を修正。現行 UI のメイン画像を撮り直し、代替テキストと npx の例を更新した。画面をブラウザーで確認し、CLI ヘルプ・テーマ ID・参照先5件を照合。ビルド、README 整形確認、git diff --check が成功。
<!-- SECTION:FINAL_SUMMARY:END -->
