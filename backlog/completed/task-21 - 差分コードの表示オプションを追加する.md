---
id: TASK-21
title: 差分コードの表示オプションを追加する
status: Done
assignee:
  - '@mitani'
created_date: '2026-09-24 06:04'
updated_date: '2026-09-24 18:09'
labels:
  - ui
  - diff
dependencies: []
type: enhancement
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
コードレビューでは変更の規模や状況に応じて比較方法を切り替えたい。差分表示でスプリット／ユニファイドと空白差分の無視を選択できるようにする。長い行は差分・変更前後の全文表示で常に折り返す。右ペインは広い画面でもグラフを圧迫しない幅に制限する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 スプリット表示とユニファイド表示を切り替えられる
- [x] #2 空白文字の差分を無視する表示に切り替えられる
- [x] #3 差分・変更前後の全文表示で長い行が常に折り返され、折り返しの設定項目は表示されない
- [x] #4 各表示オプションを切り替えても差分の内容と追加・削除の識別が正しい
- [x] #5 右ペインの幅は通常表示で画面幅の55%か1440pxの小さいほうを超えず、ドラッグ・キーボード操作・保存済み設定でも上限が守られる
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 取得済みスナップショットから Git -w の表示用パッチを生成する。
2. 左右の行・行番号・構文色・追加削除を保つスプリット表示を追加する。
3. スプリット／ユニファイドと空白無視をタブの上に置き、Cookie で保存する。長い行は常に折り返す。
4. 右ペインを min(画面幅の55%, 1440px) に制限し、操作・保存済み設定・aria 値に適用する。
5. 回帰テスト、実画面、レイアウト、配布を検証し、利用文書を更新する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
表示専用の空白無視パッチを取得済みスナップショットから Git -w で生成。元の変更ステータス・グラフは維持。スプリット表示は左右の行・行番号・構文色・追加削除を保持し、列幅を全行で揃える。設定はタブの上に配置し、既存の changemap.workspace Cookie でファイル切替とポート変更をまたいで保存。usage guide を更新。
検証: pnpm test 115件成功、pnpm typecheck・lint・format:check・git diff --check 成功。pnpm benchmark:layout 1000 は 1000ノード/3000経路・約656ms。pnpm test:pack は macOS/Node 24.14.1 の隔離環境で成功。ブラウザーでスプリット・折り返し・別ポートでの設定復元を確認し、左右列の境界が複数行で一致することを DOM の座標で確認。

仕様変更（ユーザー指定）: Wrap lines の切り替えを廃止し、Diff・Before・After の長い行を常時折り返す。旧 Cookie の wrapLines 値は読み込まない。前記の「3設定」「折り返し設定の復元」は旧仕様の履歴。
再検証: pnpm test 115件、typecheck・lint・format:check・git diff --check 成功。benchmark:layout 1000 は 1000ノード/3000経路・約711ms。test:pack は macOS/Node 24.14.1 の隔離環境で成功。ブラウザーで Wrap lines 操作がないこと、ユニファイド・スプリット・全文表示の white-space が pre-wrap であること、コード欄の scrollWidth が clientWidth と一致することを確認。

追加調整: 右ペインの上限を画面幅の50%と960pxの小さい方に統一。ドラッグ・キーボード操作、保存済み幅、aria 値に同じ上限を適用。ブラウザーで2560px画面では960px、1440px画面では720pxを確認。pnpm test 116件、typecheck・lint・format:check・git diff --check・test:pack 成功。benchmark:layout 1000 は1000ノード/3000経路・約639ms。

追加調整: 960px上限を1200pxへ変更。ブラウザーで2560px画面は1200px、1440px画面は720pxを確認。保存済み50%設定とキーボード操作のテストを更新。全116テスト、typecheck・lint・format:check・git diff --check・test:pack 成功。benchmark:layout 1000 は1000ノード/3000経路・約706ms。

追加調整: 最大幅を画面幅の55%と1440pxの小さい方へ変更。Cookie の幅読込上限も55%へ更新。ブラウザーで2560px画面は1408px、3200px画面は1440px、1440px画面は792pxを確認。全116テスト、typecheck・lint・format:check・git diff --check・test:pack 成功。benchmark:layout 1000 は1000ノード/3000経路・約594ms。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
スプリット／ユニファイドと空白無視を切り替えられ、長い行は常に折り返す。右ペインの上限を min(55%, 1440px) に調整し、保存済み幅とリサイズ操作にも適用。全116テスト、型検査・lint・整形、レイアウト・配布検証が成功。実画面で2560px幅は1408px、3200px幅は1440pxを確認。
<!-- SECTION:FINAL_SUMMARY:END -->
