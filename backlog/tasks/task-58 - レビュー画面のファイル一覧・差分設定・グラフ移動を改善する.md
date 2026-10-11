---
id: TASK-58
title: レビュー画面のファイル一覧・差分設定・グラフ移動を改善する
status: Done
assignee:
  - '@codex'
created_date: '2026-10-11 03:28'
updated_date: '2026-10-11 05:09'
labels: []
dependencies: []
ordinal: 39000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Other files が横幅を圧迫し、頻繁に変える差分表示設定にダイアログ操作が必要。コードの文字サイズとエッジ上からのグラフ移動も改善する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Other files が依存グラフ内の最下部の専用グループに入り、ズーム・移動・ファイル選択に対応する
- [x] #2 コードタブ右側で Unified / Split を1クリックで切り替え、Ignore whitespace を変更できる
- [x] #3 10〜24pxのコードフォント設定が反映され再起動後も保持される
- [x] #4 エッジ上のドラッグ移動とホバー強調が保たれる
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Other files をグラフのノードとして専用グループに配置し、外側の一覧と開閉設定を撤去する。
2. Diff layout を Unified / Split のラジオ切り替えに変更する。
3. 配置・ファイル選択・1クリック切り替えの回帰テストと実ブラウザ検証を行う。
4. 既存のフォント・エッジ修正を含む全検証と画像を更新する。

5. ship-change: エッジ修正、表示・設定改善、記録を意味単位でコミットし、提出前検証とGitHubチェックを通してPRをマージする。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実ブラウザでエッジ上の80×60pxドラッグによりビューポートが同量移動すること、ホバー強調の維持、Split と空白設定の直接操作、18px反映を確認。390px幅で横のはみ出しなし。画像: backlog/docs/assets/task-58-{desktop,settings,mobile-code,mobile-graph}.png。ドラッグ禁止クラスの無効化はライブラリのセレクタ例外を起こすため、エッジに Pointer Capture を持たせる方式を採用。

最終検証: pnpm test 19ファイル277件成功。pnpm typecheck / lint / format:check、pnpm benchmark:layout 1000、pnpm test:pack 成功。エッジの移動・終了・キャンセル・非主ポインタ・右クリックの回帰テストを追加。HTTPテストと配布検証はサンドボックスの待受・DNS制限のため権限付きで再実行し成功。Viteの500kB超チャンク警告あり。最終ブラウザ確認で保存後の18px・Split・Ignore whitespaceを確認。

ユーザーの意図を反映し、Other files をキャンバス外の折りたたみ一覧から、React Flow の専用親ノードとファイルノードへ変更。全方向・グループ有無で依存ノード最下端より下に配置し、依存エッジを追加しない。未解析のみの比較とキーボード選択も回帰テストで検証。Diff layout は Unified / Split のラジオ切り替えに変更し1クリックで反映。旧listOpen設定は読み込みを終了。最終検証: 全19ファイル282件成功、型検査・lint・整形・1000ノードレイアウト・配布検証成功。実ブラウザでグラフ内配置、README選択・選択強調、Unified/Splitの往復切り替え、390px幅を確認。

実ブラウザでグラフを100×60px移動すると Other files グループも100×60px移動することを確認。最終画像: task-58-graph.png、task-58-desktop.png、task-58-settings.png、task-58-mobile-code.png、task-58-mobile-graph.png。

Diff layout の各ラジオにアイコンを追加（Unified: TextAlignStart、Split: Columns2）、cursor: pointer を指定。装飾アイコンは aria-hidden としラジオの名前を維持。型検査・lint・対象整形・Appの24テスト・ビルド成功。実ブラウザで両ラジオの pointer、アイコン表示、Split 切り替えを確認し desktop 画像を更新。

ship-change の提出前検証: 全282件のテスト、型検査、lint、整形、1000ノードレイアウト、配布検証に成功。実装はエッジ修正と表示・設定改善に分けてコミット。READMEはレビュー指摘に従いUI操作の自明な案内を追加しない。ビルドの500kB超チャンク警告は残存。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Other files を依存グラフ内の最下部の専用グループへ統合し、ズーム・パン・ファイル選択・選択強調に対応。キャンバス外の一覧と開閉設定を撤去。Diff layout は Unified / Split のラジオ切り替えに変更し1クリックで反映。フォント設定とエッジのドラッグ対応を維持。全282件のテスト、型検査、lint、整形、1000ノードレイアウト、配布検証成功。実ブラウザでファイル選択、ラジオ往復、グラフ移動の連動、390px幅を確認し画像5枚を保存。
<!-- SECTION:FINAL_SUMMARY:END -->
