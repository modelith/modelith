# reference/

Rust 実装の「動く仕様書」（ADR-0002）。

| パス | 内容 |
| --- | --- |
| `mock/Modelith.html` | 凍結した JS モック。**編集しない**（修正が必要なら ADR を追加） |
| `golden/cases/*.sysml` | ゴールデンの入力ケース（モック内の SAMPLE も `sample` として自動で含まれる） |
| `golden/*.json` | モックのパーサ・モデル構築の出力。生成物なので手で編集しない |
| `tools/gen-golden.mjs` | ゴールデンの生成・検証スクリプト |

```bash
node reference/tools/gen-golden.mjs          # 再生成
node reference/tools/gen-golden.mjs --check  # 最新か検証（scripts/check.sh が実行）
```

ケースを追加したら再生成してコミットする。
