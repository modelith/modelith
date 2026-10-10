# modelith — エージェント向け作業ガイド

SysML v2 / KerML のテキストとダイアグラムを同期編集するモデリングエディタ（Rust）。
このファイルは Claude Code などの AI エージェントが最初に読む「ハーネス」の入口である。

## 完了の定義（Definition of Done）

作業完了を宣言する前に、必ず以下を満たすこと。

1. `scripts/check.sh` がグリーン（fmt / clippy `-D warnings` / test）
2. 振る舞いの変更にはテストを追加・更新している
3. トピックブランチ上でコミットし、Conventional Commits 形式のメッセージを付けている

`scripts/check.sh` が唯一の判定基準。CI も同じスクリプトを実行する。
独自のコマンド列で「たぶん通る」と判断しないこと。

## ブランチとコミット

詳細は [docs/development/branching-strategy.md](docs/development/branching-strategy.md)。要点のみ:

- 作業ブランチは `dev` から作り、PR は `dev` に向ける（GitHub の既定ブランチは `main` なので、PR 作成時に base を `dev` と明示する）。`main` / `dev` へ直接 commit / push しない（フックでブロックされる）
- ブランチ名: `<type>/<topic>`（type: feat|fix|refactor|docs|test|perf|ci|chore|claude）
- コミット / PR タイトル: `<type>(<scope>): <summary>`（Conventional Commits）
- 1 ブランチ 1 目的。依頼範囲外のリファクタや整形を混ぜない
- force-push 禁止。他人のブランチの履歴を書き換えない
- **トピック → `dev` は許可なしでマージしてよい。** 条件は CI（`check` / `conventions`）がグリーンで、未解決のレビューコメントがないこと。方式は Squash
- **`main` へのマージ（PR のマージ、auto-merge の有効化を含む）はメンテナの明示的な許可を得てから行う。**
  `dev` → `main` はマイルストーン（リリース）ごと、方式はマージコミット。許可は PR ごとに取り、過去の許可や他の PR への許可を流用しない
- ステージはパスを明示する（`git add -A` / `.` はフックでブロックされる）。非公開のモック・`node_modules`・`target` はコミットしない

## コマンド

| 目的 | コマンド |
| --- | --- |
| フルチェック（完了前に必須） | `scripts/check.sh` |
| 高速チェック | `scripts/check.sh --fast` |
| 単体テスト絞り込み | `cargo test -p <crate> <name>` |
| ブランチ名検証 | `scripts/check-branch-name.sh` |
| PR タイトル検証 | `scripts/check-pr-title.sh "<title>"` |
| PR 向け先検証 | `scripts/check-pr-base.sh <base> <head>` |

## ハーネス（自動で動くもの）

`.claude/settings.json` に定義。

| タイミング | フック | 役割 |
| --- | --- | --- |
| セッション開始 | `session-start.sh` | rustfmt/clippy を用意し、現在ブランチを通知 |
| Bash 実行前 | `guard-git.sh` | main / dev への push・その上での commit・force-push・一括ステージ・禁止ファイルのコミットをブロック |
| マージ操作前 | `guard-merge.sh` | dev 向けの Squash は許可、main 向けは毎回ユーザーの承認を求め、方式の誤りは拒否 |
| ファイル編集後 | `format-rust.sh` | 編集した `.rs` を rustfmt で整形 |
| 停止前 | `verify-on-stop.sh` | Rust 変更があれば `check.sh --fast` を実行し、失敗なら差し戻し |

フックにブロックされたら、回避策を探さず、メッセージに従って手順を正すこと。

## コーディング規約

- Rust edition 2024 / stable ツールチェーン（`rust-toolchain.toml`）
- `unwrap()` / `expect()` はテストとプロトタイプ以外で避け、エラー型で返す
- 公開 API には doc コメントを書く
- 周辺コードの命名・コメント密度・イディオムに合わせる

## ハーネスの改善

エージェントが同じ種類のミスを繰り返したら、それは指示ではなくハーネスで防ぐべきサイン。
このファイル・`scripts/`・`.claude/hooks/`・CI のいずれかに再発防止策を追加する PR（`chore(harness): ...`）を作ること。
