#!/usr/bin/env bats
# scripts/check-shared-sync.sh の結合テスト。相手リポジトリを file:// のディレクトリで代用する（HARNESS_RAW_BASE）。

setup() {
  load ../helpers
  make_sandbox
  printf '# test\nscripts/lib/policy.sh\nscripts/check-pr-title.sh\n' >"$SANDBOX/scripts/lib/shared-files.txt"
  OTHER="$BATS_TEST_TMPDIR/raw/example/other/dev"
  mkdir -p "$OTHER/scripts/lib"
  cp "$SANDBOX/scripts/lib/policy.sh" "$OTHER/scripts/lib/"
  cp "$SANDBOX/scripts/check-pr-title.sh" "$OTHER/scripts/"
  export HARNESS_RAW_BASE="file://$BATS_TEST_TMPDIR/raw"
}

@test "check-shared-sync: すべて同一なら成功する（正常系）" {
  # Arrange
  cd "$SANDBOX"
  # Act
  run scripts/check-shared-sync.sh
  # Assert
  [ "$status" -eq 0 ]
  [ "$output" = "shared files: example/other@dev と一致" ]
}

@test "check-shared-sync: 内容が異なるファイルを報告して失敗する（異常系）" {
  # Arrange
  echo "# drift" >>"$OTHER/scripts/lib/policy.sh"
  cd "$SANDBOX"
  # Act
  run scripts/check-shared-sync.sh
  # Assert
  [ "$status" -eq 1 ]
  [ "$output" = "differs: scripts/lib/policy.sh" ]
}

@test "check-shared-sync: 相手に無いファイルを報告して失敗する（異常系）" {
  # Arrange
  rm "$OTHER/scripts/check-pr-title.sh"
  cd "$SANDBOX"
  # Act
  run scripts/check-shared-sync.sh
  # Assert
  [ "$status" -eq 1 ]
  [[ $output == "missing: scripts/check-pr-title.sh"* ]]
}

@test "check-shared-sync: 引数で相手のブランチを指定できる（正常系）" {
  # Arrange
  mv "$OTHER" "$BATS_TEST_TMPDIR/raw/example/other/main"
  cd "$SANDBOX"
  # Act
  run scripts/check-shared-sync.sh main
  # Assert
  [ "$status" -eq 0 ]
}
