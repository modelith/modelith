#!/usr/bin/env bats
# scripts/check-main-in-dev.sh の結合テスト。一時の Git リポジトリで main と dev の祖先関係を作り、判定と終了コードを確かめる（ADR-0022 §2）。

load ../helpers

setup() {
  bats_require_minimum_version 1.5.0
  REPO="$BATS_TEST_TMPDIR/repo"
  git init -q -b main "$REPO"
  cd "$REPO"
  git -c user.email=t@example.com -c user.name=t commit -q --allow-empty -m base
  git branch dev
}

# 今のブランチに空のコミットを 1 つ足す: commit_on <ブランチ> <メッセージ>
commit_on() {
  git switch -q "$1"
  git -c user.email=t@example.com -c user.name=t commit -q --allow-empty -m "$2"
}

@test "check-main-in-dev: main が dev の祖先なら 0（正常系）" {
  # Arrange（dev だけが進んでいる）
  commit_on dev feature
  # Act
  run "$REPO_ROOT/scripts/check-main-in-dev.sh" main dev
  # Assert
  [ "$status" -eq 0 ]
  [[ $output == "main は dev に戻っています"* ]]
}

@test "check-main-in-dev: main を dev にマージコミットで戻した後も 0（正常系）" {
  # Arrange
  commit_on main fix
  commit_on dev feature
  git -c user.email=t@example.com -c user.name=t merge -q --no-ff -m sync main
  # Act
  run "$REPO_ROOT/scripts/check-main-in-dev.sh" main dev
  # Assert
  [ "$status" -eq 0 ]
}

@test "check-main-in-dev: main に戻していないコミットがあれば、その数を添えて 1（異常系）" {
  # Arrange
  commit_on main fix-1
  commit_on main fix-2
  # Act
  run --separate-stderr "$REPO_ROOT/scripts/check-main-in-dev.sh" main dev
  # Assert
  [ "$status" -eq 1 ]
  [[ $stderr == "ERROR: main の 2 個のコミットが dev に戻っていません"* ]]
}

@test "check-main-in-dev: 参照が無ければ 2（異常系）" {
  # Act
  run --separate-stderr "$REPO_ROOT/scripts/check-main-in-dev.sh" origin/main dev
  # Assert
  [ "$status" -eq 2 ]
  [[ $stderr == "ERROR: origin/main が見つかりません"* ]]
}
