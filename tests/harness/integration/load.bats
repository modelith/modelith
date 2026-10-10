#!/usr/bin/env bats
# scripts/lib/load.sh の結合テスト（リポジトリの配置から設定とアダプタを読み込む）。

setup() {
  load ../helpers
  make_sandbox
}

@test "harness_load: CLAUDE_PROJECT_DIR の設定と policy を読み込む（正常系）" {
  # Arrange
  source "$SANDBOX/scripts/lib/load.sh"
  # Act
  harness_load
  # Assert
  [ "$HARNESS_ROOT" = "$SANDBOX" ]
  [ "$HARNESS_STRATEGY_DOC" = docs/strategy.md ]
  declare -F policy_branch_name >/dev/null
}

@test "harness_load: 指定したアダプタだけを追加で読み込む（インタフェース分離）" {
  # Arrange
  source "$SANDBOX/scripts/lib/load.sh"
  # Act
  harness_load hook-io
  # Assert
  declare -F hook_field >/dev/null
  ! declare -F principles_missing_tests >/dev/null
}

@test "harness_load: CLAUDE_PROJECT_DIR が無ければ Git のルートを使う（境界値）" {
  # Arrange
  unset CLAUDE_PROJECT_DIR
  source "$SANDBOX/scripts/lib/load.sh"
  # Act
  cd "$SANDBOX" && harness_load
  # Assert
  [ "$HARNESS_ROOT" = "$SANDBOX" ]
}
