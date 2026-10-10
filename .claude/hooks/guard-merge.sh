#!/usr/bin/env bash
# PreToolUse(mcp__github__merge_pull_request | mcp__github__enable_pr_auto_merge):
# PR のマージ先に応じてマージ操作の可否を決める（docs/development/branching-strategy.md「マージの権限」）。
#
#   トピック → dev  : Squash のみ。許可なしで実行してよい（allow）
#   main → dev      : 緊急修正後の同期。マージコミットのみ。許可なしで実行してよい（allow）
#   * → main        : マージコミットのみ。毎回ユーザーの承認を求める（ask）
#   方式の誤り       : 拒否（deny）
#   マージ先が不明   : 承認を求める（ask）
#
# マージ先・マージ元は GitHub API から取得する。テストでは GUARD_MERGE_BASE / GUARD_MERGE_HEAD で上書きできる。
set -uo pipefail

input="$(cat)"
tool="$(jq -r '.tool_name // ""' <<<"$input")"
owner="$(jq -r '.tool_input.owner // ""' <<<"$input")"
repo="$(jq -r '.tool_input.repo // ""' <<<"$input")"
pr="$(jq -r '.tool_input.pullNumber // ""' <<<"$input")"

# マージ方式（auto-merge は大文字、未指定はリポジトリ既定 = 不明扱い）
method="$(jq -r '(.tool_input.merge_method // .tool_input.mergeMethod // "") | ascii_downcase' <<<"$input")"

decide() { # decision reason
  jq -n --arg d "$1" --arg r "$2" \
    '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: $d, permissionDecisionReason: $r}}'
  exit 0
}

base="${GUARD_MERGE_BASE:-}"
head="${GUARD_MERGE_HEAD:-}"
if [[ -z "$base" && -n "$owner" && -n "$repo" && -n "$pr" ]]; then
  auth=()
  [[ -n "${GITHUB_TOKEN:-}" ]] && auth=(-H "Authorization: Bearer $GITHUB_TOKEN")
  if json="$(curl -fsS --max-time 10 "${auth[@]}" -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$owner/$repo/pulls/$pr" 2>/dev/null)"; then
    base="$(jq -r '.base.ref // ""' <<<"$json")"
    head="$(jq -r '.head.ref // ""' <<<"$json")"
  fi
fi

label="$owner/$repo#$pr ($tool)"
case "$base" in
  dev)
    if [[ "$head" == "main" ]]; then
      [[ "$method" == "merge" ]] ||
        decide deny "main → dev の同期はマージコミットのみです。merge_method / mergeMethod に merge を明示してください。"
      decide allow "main → dev の同期（マージコミット）は許可なしで実行できます: $label"
    fi
    [[ "$method" == "squash" ]] ||
      decide deny "dev へのマージは Squash のみです。merge_method / mergeMethod に squash を明示してください。"
    decide allow "トピック → dev の Squash merge は許可なしで実行できます: $label"
    ;;
  main)
    [[ "$method" == "merge" ]] ||
      decide deny "main へのマージはマージコミットのみです（dev → main、緊急修正 fix/* → main も同じ）。merge_method / mergeMethod に merge を明示してください。"
    decide ask "main へのマージにはメンテナの明示的な許可が必要です（PR ごと）: $label"
    ;;
  "")
    decide ask "PR のマージ先を確認できませんでした。メンテナの許可を得てから実行してください: $label"
    ;;
  *)
    decide ask "想定外のマージ先 '$base' です。メンテナの許可を得てから実行してください: $label"
    ;;
esac
