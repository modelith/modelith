#!/usr/bin/env bash
# PreToolUse(Bash): ブランチ戦略に反する git 操作をエージェントに実行させない。
# exit 2 でツール実行をブロックし、stderr の内容がエージェントへのフィードバックになる。
set -euo pipefail

cmd="$(jq -r '.tool_input.command // ""')"
[[ "$cmd" == *git* ]] || exit 0

branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")"

deny() {
  echo "BLOCKED: $1" >&2
  echo "ブランチ戦略: docs/development/branching-strategy.md" >&2
  exit 2
}

# main（リリース済み）と dev（統合ブランチ）は PR 経由でのみ更新する
protected='^(main|dev)$'

if [[ "$cmd" =~ git[[:space:]]+push ]]; then
  [[ "$cmd" =~ (^|[[:space:]:])(refs/heads/)?(main|dev)([[:space:]]|$) ]] &&
    deny "main / dev への直接 push は禁止です。トピックブランチから dev 向けの PR を作成してください。"
  [[ "$branch" =~ $protected && ! "$cmd" =~ [[:space:]][a-z]+/ ]] &&
    deny "$branch ブランチ上での push は禁止です。"
  [[ "$cmd" =~ (--force([[:space:]]|$)|[[:space:]]-f([[:space:]]|$)) ]] &&
    deny "--force は禁止です。必要なら自分のブランチに限り --force-with-lease を使ってください。"
fi

if [[ "$branch" =~ $protected && "$cmd" =~ git[[:space:]]+(commit|merge|rebase|reset) ]]; then
  deny "$branch 上での commit/merge/rebase/reset は禁止です。先に 'git switch -c <type>/<topic>' してください。"
fi

# 一括ステージは非公開ファイルや依存物を巻き込む事故の元なので、パスを明示させる
add_all='git[[:space:]]+add[[:space:]]+([^;&|]*[[:space:]])?(-A|--all|\.|:/)([[:space:];&|]|$)'
if [[ "$cmd" =~ $add_all ]]; then
  deny "git add -A / --all / . は禁止です。追加するファイルやディレクトリを明示してください。"
fi

# コミット対象に禁止パス（scripts/check.sh の FORBIDDEN と同じ）が含まれていたら止める
if [[ "$cmd" =~ git[[:space:]]+commit ]]; then
  staged="$(git diff --cached --name-only 2>/dev/null | grep -E '(^|/)node_modules/|^reference/mock/|^target/' || true)"
  [[ -z "$staged" ]] || deny "コミット禁止のファイルがステージされています（'git restore --staged <path>' で外してください）:
$staged"
fi

exit 0
