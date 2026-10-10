#!/usr/bin/env bash
# プログラミング原則・テスト原則のうち機械的に検査できるものを検証する。
#   - スクリプトごとのテストの有無（テスト可能性）
#   - シェル関数・ファイルの長さ（単一責任の目安）
#   - ShellCheck（静的解析）
#   - テストの AAA パターン
# 原則の全体は .claude/skills/programming-principles/ と testing-principles/ を参照。
set -euo pipefail
# shellcheck source=lib/load.sh
source "$(dirname "$0")/lib/load.sh"
harness_load principles
cd "$HARNESS_ROOT"

MAX_FUNCTION_LINES=30
MAX_SCRIPT_LINES=120

mapfile -t scripts < <(git ls-files 'scripts/*.sh' 'scripts/lib/*.sh' 'scripts/lib/*.mjs' '.claude/hooks/*.sh')
mapfile -t shell < <(printf '%s\n' "${scripts[@]}" | grep '\.sh$')
mapfile -t tests < <(git ls-files '*.bats' '*.rs' '*.test.ts' | grep -v '/fixtures/')

failed=0
check() { # label command...
  local label=$1 out
  shift
  if out="$("$@" 2>&1)"; then echo "ok   $label"; else echo "FAIL $label"; echo "     ${out//$'\n'/$'\n'     }"; failed=1; fi
}

check "テストの有無" principles_missing_tests tests/harness "${scripts[@]}"
check "関数の長さ（≤ $MAX_FUNCTION_LINES 行）" principles_long_functions "$MAX_FUNCTION_LINES" "${shell[@]}"
check "スクリプトの長さ（≤ $MAX_SCRIPT_LINES 行）" principles_long_files "$MAX_SCRIPT_LINES" "${scripts[@]}"
check "ShellCheck" shellcheck -x "${shell[@]}"
check "AAA パターン" node scripts/lib/aaa-check.mjs "${tests[@]}"
exit "$failed"
