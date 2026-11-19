# MCP のサーバ（AI のクライアントからモデルを読む）

Claude Code や Codex などの AI のクライアントが、手元のフォルダにある SysML v2 のモデルを読み、確かめるための口（[ADR-0024](../adr/0024-ai-and-collaboration-foundation.md)、要求 F-AI-1）。
[MCP](https://modelcontextprotocol.io/) のサーバとして、標準入出力で動く。

いまできるのは **読む・確かめる** だけで、モデルを書き換える道具（F-AI-2）と図を書き出す道具（F-AI-3）は、このあと足す。
npm などで入れられる形（F-AI-4）もこれからで、いまはリポジトリから動かす。

## 動かし方

Node.js（`.nvmrc` の版）と Rust が要る。

```bash
scripts/build-wasm.sh                 # コアの wasm を作る（初回と、コアを変えたとき）
npm ci --prefix cli --ignore-scripts
node cli/src/main.ts mcp <プロジェクトのフォルダ>
```

AI のクライアントには、上の最後の行をコマンドとして登録する。Claude Code の例：

```bash
claude mcp add modelith -- node /path/to/modelith/cli/src/main.ts mcp /path/to/project
```

## 道具

どれも読むだけで、モデルを書き換えない。結果は JSON で、形は plugin-sdk の契約（`ProjectOutline`・`ElementDetail`・`ProblemReport`）。
位置は 0 始まりの行と、UTF-16 の列。

| 道具 | 引数 | 返すもの |
| --- | --- | --- |
| `list_files` | なし | モデルのファイル（`.sysml`・`.kerml`）。パスはプロジェクトのフォルダから |
| `list_elements` | `file`・`kind`（どちらも省ける） | 名前のある要素（入れ子も含む）の修飾名・種類・ファイル・位置 |
| `get_element` | `qualifiedName` | 要素の説明・型・工程・直下の要素・ポート・関係（ほかのファイルの要素との関係も入る） |
| `list_diagrams` | なし | テキストに書いた図（`view`）の修飾名・種類・ファイル・位置 |
| `list_problems` | `file`（省ける） | 問題一覧。アプリの問題一覧と同じ数え方で、チェックルールの結果と `modelith.json` の問題も入る |

関係の種類は `satisfy`・`verify`・`frame`・`derivation`・`flow`・`composition`・`definedBy`・`allocate`・`dependency`・`specialize`・`subset`・`redefine`・`reference`。

## 読む範囲と安全

- 読むのは、起動のときに渡したフォルダの中だけ。道具はパスを引数に取らない（`file` は結果をしぼるだけ）。シンボリックリンクはたどらない。
- 読むファイルは `modelith check` と同じ：`.sysml`・`.kerml` を、隠しフォルダ（`.` で始まる）・`target`・`node_modules` を除いてたどる。
  ほかに、`modelith.json` と、`.modelith/plugins/` の下のマニフェストとルール（`.json`・`.yaml`・`.yml`）を読む。
- 道具を呼ぶたびにフォルダを読み直すので、ほかのアプリで変えた中身がその場で見える。
- 読めないファイル（UTF-8 でないなど）は黙って飛ばさず、`list_problems` で知らせる。
- Modelith 自身は、モデルをどこにも送らない。モデルの中身を受け取るのは、利用者がつないだ AI のクライアントだけ（ADR-0024 の 5）。

## 作り

`cli/src/` は、判断と入出力を分けてある（programming-principles）。

| ファイル | 役割 | 頼るもの |
| --- | --- | --- |
| `core.ts` | コアと、プロジェクトを読む口の形（ポート） | 契約の型だけ |
| `tools.ts` | 道具の定義と判断（絞り込み・失敗の伝え方） | `core.ts` だけ |
| `cli.ts` | コマンドラインの引数の読み方 | なし |
| `wasm-core.ts` | コアの口を、Rust のコアの wasm で満たす | wasm |
| `fs-project.ts` | プロジェクトを読む口を、手元のフォルダで満たす | `node:fs` |
| `mcp-server.ts` | 道具を MCP のサーバとして出す | MCP の公式ライブラリ |
| `main.ts` | 部品をつなぐ | 上のすべて |
