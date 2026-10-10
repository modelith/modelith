# Git ブランチ戦略

modelith は **トランクベース開発（GitHub Flow 準拠）** を採用する。
人間と AI エージェントが並行して作業しても `main` が常にグリーンであり続けることを最優先にする。

## 原則

1. **`main` は常にビルド・テストが通る状態**を保つ。直接 push しない。
2. 作業はすべて **短命なトピックブランチ** で行い、PR 経由で `main` に入れる。
3. 1 ブランチ = 1 目的。目安として **数日以内・差分 400 行以内** でマージする。
4. マージは **Squash merge** のみ。PR タイトルがそのまま `main` のコミットメッセージになる。
5. 「マージ可能」の判定は人間の目視ではなく **ハーネス（`scripts/check.sh` と CI）** が行う。

## ブランチ構成

| ブランチ | 用途 | 寿命 | 作成元 → マージ先 |
| --- | --- | --- | --- |
| `main` | 唯一の長期ブランチ。常にリリース可能 | 永続 | — |
| `feat/<topic>` | 機能追加 | 短命 | `main` → `main` |
| `fix/<topic>` | バグ修正（緊急修正もこれ） | 短命 | `main` → `main` |
| `refactor/<topic>` | 振る舞いを変えない構造改善 | 短命 | `main` → `main` |
| `docs/<topic>` | ドキュメントのみ | 短命 | `main` → `main` |
| `test/<topic>` | テスト追加・改善 | 短命 | `main` → `main` |
| `perf/<topic>` | 性能改善 | 短命 | `main` → `main` |
| `ci/<topic>` / `chore/<topic>` | CI・ビルド・依存更新・ハーネス | 短命 | `main` → `main` |
| `claude/<topic>` | AI エージェント（Claude Code 等）が自動作成する作業ブランチ | 短命 | `main` → `main` |

- `<topic>` は英小文字・数字・`-` のみ（例: `feat/kerml-parser`, `fix/diagram-sync-crash`）。
- 命名規則は `scripts/check-branch-name.sh` と CI で機械的に検証する。
- `develop` / `release/*` ブランチは作らない。リリースは `main` 上のタグで表す（後述）。
- 大きな機能は **フィーチャーフラグ** や未公開モジュールとして小さく `main` に入れ続け、長命ブランチを作らない。

## 作業の流れ

```bash
git switch main && git pull --ff-only
git switch -c feat/kerml-parser
# ... 実装 ...
scripts/check.sh            # ローカルでハーネスを通す
git commit -m "feat(parser): add KerML lexer"
git push -u origin feat/kerml-parser
# → PR 作成。CI グリーン + レビュー承認で Squash merge。ブランチは自動削除。
```

`main` が先に進んだ場合は **rebase ではなく `main` をマージ** して追従してよい（Squash merge なので履歴は汚れない）。
他人（他エージェント）のブランチを force-push で書き換えてはならない。

## `main` へのマージ

**`main` へのマージはメンテナが許可したときだけ行う。** AI エージェントは PR の作成・修正・CI 対応までを担い、
マージ（auto-merge の有効化を含む）はメンテナの明示的な許可を PR ごとに得てから実行する。

| 層 | 仕組み |
| --- | --- |
| 指示 | `CLAUDE.md` に明記 |
| エージェント | `.claude/settings.json` の `permissions.ask` で、マージ系の操作（GitHub MCP の `merge_pull_request` / `enable_pr_auto_merge`、`gh pr merge`）を実行する前に必ず承認を求める |
| Git 操作 | `guard-git.sh` が `main` への直接 push・`main` 上での commit / merge をブロック |
| GitHub | `main` のルールセットで PR・CI・CODEOWNERS レビューを必須にする（後述） |

エージェントは GitHub 上ではメンテナ本人のアカウント権限で動くことがあるため、GitHub 側の設定だけでは
「メンテナ本人の操作」と「エージェントの操作」を区別できない。エージェント側の承認（`permissions.ask`）が最終的な関門になる。

## コミット / PR タイトル規約

[Conventional Commits](https://www.conventionalcommits.org/ja/v1.0.0/) に従う。PR タイトルは CI で検証される。

```
<type>(<scope>)?: <summary>
```

- `type`: `feat` `fix` `refactor` `perf` `test` `docs` `build` `ci` `chore` `revert`
- `scope` 例: `parser`, `kerml`, `sysml`, `diagram`, `editor`, `sync`, `harness`
- 破壊的変更は `feat(parser)!: ...` のように `!` を付け、本文に `BREAKING CHANGE:` を書く。

## リリース

- `main` の任意のコミットに `vMAJOR.MINOR.PATCH` タグを打ってリリースとする（SemVer）。
- 1.0.0 未満の間は破壊的変更で MINOR を上げる。
- 過去バージョンへのパッチが必要になった時点で初めて `release/vX.Y` ブランチをタグから切る（それまでは作らない）。

## GitHub 側の設定（リポジトリ管理者が手動で行う）

Settings → Rules → Rulesets で `main` に以下を設定する。

- [x] Restrict deletions / Block force pushes
- [x] Require a pull request before merging（承認 1 以上、新しい push で承認を取り消し）
- [x] Require status checks to pass: `check`, `conventions`
- [x] Require branches to be up to date before merging
- [x] Require conversation resolution before merging

Settings → General → Pull Requests:

- [x] Allow squash merging のみ有効（merge commit / rebase merge は無効）
- [x] Default commit message: **Pull request title**
- [x] Automatically delete head branches
