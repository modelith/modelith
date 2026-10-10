#!/usr/bin/env bats
# scripts/check-branch-name.sh の結合テスト。

load check-clis

@test "check-branch-name: 引数のブランチ名を検証して OK を出す（正常系）" {
  # Arrange
  local name=feat/x
  # Act
  run "$SANDBOX/scripts/check-branch-name.sh" "$name"
  # Assert
  [ "$status" -eq 0 ]
  [ "$output" = "branch 'feat/x' OK" ]
}

@test "check-branch-name: 引数が無ければ GITHUB_HEAD_REF を使う（CI の経路）" {
  # Arrange
  export GITHUB_HEAD_REF=Bad
  # Act
  run --separate-stderr "$SANDBOX/scripts/check-branch-name.sh"
  # Assert
  [ "$status" -eq 1 ]
  [[ $stderr == "ERROR: ブランチ名 'Bad'"* ]]
}

@test "check-branch-name: どちらも無ければ現在のブランチを使う（ローカルの経路）" {
  # Arrange
  unset GITHUB_HEAD_REF
  # Act
  run bash -c "cd '$SANDBOX' && scripts/check-branch-name.sh"
  # Assert
  [ "$status" -eq 0 ]
  [ "$output" = "branch 'feat/sandbox' OK" ]
}
