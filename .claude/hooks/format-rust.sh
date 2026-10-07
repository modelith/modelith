#!/usr/bin/env bash
# PostToolUse(Edit|Write): 編集された .rs ファイルを即座に整形する。
set -euo pipefail

file="$(jq -r '.tool_input.file_path // ""')"
[[ "$file" == *.rs && -f "$file" ]] || exit 0
command -v rustfmt >/dev/null || exit 0

rustfmt --config-path "${CLAUDE_PROJECT_DIR:-.}/rustfmt.toml" "$file" 2>&1 >&2 || true
exit 0
