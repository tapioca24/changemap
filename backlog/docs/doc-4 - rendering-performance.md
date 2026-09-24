---
id: doc-4
title: rendering-performance
type: other
created_date: '2026-09-24 03:26'
updated_date: '2026-09-24 03:53'
---
# グラフ配置・描画の性能測定

2026-09-23の測定記録。現在のツリーを再測定した値ではない。対象の実装commitは `4d0959338f94bf29503e6b8aa8a7a4307e301bac`。再現コマンドは [CONTRIBUTING.md](../../CONTRIBUTING.md)、方式の判断は [設計文書](<doc-2 - architecture.md>) を参照する。

## 測定目標

表示対象100ノード・300辺で初期表示1秒以内、1,000ノード・3,000辺で3秒以内、選択・テーマ変更300ms以内をユーザー承認済み。10,000ノードは限界測定とする。リポジトリ全体の解析ファイル数と、直接近傍抽出後の表示ノード数を区別する。

## 測定方法と結果

`pnpm build`後、`pnpm benchmark:rendering <nodes> [layered|chain|hub] [screenshot-path]`を実行する。依存は既存のagent-browserとChromiumを利用し、実行時依存は追加しない。専用のloopback fixture serverが実際のdist/uiと合成ReviewSummaryを配信する。ブラウザの初期描画はheadの計測スクリプト開始から、全ノード・辺のDOM準備と2回のrequestAnimationFrameまで。選択・テーマ変更は各5回、同じく2フレーム待って測る。Git取得・解析、GPU描画完了、実ユーザーのINPは含まない。

100/1,000ノードは新しいブラウザセッションで各3回。環境はApple M5、Darwin 25.6.0、Node.js 24.14.1、headless Chromium 153、1440×1000。測定値はこの文書末尾のJSONに保存。測定中の他プロセスをOSレベルで隔離してはいない。

| 形状            | ノード / 辺   | 初期描画       | 選択最大 | テーマ変更最大 |
| --------------- | ------------- | -------------- | -------- | -------------- |
| 階層（3回）     | 100 / 300     | 136.4–145.7 ms | 34.3 ms  | 33.9 ms        |
| 階層（3回）     | 1,000 / 3,000 | 781.6–825.6 ms | 34.6 ms  | 42.4 ms        |
| 依存鎖（1回）   | 1,000 / 999   | 310.5 ms       | 33.5 ms  | 33.7 ms        |
| 集中依存（1回） | 1,000 / 999   | 367.2 ms       | 37.6 ms  | 34.0 ms        |

最適化前の1,000ノードでは初期740.6 ms、選択最大154.8 ms・テーマ最大152.2 ms。最適化の効果は主に表示後の操作にある。初期描画の改善とは主張しない。集中依存のスクリーンショットを確認し、全体表示ではラベルが小さいことを確認した。ズーム・パンが必要であり、1,000ノードすべてを一画面で読めるという保証ではない。

10,000ノード・30,000辺はDagreのスタック上限で失敗した。修正前はブラウザ測定が25秒でタイムアウト。単体配置測定で435 ms後の `RangeError: Maximum call stack size exceeded`、NodeピークRSS 322.6 MiBを確認した。例外処理追加後は10,000ファイルの選択肢を維持し、31 msでコードを開けた。グラフの描画成功には数えず、benchmarkも終了コード1を返す。

`pnpm benchmark:layout 1000` は当日の測定で661 ms / Nodeピーク343 MiB。配置専用プロセスのRSSでありブラウザメモリではない。`pnpm benchmark:analysis 100 10000` は100ファイル37/13 ms・136 MiB、10,000ファイル655/589 ms・741 MiBだった。解析は既存の約143 bytes/ファイルのfixtureで、表示対象は6ファイル。描画1,000ノード測定と混同しない。

制限：同期配置が長時間かかるケースを中断する機能はない。Windows/Linuxのブラウザ描画、任意の密なグラフや大きい実リポジトリを保証する測定ではない。大規模対応の拡張（別配置方式、worker、集約）は初版の対応範囲へ追加していない。

## 生測定値

旧JSONの全データをそのまま以下に保持する。JSONを必要とする場合は、このコードブロックをファイルへ保存する。移管時にJSONとして元データと一致することを確認済み。

```json
{
  "date": "2026-09-23",
  "viewport": [1440, 1000],
  "results": [
    {
      "size": 100,
      "edges": 300,
      "shape": "layered",
      "node": "v24.14.1",
      "os": "darwin 25.6.0",
      "cpu": "Apple M5",
      "sample": "changemap-render-100-1",
      "browser": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.0.0 Safari/537.36",
      "initialMs": 136.40000000037253,
      "interactions": [
        {
          "selectMs": 7,
          "themeMs": 28.700000000186265
        },
        {
          "selectMs": 34,
          "themeMs": 32.700000000186265
        },
        {
          "selectMs": 33,
          "themeMs": 33.90000000037253
        },
        {
          "selectMs": 33.69999999925494,
          "themeMs": 33.200000000186265
        },
        {
          "selectMs": 33.40000000037253,
          "themeMs": 32.799999999813735
        }
      ]
    },
    {
      "size": 100,
      "edges": 300,
      "shape": "layered",
      "node": "v24.14.1",
      "os": "darwin 25.6.0",
      "cpu": "Apple M5",
      "sample": "changemap-render-100-2",
      "browser": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.0.0 Safari/537.36",
      "initialMs": 138.3999999994412,
      "interactions": [
        {
          "selectMs": 13.099999999627471,
          "themeMs": 33.299999999813735
        },
        {
          "selectMs": 32.90000000037253,
          "themeMs": 33.700000000186265
        },
        {
          "selectMs": 33.299999999813735,
          "themeMs": 33.40000000037253
        },
        {
          "selectMs": 32.299999999813735,
          "themeMs": 33.40000000037253
        },
        {
          "selectMs": 34.200000000186265,
          "themeMs": 33.299999999813735
        }
      ]
    },
    {
      "size": 100,
      "edges": 300,
      "shape": "layered",
      "node": "v24.14.1",
      "os": "darwin 25.6.0",
      "cpu": "Apple M5",
      "sample": "changemap-render-100-3",
      "browser": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.0.0 Safari/537.36",
      "initialMs": 145.69999999925494,
      "interactions": [
        {
          "selectMs": 8.700000000186265,
          "themeMs": 33.69999999925494
        },
        {
          "selectMs": 32.30000000074506,
          "themeMs": 33.39999999944121
        },
        {
          "selectMs": 34.299999999813735,
          "themeMs": 33.200000000186265
        },
        {
          "selectMs": 33.40000000037253,
          "themeMs": 33.299999999813735
        },
        {
          "selectMs": 33.200000000186265,
          "themeMs": 33.5
        }
      ]
    },
    {
      "size": 1000,
      "edges": 3000,
      "shape": "layered",
      "node": "v24.14.1",
      "os": "darwin 25.6.0",
      "cpu": "Apple M5",
      "sample": "changemap-render-1000-1",
      "browser": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.0.0 Safari/537.36",
      "initialMs": 825.6000000005588,
      "interactions": [
        {
          "selectMs": 31.5,
          "themeMs": 42.39999999944121
        },
        {
          "selectMs": 32.90000000037253,
          "themeMs": 32.90000000037253
        },
        {
          "selectMs": 34.59999999962747,
          "themeMs": 32.799999999813735
        },
        {
          "selectMs": 33,
          "themeMs": 33.799999999813735
        },
        {
          "selectMs": 33.700000000186265,
          "themeMs": 32.90000000037253
        }
      ]
    },
    {
      "size": 1000,
      "edges": 3000,
      "shape": "layered",
      "node": "v24.14.1",
      "os": "darwin 25.6.0",
      "cpu": "Apple M5",
      "sample": "changemap-render-1000-2",
      "browser": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.0.0 Safari/537.36",
      "initialMs": 808.2999999998137,
      "interactions": [
        {
          "selectMs": 30.09999999962747,
          "themeMs": 28
        },
        {
          "selectMs": 32.799999999813735,
          "themeMs": 33.799999999813735
        },
        {
          "selectMs": 33.80000000074506,
          "themeMs": 32.89999999944121
        },
        {
          "selectMs": 33.40000000037253,
          "themeMs": 33.09999999962747
        },
        {
          "selectMs": 33.700000000186265,
          "themeMs": 33.09999999962747
        }
      ]
    },
    {
      "size": 1000,
      "edges": 3000,
      "shape": "layered",
      "node": "v24.14.1",
      "os": "darwin 25.6.0",
      "cpu": "Apple M5",
      "sample": "changemap-render-1000-3",
      "browser": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.0.0 Safari/537.36",
      "initialMs": 781.5999999996275,
      "interactions": [
        {
          "selectMs": 24.899999999441206,
          "themeMs": 37.60000000055879
        },
        {
          "selectMs": 33.59999999962747,
          "themeMs": 33.5
        },
        {
          "selectMs": 33.799999999813735,
          "themeMs": 32.30000000074506
        },
        {
          "selectMs": 34.299999999813735,
          "themeMs": 32.39999999944121
        },
        {
          "selectMs": 34.200000000186265,
          "themeMs": 33
        }
      ]
    },
    {
      "size": 1000,
      "edges": 999,
      "shape": "chain",
      "node": "v24.14.1",
      "os": "darwin 25.6.0",
      "cpu": "Apple M5",
      "sample": "changemap-render-chain",
      "browser": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.0.0 Safari/537.36",
      "initialMs": 310.5,
      "interactions": [
        {
          "selectMs": 19.700000000186265,
          "themeMs": 33.19999999925494
        },
        {
          "selectMs": 33.10000000055879,
          "themeMs": 33.59999999962747
        },
        {
          "selectMs": 33.299999999813735,
          "themeMs": 32.80000000074506
        },
        {
          "selectMs": 33.5,
          "themeMs": 33.69999999925494
        },
        {
          "selectMs": 33.40000000037253,
          "themeMs": 33.200000000186265
        }
      ]
    },
    {
      "size": 1000,
      "edges": 999,
      "shape": "hub",
      "node": "v24.14.1",
      "os": "darwin 25.6.0",
      "cpu": "Apple M5",
      "sample": "changemap-render-hub",
      "browser": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.0.0 Safari/537.36",
      "initialMs": 367.20000000018626,
      "interactions": [
        {
          "selectMs": 37.59999999962747,
          "themeMs": 29.90000000037253
        },
        {
          "selectMs": 32.69999999925494,
          "themeMs": 34
        },
        {
          "selectMs": 33.5,
          "themeMs": 33.10000000055879
        },
        {
          "selectMs": 33.5,
          "themeMs": 33.200000000186265
        },
        {
          "selectMs": 33.5,
          "themeMs": 33.09999999962747
        }
      ]
    }
  ]
}
```
