#!/usr/bin/env bats
# scripts/lib/principles.sh の単体テスト。

setup() {
  load ../helpers
  # shellcheck source=../../../scripts/lib/principles.sh
  source "$REPO_ROOT/scripts/lib/principles.sh"
  WORK="$BATS_TEST_TMPDIR"
}

# n 行の本体を持つシェル関数を書き出す
write_function() { # file name body_lines
  { echo "$2() {"; for ((i = 0; i < $3; i++)); do echo "  echo $i"; done; echo "}"; } >>"$1"
}

@test "principles_missing_tests: 同名の .bats があれば 0 を返す（正常系）" {
  # Arrange
  mkdir -p "$WORK/tests/unit"
  touch "$WORK/tests/unit/foo.bats"
  # Act
  run principles_missing_tests "$WORK/tests" scripts/foo.sh
  # Assert
  [ "$status" -eq 0 ]
}

@test "principles_missing_tests: テストが無いスクリプトを列挙して 1 を返す（異常系）" {
  # Arrange
  mkdir -p "$WORK/tests/unit"
  touch "$WORK/tests/unit/foo.bats"
  # Act
  run principles_missing_tests "$WORK/tests" scripts/foo.sh scripts/lib/bar.mjs
  # Assert
  [ "$status" -eq 1 ]
  [[ $output == "scripts/lib/bar.mjs: テストがありません"* ]]
}

@test "principles_missing_tests: fixtures 配下の .bats はテストとして数えない（異常系）" {
  # Arrange
  mkdir -p "$WORK/tests/fixtures"
  touch "$WORK/tests/fixtures/foo.bats"
  # Act
  run principles_missing_tests "$WORK/tests" scripts/foo.sh
  # Assert
  [ "$status" -eq 1 ]
}

@test "principles_long_functions: 上限ちょうどは許可する（境界値）" {
  # Arrange
  write_function "$WORK/a.sh" ok 3
  # Act
  run principles_long_functions 3 "$WORK/a.sh"
  # Assert
  [ "$status" -eq 0 ]
}

@test "principles_long_functions: 上限 + 1 行の関数を報告する（境界値・異常系）" {
  # Arrange
  write_function "$WORK/a.sh" too_long 4
  # Act
  run principles_long_functions 3 "$WORK/a.sh"
  # Assert
  [ "$status" -eq 1 ]
  [[ $output == *"関数 too_long が 4 行"* ]]
}

@test "principles_long_files: 上限ちょうどは許可し、上限 + 1 は報告する（境界値）" {
  # Arrange
  printf 'a\nb\n' >"$WORK/ok.sh"
  printf 'a\nb\nc\n' >"$WORK/long.sh"
  # Act
  local ok long
  ok=$(status_of principles_long_files 2 "$WORK/ok.sh")
  long=$(status_of principles_long_files 2 "$WORK/long.sh")
  # Assert
  [ "$ok $long" = "0 1" ]
}
