#!/usr/bin/env bash
# PreToolUse(Edit|Write|MultiEdit|NotebookEdit): 凍結ファイル・生成物の直接編集をブロックする。
# 対象は scripts/harness.conf の HARNESS_FROZEN_PATHS、判断は scripts/lib/policy.sh。
set -euo pipefail
# shellcheck source=../../scripts/lib/load.sh
source "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}/scripts/lib/load.sh"
harness_load hook-io
hook_read_input

file="$(hook_field '.tool_input.file_path // .tool_input.notebook_path')"
reason="$(policy_frozen_path "${file#"$HARNESS_ROOT"/}")" || hook_block "$reason"
exit 0
