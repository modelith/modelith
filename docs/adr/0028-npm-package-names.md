# ADR-0028: npm のパッケージの名前

- 状態: 採用（2026-11-20）、改訂（2026-11-21。3 に、公開のしかたを書き足した）
- 日付: 2026-11-20
- 関連する ADR: ADR-0004（プラグインの構成）、ADR-0006（ライセンス）、ADR-0024（AI と共同編集の土台）

## 背景

ADR-0024 の 6 で、CLI と MCP のサーバを npm のパッケージでも配ると決め、例として `npx @modelith/cli mcp` と書いた。
plugin-sdk の TypeScript のパッケージも、`@modelith/plugin-sdk` という名前で作ってきた（0.1.0 は、npm のレジストリには出さず、GitHub Release に `.tgz` を添付した）。

どちらも、npm の組織 `@modelith` を前提にした名前である。ところが、npm では次のとおりで、この前提が成り立たない（2026-11-20 に確かめた）。

| 名前 | 状態 |
| --- | --- |
| 組織 `@modelith` | ほかの人が持っていて、使えない（メンテナが確かめた） |
| パッケージ `modelith`（スコープなし） | ほかの人が公開している、Modelith とは関係の無いパッケージ |
| `modelith-cli`・`modelith-plugin-sdk` | 使われていない |

## 決定

### 1. 公開するパッケージは、スコープなしの `modelith-…` の名前にする

| もの | 名前 | 使い方 |
| --- | --- | --- |
| CLI と MCP のサーバ（本体の `cli/`） | `modelith-cli` | `npx modelith-cli mcp <フォルダ>`。入れたあとのコマンドの名前は `modelith` |
| plugin-sdk の TypeScript のパッケージ | `modelith-plugin-sdk` | `import { connectToHost } from "modelith-plugin-sdk";` |

- 名前の先頭を `modelith-` にそろえ、名前から Modelith のものだと分かるようにする。
- スコープが無いので、名前だけでは公式かどうかが分からない。パッケージの `repository`・`homepage` と README で、GitHub の `modelith` の組織を指す。
- これから出すパッケージも、同じ形（`modelith-<もの>`）にする。

### 2. plugin-sdk の名前の変更は、0.2.0 で行う（破壊的な変更）

- プラグインを作る人の import が変わる：`@modelith/plugin-sdk` → `modelith-plugin-sdk`、`@modelith/plugin-sdk/schema/*` → `modelith-plugin-sdk/schema/*`。
- plugin-sdk は 1.0.0 未満で、互換を約束していない（[バージョン規則](../reference/versioning.md)）。0.1.0 を使っている人はまだ少ないので、0.2.0 で変える。0.1.0 の `.tgz` はそのまま残す。
- Rust の crate の名前（`modelith-plugin-protocol`）は変えない。crates.io では取れている。
- 変えるのは名前だけで、型・スキーマ・`apiVersion` は変えない。
- 本体の文書（`docs/reference/script-plugins.md` など）の `@modelith/plugin-sdk` は、plugin-sdk の 0.2.0 が出たときに書き換える。

### 3. npm のレジストリへの公開は、承認つきのリリースのワークフローから行う

- 手元からは公開しない。本体も plugin-sdk も、タグを打ったあとのリリースのワークフローから、メンテナの承認を得て公開する（plugin-sdk の crates.io への公開と同じ形）。
- GitHub Release への `.tgz` の添付は続ける（npm を使わずに入れたい人のため）。
- 公開は 2 段階にする（npm の staged publishing。2026-11-21 に決めた）。
  1. リリースのワークフローが、リリースに添付したのと同じ `.tgz` を、npm に「置く」（`npm stage publish`）。置いただけでは、誰にも見えない。
  2. メンテナが、npm で中身を見て、2 段階認証をして承認する。承認すると公開される。
- ワークフローは、鍵（トークン）を持たない。npm には、ワークフローのファイルと npm の結び付け（Trusted Publishing）で入る。結び付けには「置く」ことだけを許し、直接の公開（`npm publish`）は許さない。
  ワークフローが乗っ取られても、メンテナの承認なしには公開されない。
- npm に付ける印（dist-tag）は、プレリリース版（alpha・beta・rc）は `next`、正式版は `latest`。`npm install modelith-cli` は `latest` を入れるので、プレリリース版を `latest` にしない。
  - 正式版を npm に出すまでは、`latest` を仮の置き場の版（`0.0.0-stage`。中身の無いパッケージ）に向け、その版に「正式版はまだ無い。`modelith-cli@next` を使う」という非推奨の注意書きを付ける（2026-11-25 に決めた）。
    npm は `latest` を外せず、最初に公開した版に自動で付けるので、何もしないとプレリリース版が `latest` になり、次のプレリリース版を出しても古い版を指したままになるため。
    正式版を `--tag latest` で出すと、`latest` はその版に移る。仮の置き場の版と注意書きは、そのまま残してよい。
- 最初の 1 回だけは、メンテナが手元から公開する。結び付けは、npm にパッケージがあってからでないと登録できないため。そのときも、公開するのは、リリースのワークフローが組み立てて添付した `.tgz` にする（手元で組み立てたものを出さない）。
- パッケージに同梱するライセンスの表記は、組み立てるときに入れる（`scripts/build-cli.sh`）。

### 4. 公開しないパッケージの名前は変えない

本体の `web/`（`@modelith/web`）と `tests/harness/`（`@modelith/harness-tests`）は、`private` で、npm に出さない。名前は手元のためだけのものなので、変えない。

## 決めたこと（メンテナの判断、2026-11-20）

- 本体の CLI と MCP のサーバのパッケージは `modelith-cli`（本体のセッションで）
- plugin-sdk の TypeScript のパッケージは `modelith-plugin-sdk` にし、npm のレジストリにも出す（plugin-sdk のセッションで。本体のセッションは、plugin-sdk のセッションからの連絡で知った）

## 決めたこと（メンテナの判断、2026-11-21）

- npm のアカウントは、2 段階認証を有効にしたものを使う
- 公開は、ワークフローが置き、メンテナが npm で承認する 2 段階にする（3）

## 結果

- ADR-0024 の 6 の `@modelith/cli` は、`modelith-cli` と読み替える。
- 本体の `cli/package.json` の名前を `modelith-cli` にする（公開はまだしない）。
- plugin-sdk は、この ADR を指して、0.2.0 でパッケージの名前を変える。
