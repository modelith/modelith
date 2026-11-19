# Git ブランチ戦略

modelith は **`dev` で次の版を作り、`main` で候補（rc）と安定版を仕上げる** 運用をとる（ADR-0007・ADR-0022）。
人間と AI エージェントが並行して作業しても、`dev` が常にグリーンであり、`main` が常に候補か安定版として出せる状態であることを最優先にする。

```
feat/* fix/* docs/* ...           ──(Squash, エージェントが許可なしでマージ可)──▶  dev ──▶ タグ alpha・beta
dev                               ──(マージコミット, 次の版の rc.1 のときだけ, メンテナの許可が必須)──▶  main ──▶ タグ rc・正式版・パッチ
fix/* docs/* test/* ci/* chore/*  ──(マージコミット, メンテナの許可が必須)──▶  main
main, sync/*                      ──(マージコミット, エージェントが許可なしでマージ可)──▶  dev（main に入れたものを戻す）
```

## 原則

1. **`dev` と `main` は常にビルド・テストが通る状態**を保つ。どちらにも直接 push しない。
2. 作業はすべて **短命なトピックブランチ** で行い、PR 経由で `dev` に入れる。
3. 1 ブランチ = 1 目的。目安として **数日以内・差分 400 行以内** でマージする。
4. トピック → `dev` は **Squash merge**。PR タイトルがそのまま `dev` のコミットメッセージになる。
5. `dev` → `main` は **マージコミット**（Squash しない）。`dev` と `main` の履歴を分岐させないため。
6. 「マージ可能」の判定は人間の目視ではなく **ハーネス（`scripts/check.sh` と CI）** が行う。

## ブランチ構成

| ブランチ | 用途 | 寿命 | 作成元 → マージ先 |
| --- | --- | --- | --- |
| `main` | 候補（rc）と安定版。rc・正式版・パッチのタグはここに打つ | 永続 | — |
| `dev` | 統合ブランチ。次の版に向けた変更が集まる。alpha・beta のタグはここに打つ | 永続 | `main` から作成 → `main`（rc.1 のとき） |
| `feat/<topic>` | 機能追加 | 短命 | `dev` → `dev` |
| `fix/<topic>` | バグ修正 | 短命 | `dev` → `dev`（候補・安定版の修正は `main` → `main`。後述） |
| `refactor/<topic>` | 振る舞いを変えない構造改善 | 短命 | `dev` → `dev` |
| `docs/<topic>` | ドキュメントのみ | 短命 | `dev` → `dev` |
| `test/<topic>` | テスト追加・改善 | 短命 | `dev` → `dev` |
| `perf/<topic>` | 性能改善 | 短命 | `dev` → `dev` |
| `ci/<topic>` / `chore/<topic>` | CI・ビルド・依存更新・ハーネス | 短命 | `dev` → `dev` |
| `sync/<topic>` | `main` を `dev` に戻すとき、食い違いを直すためのブランチ | 短命 | `dev` → `dev`（マージコミット） |
| `claude/<topic>` | AI エージェント（Claude Code 等）が自動作成する作業ブランチ | 短命 | `dev` → `dev` |

- `<topic>` は英小文字・数字・`-` のみ（例: `feat/kerml-parser`, `fix/diagram-sync-crash`）。
- `release/*` ブランチは作らない。リリースはタグで表す（後述）。
- 大きな機能は **フィーチャーフラグ** や未公開モジュールとして小さく `dev` に入れ続け、長命のトピックブランチを作らない。

## 作業の流れ

```bash
git switch dev && git pull --ff-only
git switch -c feat/kerml-parser
# ... 実装 ...
scripts/check.sh            # ローカルでハーネスを通す
git commit -m "feat(parser): add KerML lexer"
git push -u origin feat/kerml-parser
# → 向け先を dev にして PR 作成（既定ブランチは dev。明示もする）。CI グリーンで Squash merge。ブランチは自動削除。
```

`dev` が先に進んだ場合は **rebase ではなく `dev` をマージ** して追従してよい（Squash merge なので履歴は汚れない）。
他人（他エージェント）のブランチを force-push で書き換えてはならない。

依存関係のある複数ブランチ（例: ハーネス → ドキュメント → 実装）は、前のブランチの上に積み、前から順に `dev` へマージする。
前のブランチが Squash merge されたら、後のブランチには `dev` をマージして差分を整理する。

## マージの権限

| マージ | 方式 | 誰が・いつ |
| --- | --- | --- |
| トピック → `dev` | Squash | **AI エージェントが許可なしでマージしてよい**。条件: CI（`check` / `conventions`）がグリーン、未解決のレビューコメントがない |
| `dev` → `main` | マージコミット | **次の版の rc.1 を出すときだけ、メンテナの明示的な許可を得てから**。許可は PR ごとに取り、過去の許可を流用しない |
| `fix/*`・`docs/*`・`test/*`・`ci/*`・`chore/*` → `main`（候補・安定版の修正と版の書き換え） | マージコミット | メンテナの明示的な許可を得てから |
| `main` → `dev`、`sync/*` → `dev`（`main` に入れたものを戻す） | マージコミット | AI エージェントが許可なしでマージしてよい |

この権限はハーネスで強制する。

| 層 | 仕組み |
| --- | --- |
| 指示 | `CLAUDE.md` に明記 |
| エージェント | `guard-merge.sh`（PreToolUse）が PR のマージ先とマージ元を確認し、`dev` 向けの Squash（と `main`・`sync/*` → `dev` のマージコミット）は許可、`main` 向けは毎回ユーザーの承認を求め、方式の誤り（トピック → `dev` のマージコミット、`main` への Squash、`sync/*` の Squash 等）は拒否する。マージ先を確認できないときも承認を求める |
| Git 操作 | `guard-git.sh` が `main` / `dev` への直接 push と、その上での commit / merge をブロック |
| CI | `scripts/check-pr-base.sh` が PR の向け先を検証する。`main` 向けは `dev`（rc.1）と `fix/*`・`docs/*`・`test/*`・`ci/*`・`chore/*` からのみ。`sync/*` は `dev` 向けのみ |
| GitHub | `main` / `dev` のルールセットで PR・CI・マージ方式を強制する（後述） |

エージェントは GitHub 上ではメンテナ本人のアカウント権限で動くことがあるため、GitHub 側の設定だけでは
「メンテナ本人の操作」と「エージェントの操作」を区別できない。`main` への関門はエージェント側の承認確認が担う。

## コミット / PR タイトル規約

[Conventional Commits](https://www.conventionalcommits.org/ja/v1.0.0/) に従う。PR タイトルは CI で検証される。

```
<type>(<scope>)?: <summary>
```

- `type`: `feat` `fix` `refactor` `perf` `test` `docs` `build` `ci` `chore` `revert`
- `scope`（リポジトリ内の場所に対応させる）:

  | scope | 対象 |
  | --- | --- |
  | `core` / `parser` / `model` | `crates/modelith-core` |
  | `wasm` | `crates/modelith-wasm` |
  | `cli` | `crates/modelith-cli` |
  | `lsp` / `server` | 将来のクレート |
  | `web` | `web/` |
  | `plugin-host` | プラグインのホスト側実装（plugin-sdk との契約に関わる） |
  | `reference` | `reference/`（ゴールデンケースの追加など） |
  | `adr` | `docs/adr/` |
  | `harness` | `scripts/`・`.claude/`・CI・`CLAUDE.md` |
- 破壊的変更は `feat(parser)!: ...` のように `!` を付け、本文に `BREAKING CHANGE:` を書く。
- `dev` → `main` と、版を書き換えて `main` に向ける PR のタイトルは `chore(release): vX.Y.Z` とする。`main` を `dev` に戻す PR は `chore(sync): merge main into dev` とする。

## PR の中のコミットの分け方

PR はレビューの単位、コミットはコードを読む単位とする。PR の大きさは目的 1 つ分のままでよいが、その中を、1 つずつ読める大きさのコミットに分ける。
`dev` へは Squash するので、分けたコミットは PR の上で読むためのもの（`dev` の履歴には PR が 1 つのコミットとして残る）。

- 1 つのコミットは 1 つの変更だけにする。1 つの関数の追加、1 つの不具合の修正、1 つの構文への対応、などを目安にする。
- 複数の層にまたがる変更は、下の層から順にコミットする。例えば文法への対応なら、構文（`syntax`）→ 投影（`project`）→ モデル（`model`）→ 画面（`web`）→ 文書（対応表・要求・ADR）の順。
- テストは、それが確かめるコードと同じコミットに入れる。
- どのコミットでも、ビルドとテストが通る状態にする（後から `git bisect` で使えるように）。
- コミットメッセージにも Conventional Commits の形を使い、`scope` で層を示す（例：`feat(parser): read case def`、`feat(model): draw satisfy without by from the owner`）。
- 1 つの PR に、関係の無い複数の目的を混ぜない（「1 ブランチ 1 目的」）。

## 関連リポジトリとの関係

`modelith/plugin-sdk` などの関連リポジトリも同じブランチ戦略・マージ権限・コミット規約に従う（将来 org の `.github` に共通化する）。
plugin-sdk の契約を変える場合は、plugin-sdk 側を先にリリースしてから本体の依存を上げる。

## リリース

バージョンの付け方は [バージョン規則](../reference/versioning.md)、具体的な手順は [リリース手順](releasing.md) を参照。
要点: alpha・beta は `dev` にタグを打つ。rc.1 は `dev` → `main` をマージ（メンテナの許可が必要）してから、rc.2 以降・正式版・パッチは `main` で版を書き換えてから、`main` にタグを打つ。

### 候補・安定版の修正

候補（rc）と安定版の不具合は、`fix/<topic>` を `main` から作り、`main` 向けの PR を出す（マージにはメンテナの許可が必要）。
次の版の機能（`feat/*`・`refactor/*` など）は `main` に入れない。修正を出すのは最新の系列だけで、古い正式版の系列には出さない（ADR-0022）。

### `main` を `dev` に戻す

`main` に入れたものは、すぐに `main` → `dev` の PR を作ってマージコミットで戻す（許可は要らない）。
両方が同じ場所を変えていてそのまま戻せないときは、`dev` から `sync/<topic>` を作り、`main` を取り込んで食い違いを直し、`dev` に向けた PR をマージコミットで入れる（許可は要らない）。
どちらも Squash にはしない（`main` が `dev` の祖先でなくなり、次の戻しで同じ箇所がまたぶつかるため）。

戻し忘れは仕組みで見つける。`main` が `dev` の祖先でないと、1 時間ごとの確認（`.github/workflows/sync-check.yml`）が Issue を開いて知らせ、戻ると閉じる。
`dev` でリリースの下書き（alpha・beta）を作るときも、戻っていなければ止める（`scripts/check-main-in-dev.sh`）。

## GitHub 側の設定（リポジトリ管理者が手動で行う）

**Settings → General**

- Default branch: **`main`** のまま（トップページはリリース済みの状態を見せる）。
  そのため PR を作るときは向け先に `dev` を明示する。向け先の誤りは CI（`conventions`）が検出する
- Pull Requests: Allow merge commits と Allow squash merging を有効、Allow rebase merging は無効
  - Squash の Default commit message: **Pull request title**
- Automatically delete head branches: 有効

**Settings → Rules → Rulesets**（2 つ作る）

| 項目 | `main` 用 | `dev` 用 |
| --- | --- | --- |
| Target branches | `main` | `dev` |
| Restrict deletions / Block force pushes | 有効 | 有効 |
| Require a pull request before merging | 有効 | 有効 |
| ├ Required approvals | 0（承認はエージェント側の関門とメンテナのマージ操作で担保） | 0 |
| └ Allowed merge methods | **Merge** のみ | **Squash** と **Merge**（Merge は `main` → `dev` の同期用。使い分けはエージェント側のフックで強制） |
| Require status checks to pass | `check` / `conventions` | `check` / `conventions` |
| Require conversation resolution | 有効 | 有効 |
| Require review from Code Owners | 任意（共同開発者が増えたら有効化） | 任意 |
