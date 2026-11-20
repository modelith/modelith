# MCP のサーバ（AI のクライアントからモデルを読む・書く・図を書き出す）

Claude Code や Codex などの AI のクライアントが、手元のフォルダにある SysML v2 のモデルを読み、確かめ、書き換え、図を書き出すための口（[ADR-0024](../adr/0024-ai-and-collaboration-foundation.md)、要求 F-AI-1〜F-AI-3）。
[MCP](https://modelcontextprotocol.io/) のサーバとして、標準入出力で動く。

いまできるのは **読む・確かめる・書く・図を書き出す（SVG・draw.io）** で、PNG の書き出しは、このあと足す。
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

### 配る形に組み立てる

npm で入れたパッケージの中では、Node が TypeScript を読まないので、JavaScript にして配る。

```bash
scripts/build-cli.sh           # cli/dist/ に組み立てる（束ねる道具は使わず、TypeScript のコンパイラだけで作る）
node cli/dist/cli/src/main.js mcp <プロジェクトのフォルダ>
```

`scripts/check.sh` は、組み立てたものが動くことと、パッケージに入るファイル（テストやソースが入っていないこと、ライセンス文が入っていること）を確かめる。
リリースを公開すると、同じ手順で組み立てたパッケージ（`modelith-cli-<版>.tgz`）が、そのリリースに添付される（[リリース手順](../development/releasing.md)）。
添付されたものは、リポジトリを取ってこなくても入れられる。

```bash
npm install -g https://github.com/modelith/modelith/releases/download/v<版>/modelith-cli-<版>.tgz
modelith mcp <プロジェクトのフォルダ>
```

npm への公開（要求 F-AI-4）はまだで、公開の手順を決めてから行う。パッケージの名前は `modelith-cli`（[ADR-0028](../adr/0028-npm-package-names.md)）で、公開したあとは `npx modelith-cli mcp <フォルダ>` で使える。

## 道具（読む・確かめる）

この 5 つは読むだけで、モデルを書き換えない。結果は JSON で、形は plugin-sdk の契約（`ProjectOutline`・`ElementDetail`・`ProblemReport`）。
位置は 0 始まりの行と、UTF-16 の列。

| 道具 | 引数 | 返すもの |
| --- | --- | --- |
| `list_files` | なし | モデルのファイル（`.sysml`・`.kerml`）。パスはプロジェクトのフォルダから |
| `list_elements` | `file`・`kind`（どちらも省ける） | 名前のある要素（入れ子も含む）の修飾名・種類・ファイル・位置 |
| `get_element` | `qualifiedName` | 要素の説明・型・工程・直下の要素・ポート・関係（ほかのファイルの要素との関係も入る） |
| `list_diagrams` | なし | テキストに書いた図（`view`）の修飾名・種類・ファイル・位置 |
| `list_problems` | `file`（省ける） | 問題一覧。アプリの問題一覧と同じ数え方で、チェックルールの結果と `modelith.json` の問題も入る |

関係の種類は `satisfy`・`verify`・`frame`・`derivation`・`flow`・`composition`・`definedBy`・`allocate`・`dependency`・`specialize`・`subset`・`redefine`・`reference`。

## 道具（図を書き出す）

| 道具 | 引数 | 返すもの |
| --- | --- | --- |
| `export_diagram` | `format`（`svg`・`drawio`）と、`diagram`、または `file`（と `view`） | 図の中身（`content`）。何も書かない |

- `diagram`：テキストに書いた図の修飾名（`list_diagrams` が返す `qualifiedName`）。
- `file`：モデルのファイル。そのファイルの自動の図を書き出す。`view` は `all`（すべて。既定）・`structure`（ブロック定義図）・`trace`（トレーサビリティ）・`control`（制御ループ）・`behavior`（振る舞い）。
- アプリと同じ配置と描画を使う（ADR-0024 の 3）。モデルのファイルの隣に配置ファイル（`名前.layout.json`）があれば、その位置に描く。
  配置ファイルが読めないときは、自動に並べて書き出し、理由を `layoutProblem` に入れる。
- 対象を取る自動の図（内部ブロック図・状態遷移図・シーケンス図・アクティビティ図）は、テキストに `view` として書いたものを `diagram` で指す。対象を直接指す形は、まだ無い。

同じ書き出しを、コマンドラインからも使える。

```bash
node cli/src/main.ts export <フォルダ> --format svg --diagram Shop::overview > overview.svg
node cli/src/main.ts export <フォルダ> --format drawio --file shop.sysml --view structure --out shop.drawio
```

## 道具（書く）

書くのは 2 段階で行う（メンテナの判断、2026-11-20）。利用者が差分を見てから、書き込むかを決められるようにするため。

| 道具 | 引数 | すること |
| --- | --- | --- |
| `propose_edit` | `type` と、種類ごとの引数（下の表） | **何も書かずに**、`proposalId`・ファイルごとの差分（`changes`）・当てたあとの問題一覧（`problems`）を返す |
| `apply_edit` | `proposalId` | その提案の中身を、モデルのファイルに書く。書いたファイルと、書いたあとの問題一覧を返す |

| `type` | 引数 | 内容 |
| --- | --- | --- |
| `addElement` | `kind`・`name`・`parent` | `parent`（入れる先の要素の修飾名。ふつうは package）の中身の最後に、要素を足す |
| `addRelation` | `kind`・`from`・`to` | 関係を足す（`satisfy`・`verify`・`frame`・`derivation`・`composition`・`flow`）。「出る側」の要素のあるファイルに書く |
| `rename` | `element`・`name` | 名前を変え、そのファイルの中の参照も直す。ほかのファイルの参照はまだ直さない（当てたあとの問題一覧に出る） |
| `delete` | `element` | 要素を消す |
| `setDoc` | `element`・`doc` | 説明を書き換える。空なら説明を消す |
| `replaceText` | `file`・`text` | 既にあるモデルのファイルを、丸ごと書き換える |

- 要素は修飾名で指す（`list_elements` が返す `qualifiedName`）。
- 1 回の提案に、意図は 1 つ。続けて変えるときは、書き込んでから次を提案する。
- 当てられない意図（指す要素が無い・名前が既に使われている・括弧が閉じていないなど）は、理由の文で失敗を返す。画面の操作と同じ理由で断る。
- `apply_edit` は、提案のあとにファイルが変わっていたら、**黙って上書きせずに断り、何も書かない**（ADR-0024 の 4）。もう一度 `propose_edit` から行う。
- 提案はサーバが動いている間だけ覚えている（新しいものから 20 個）。同じ提案は 1 回しか書けない。
- 書き込むのは、提案したときに作った中身そのもの。AI のクライアントは ID を渡すだけで、中身を差し替えられない。
- 書く道具は `apply_edit` だけで、MCP の注記でもそう示す（`readOnlyHint: false`）。AI のクライアントは、これを呼ぶ前に利用者へ許可を求められる。

## 読む・書く範囲と安全

- 読むのは、起動のときに渡したフォルダの中だけ。読む道具はパスを引数に取らない（`file` は結果をしぼるだけ）。シンボリックリンクはたどらない。
- 書けるのは、そのフォルダの中の、既にあるモデルのファイル（`.sysml`・`.kerml`）だけ。`replaceText` の `file` も、読むときと同じ決まりで見つかるファイルに限る。フォルダの外・`modelith.json`・プラグイン・シンボリックリンクには書かない。新しいファイルは作らない。
- 読むファイルは `modelith check` と同じ：`.sysml`・`.kerml` を、隠しフォルダ（`.` で始まる）・`target`・`node_modules` を除いてたどる。
  ほかに、`modelith.json`、`.modelith/plugins/` の下のマニフェストとルール（`.json`・`.yaml`・`.yml`）、モデルのファイルの隣の配置ファイル（`名前.layout.json`）を読む。
- 道具を呼ぶたびにフォルダを読み直すので、ほかのアプリで変えた中身がその場で見える。
- 読めないファイル（UTF-8 でないなど）は黙って飛ばさず、`list_problems` で知らせる。
- Modelith 自身は、モデルをどこにも送らない。モデルの中身を受け取るのは、利用者がつないだ AI のクライアントだけ（ADR-0024 の 5）。

## 作り

`cli/src/` は、判断と入出力を分けてある（programming-principles）。

| ファイル | 役割 | 頼るもの |
| --- | --- | --- |
| `core.ts` | コアと、プロジェクトを読む口・書く口・提案を覚える口・図を書き出す口の形（ポート） | 契約の型だけ |
| `tools.ts` | 道具の定義と判断（絞り込み・失敗の伝え方・提案と書き込みの 2 段階） | `core.ts`・`edits.ts` |
| `edits.ts` | テキストの版と、編集の当て方 | `node:crypto` |
| `proposals.ts` | 提案を、書き込むまでメモリに覚える | `node:crypto` |
| `cli.ts` | コマンドラインの引数の読み方 | なし |
| `wasm-core.ts` | コアの口を、Rust のコアの wasm で満たす | wasm |
| `fs-project.ts` | プロジェクトを読む口・書く口を、手元のフォルダで満たす | `node:fs` |
| `web-render.ts` | 図を書き出す口を、アプリと同じ配置と描画で満たす | `web/src/render`・`web/src/core/rust.ts`・wasm |
| `mcp-server.ts` | 道具を MCP のサーバとして出す | MCP の公式ライブラリ |
| `main.ts` | 部品をつなぐ | 上のすべて |
