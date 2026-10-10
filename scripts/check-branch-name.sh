#!/usr/bin/env bash
# ブランチ名がブランチ戦略の規約に従っているか検証する。判断は scripts/lib/policy.sh。
#   scripts/check-branch-name.sh [branch]   省略時は GITHUB_HEAD_REF か現在のブランチ
set -euo pipefail
# shellcheck source=lib/load.sh
source "$(dirname "$0")/lib/load.sh"
harness_load

branch="${1:-${GITHUB_HEAD_REF:-$(git rev-parse --abbrev-ref HEAD)}}"
if reason="$(policy_branch_name "$branch")"; then
  echo "branch '$branch' OK"
else
  echo "ERROR: $reason" >&2
  exit 1
fi
