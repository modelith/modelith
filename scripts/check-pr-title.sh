#!/usr/bin/env bash
# PR タイトル（= Squash 後のコミットメッセージ）が Conventional Commits 形式か検証する。
#   scripts/check-pr-title.sh "feat(parser): add KerML lexer"
set -euo pipefail

title="${1:?usage: $0 <title>}"
pattern='^(feat|fix|refactor|perf|test|docs|build|ci|chore|revert)(\([a-z0-9._-]+\))?!?: .+$'

if [[ "$title" =~ $pattern ]]; then
  echo "title OK: $title"
else
  echo "ERROR: PR タイトルが Conventional Commits 形式ではありません: $title" >&2
  echo "  例: feat(parser): add KerML lexer" >&2
  exit 1
fi
