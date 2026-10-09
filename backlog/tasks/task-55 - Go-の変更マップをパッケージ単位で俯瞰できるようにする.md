---
id: TASK-55
title: Go の変更マップをパッケージ単位で俯瞰できるようにする
status: Done
assignee:
  - '@codex'
created_date: '2026-10-09 14:21'
updated_date: '2026-10-09 14:45'
labels: []
dependencies: []
type: feature
ordinal: 37000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Go のファイル間シンボル参照が多数表示され、変更がどのパッケージにまたがるか把握しづらい。grill-me で合意した俯瞰と詳細の役割を実装する。取得済みスナップショットの境界を保つ。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Go の初期マップは変更ファイルの直接の依存先・参照元をパッケージ単位に集約し、同パッケージ内の線を省略する。1パッケージでも自動でファイル表示に切り替えず変更ファイル数を表示する
- [x] #2 パッケージ選択で右側に変更・関連ファイル一覧を表示し、ファイル選択で差分・コードを閲覧できる。キーボードと狭い画面でも操作できる
- [x] #3 パッケージ間の線の追加・削除は前後のつながりの存在で判定し、内部の参照先変更や既存の別ファイルの参照を新規依存と誤表示しない
- [x] #4 Go のファイル単位表示への切り替えを残し、TypeScript の表示・差分閲覧を維持する
- [x] #5 削除・追加・パッケージをまたぐリネーム・混在言語を回帰テストで検証し、利用資料と画面検証を整備する
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 既存のスナップショットとファイル差分の型を維持し、表示専用の Go パッケージ集約モデルを追加する。
2. レイアウトとマップにパッケージノードを追加し、Go のパッケージ／ファイル切り替えを実装する。
3. 右側のパッケージ内ファイル一覧を既存の差分ペインにつなぎ、選択・閉じる・狭い画面の操作を整える。
4. 集約・依存差分・リネーム・混在言語と UI 操作の回帰テストを追加し、利用資料を更新する。
5. 型検査・lint・整形・全テスト・レイアウト・配布検証とブラウザーでの画面確認を実施する。

6. ship-change の依頼に従い、実装・テストと資料・スクリーンショットを意味単位でコミットする。コミット後の提出前検証を実行し、PR を作成して3 OS の CI と head を確認後に --merge でマージする。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
表示専用の map-model を追加し、スナップショット・HTTP API・解析境界を維持。Go はディレクトリごとの実装・テストを集約し、リネーム前後の所属を保持する。表示対象は変更ファイルに直接関係する参照だけ、依存差分の判定は解析済み Go ファイル全体の前後比較。Go の表示粒度は既存の workspace cookie に保存する。
検証: pnpm typecheck / lint / format:check / test（18ファイル・246テスト）/ benchmark:layout 1000（約668ms）/ test:pack が成功。ビルドの500kB超チャンク警告は継続。
実ブラウザー: 一時 Git リポジトリを使用。Go 6ファイルを3パッケージに集約し、TypeScript 2ファイルの表示を維持。パッケージ一覧→差分→一覧、表示切り替え、幅390pxでのEnter操作・フォーカス・マップへ戻る操作を確認。スクリーンショット: /private/tmp/changemap-go-view-qa/packages.png、files.png、narrow-package.png、narrow-diff.png。

ship-change の対象は今回実装した Go パッケージ表示のみ。最新 origin/main と一致する main から feat/task-55-go-package-map を作成。PR 用の画面資料を backlog/docs/assets/task-55-go-packages.png と task-55-go-packages-mobile.png に保存した。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Go の初期マップをパッケージ単位に集約し、変更ファイル数、右側の変更・関連ファイル一覧、差分への移動、ファイル表示への切り替えを追加。依存の追加・削除はパッケージ間のつながりで判定する。リネームと混在言語の回帰テスト、README・利用資料・用語集を更新。全246テスト、型・lint・整形、レイアウト、配布検証、デスクトップと狭い画面のブラウザー確認が成功。
<!-- SECTION:FINAL_SUMMARY:END -->
