#!/usr/bin/env bats
# .claude/hooks/protect-files.sh の結合テスト。

setup() {
  bats_require_minimum_version 1.5.0
  load ../helpers
  make_sandbox
  HOOK="$SANDBOX/.claude/hooks/protect-files.sh"
}

run_hook() { # json
  run --separate-stderr "$HOOK" <<<"$(hook_input "$1")"
}

@test "protect-files: 凍結パスの絶対パス指定をブロックする（異常系）" {
  # Arrange
  local path="$SANDBOX/frozen/spec.html"
  # Act
  run_hook "{tool_input:{file_path:\"$path\"}}"
  # Assert
  [ "$status" -eq 2 ]
  [[ $stderr == *"frozen/ は凍結されています"* ]]
}

@test "protect-files: NotebookEdit の notebook_path も判定する（異常系）" {
  # Arrange
  local path="$SANDBOX/web/package-lock.json"
  # Act
  run_hook "{tool_input:{notebook_path:\"$path\"}}"
  # Assert
  [ "$status" -eq 2 ]
}

@test "protect-files: 通常のファイルは許可する（正常系）" {
  # Arrange
  local path="$SANDBOX/src/frozen.rs"
  # Act
  run_hook "{tool_input:{file_path:\"$path\"}}"
  # Assert
  [ "$status" -eq 0 ]
}
