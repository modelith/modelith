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

if [[ "$cmd" =~ git[[:space:]]+push ]]; then
  [[ "$cmd" =~ (^|[[:space:]:])(refs/heads/)?main([[:space:]]|$) ]] &&
    deny "main への直接 push は禁止です。トピックブランチから PR を作成してください。"
  [[ "$branch" == "main" && ! "$cmd" =~ [[:space:]][a-z]+/ ]] &&
    deny "main ブランチ上での push は禁止です。"
  [[ "$cmd" =~ (--force([[:space:]]|$)|[[:space:]]-f([[:space:]]|$)) ]] &&
    deny "--force は禁止です。必要なら自分のブランチに限り --force-with-lease を使ってください。"
fi

if [[ "$branch" == "main" && "$cmd" =~ git[[:space:]]+(commit|merge|rebase|reset) ]]; then
  deny "main 上での commit/merge/rebase/reset は禁止です。先に 'git switch -c <type>/<topic>' してください。"
fi

exit 0
