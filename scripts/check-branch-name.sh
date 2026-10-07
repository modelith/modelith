#!/usr/bin/env bash
# ブランチ名が docs/development/branching-strategy.md の規約に従っているか検証する。
#   scripts/check-branch-name.sh [branch]
set -euo pipefail

branch="${1:-${GITHUB_HEAD_REF:-$(git rev-parse --abbrev-ref HEAD)}}"
pattern='^(feat|fix|refactor|docs|test|perf|ci|chore|claude)/[a-z0-9][a-z0-9._-]*$'

case "$branch" in
  main | HEAD) exit 0 ;; # main 自体・detached HEAD (CI) は対象外
esac

if [[ "$branch" =~ $pattern ]]; then
  echo "branch '$branch' OK"
else
  echo "ERROR: branch '$branch' は命名規則に違反しています。" >&2
  echo "  期待する形式: <type>/<topic>  (type: feat|fix|refactor|docs|test|perf|ci|chore|claude)" >&2
  echo "  詳細: docs/development/branching-strategy.md" >&2
  exit 1
fi
