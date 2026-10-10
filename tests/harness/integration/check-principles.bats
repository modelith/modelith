#!/usr/bin/env bats
# scripts/check-principles.sh の結合テスト（実際の Git 管理ファイル・ShellCheck・Node を使う）。

setup() {
  load ../helpers
  make_sandbox
  mkdir -p "$SANDBOX/tests/harness/unit"
  # サンドボックス内のスクリプトすべてにテストがある状態を作る
  local f
  for f in $(git -C "$SANDBOX" ls-files 'scripts/*' '.claude/hooks/*'); do
    printf '@test "t" {\n  # Arrange\n  # Act\n  # Assert\n  true\n}\n' >"$SANDBOX/tests/harness/unit/$(basename "${f%.*}").bats"
  done
  git -C "$SANDBOX" add tests
  cd "$SANDBOX"
}

@test "check-principles: 原則を満たしていれば成功する（正常系）" {
  # Arrange
  local script=scripts/check-principles.sh
  # Act
  run "$script"
  # Assert
  [ "$status" -eq 0 ]
  [ "$(grep -c '^ok ' <<<"$output")" -eq 5 ]
}

@test "check-principles: テストの無いスクリプトを追加すると失敗する（異常系: テスト可能性）" {
  # Arrange
  printf '#!/usr/bin/env bash\necho hi\n' >scripts/new-tool.sh
  git add scripts/new-tool.sh
  # Act
  run scripts/check-principles.sh
  # Assert
  [ "$status" -eq 1 ]
  [[ $output == *"FAIL テストの有無"*"scripts/new-tool.sh"* ]]
}

@test "check-principles: AAA の区切りが無いテストを追加すると失敗する（異常系: AAA）" {
  # Arrange
  printf '@test "x" {\n  true\n}\n' >tests/harness/unit/extra.bats
  git add tests/harness/unit/extra.bats
  # Act
  run scripts/check-principles.sh
  # Assert
  [ "$status" -eq 1 ]
  [[ $output == *"FAIL AAA パターン"*"extra.bats"* ]]
}

@test "check-principles: ShellCheck の警告があれば失敗する（異常系: 静的解析）" {
  # Arrange
  printf '#!/usr/bin/env bash\ncd /tmp\n' >scripts/bad-cd.sh
  printf '@test "t" {\n  # Arrange\n  # Act\n  # Assert\n  true\n}\n' >tests/harness/unit/bad-cd.bats
  git add scripts/bad-cd.sh tests/harness/unit/bad-cd.bats
  # Act
  run scripts/check-principles.sh
  # Assert
  [ "$status" -eq 1 ]
  [[ $output == *"FAIL ShellCheck"*"SC2164"* ]]
}
