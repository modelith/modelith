# アーキテクチャ概要

```
                 ┌───────────────────────────────────────────┐
                 │ modelith-core（Rust）                      │
                 │ パーサ(CST)・モデル・検査・YAMLルール・TextEdit │
                 └───────┬──────────────┬──────────────┬──────┘
                         │              │              │
          ┌──────────────▼───┐  ┌───────▼────────┐  ┌──▼──────────────────┐
          │ ブラウザ           │  │ サーバ（axum）   │  │ CLI / LSP / MCP      │
          │ modelith-wasm     │  │ Git 保管・認証   │  │ CI での検査           │
          │ ＋ web/（TS UI）   │  │ SysML v2 API     │  │ エディタ支援           │
          └──────────────────┘  └────────────────┘  └─────────────────────┘
```

## リポジトリ内の配置

| パス | 内容 | 段階 |
| --- | --- | --- |
| `crates/modelith-core` | コア | P1 |
| `crates/modelith-wasm` | ブラウザ向け wasm バインディング | P2 |
| `crates/modelith-cli` | `modelith` コマンド（check / export / MCP） | P3 |
| `crates/modelith-lsp` | LSP サーバ（未作成） | P5 |
| `crates/modelith-server` | サーバ（未作成） | P6 |
| `web/` | ウェブアプリ（TypeScript + Vite） | P2 |
| `reference/` | 凍結したモックとゴールデン（ADR-0002） | P0 |

プラグインとの契約は別リポジトリ [`modelith/plugin-sdk`](https://github.com/modelith/plugin-sdk) にある（ADR-0004）。

### web/ の中の分け方

| パス | 内容 |
| --- | --- |
| `web/src/core/` | Rust のコア（wasm）の呼び出しと、その結果の型 |
| `web/src/render/` | 図の中身の選び方・配置・SVG と draw.io の文字列化。DOM・画面の状態・ブラウザの保存領域に触れない |
| `web/src/app/` | 画面（DOM の操作・画面の状態 `S`・操作の受け付け）。図は `render/` を呼んで描く |

`render/` は、画面の外（Node）で図を書き出すための層でもある（ADR-0024 の 3）。入口の `render/index.ts` は、モデル・どの図か・保存した配置・描き方を引数で受け取り、
画面の「エクスポート…」と同じ SVG・draw.io を返す。import の向きは `app/` → `render/` → `core/` の一方向で、`render/boundary.test.ts` が、
入口から `app/`・ブラウザの API・npm のパッケージに届かないことを確かめる。文字の幅は、DOM で測らず、`render/geometry.ts` の文字ごとの幅の目安で決める（画面と書き出しで同じ）。

## ロードマップ

| 段階 | 内容 |
| --- | --- |
| P0 | モノレポの骨組み・ハーネス・ADR（完了） |
| P1 | Rust コア：CST パーサ、モデル、TextEdit 生成。ゴールデンでモックと一致させる |
| P2 | wasm 化し、モックの UI を TS へ移植してコアを呼ぶ |
| P3 | CLI（check / export）と MCP（stdio） |
| P4 | プラグイン v0（YAML ルール）→ v1（TS） |
| P5 | LSP |
| P6 | サーバ（Git 保管・認証・SysML v2 標準 API）、プラグイン v2（WASM Component） |

0.1.0 では、早く使ってもらうために P2 の UI 移植を P1 より先に行った（ADR-0009、[リリース計画](../development/release-plan.md)）。
そのとき移植した暫定の TS コアは、Rust のコアに差し替えたあと `0.1.0-beta.1` で削除した（ADR-0015・ADR-0016）。
`web/src/core/` には、Worker で動く Rust のコアを呼ぶクライアントと、画面との間の型・小さなテキストの関数だけを置く。
