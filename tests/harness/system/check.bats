#!/usr/bin/env bats
# scripts/check.sh の統合テスト。外部ツール（cargo・npm・node・bats・shellcheck）を PATH 上のスタブに置き換え、
# 「静的検査 → 単体 → 結合 → 統合」の実行順序と、失敗した段階で止まることを検証する。

setup() {
  load ../helpers
  make_sandbox
  cp "$REPO_ROOT/scripts/check.sh" "$SANDBOX/scripts/"
  mkdir -p "$SANDBOX/web/node_modules" "$SANDBOX/tests/harness/node_modules/.bin" "$BATS_TEST_TMPDIR/bin"
  LOG="$BATS_TEST_TMPDIR/calls.log"
  for tool in cargo npm node shellcheck; do stub "$BATS_TEST_TMPDIR/bin/$tool"; done
  stub "$SANDBOX/tests/harness/node_modules/.bin/bats"
  for name in check-principles check-forbidden-files; do stub "$SANDBOX/scripts/$name.sh"; done
  export PATH="$BATS_TEST_TMPDIR/bin:$PATH" LOG
}

# 呼び出しを記録し、FAIL_ON に一致する引数なら失敗するスタブ
stub() {
  printf '#!/usr/bin/env bash\necho "$(basename "$0") $*" >>"$LOG"\n[[ -n ${FAIL_ON:-} && "$*" == *"$FAIL_ON"* ]] && exit 1\nexit 0\n' >"$1"
  chmod +x "$1"
}

stages_called() { grep -oE 'tests/harness/(unit|integration|system)' "$LOG" | cut -d/ -f3 | tr '\n' ' '; }

@test "check.sh: 全段階を 静的 → 単体 → 結合 → 統合 の順に実行する（正常系）" {
  # Arrange
  cd "$SANDBOX"
  # Act
  run scripts/check.sh
  # Assert
  [ "$status" -eq 0 ]
  [ "$(stages_called)" = "unit integration system " ]
  [ "$(grep -n '^check-principles.sh' "$LOG" | cut -d: -f1)" -lt "$(grep -n 'tests/harness/unit' "$LOG" | cut -d: -f1)" ]
  [[ $output == *"OK (full)"* ]]
}

@test "check.sh --fast: 静的検査と単体テストだけを実行する（正常系）" {
  # Arrange
  cd "$SANDBOX"
  # Act
  run scripts/check.sh --fast
  # Assert
  [ "$status" -eq 0 ]
  [ "$(stages_called)" = "unit " ]
  grep -q '^cargo check' "$LOG"
  ! grep -q '^cargo clippy' "$LOG"
}

@test "check.sh: 単体テストが失敗したら結合・統合へ進まない（異常系）" {
  # Arrange
  cd "$SANDBOX"
  export FAIL_ON=tests/harness/unit
  # Act
  run scripts/check.sh
  # Assert
  [ "$status" -ne 0 ]
  [ "$(stages_called)" = "unit " ]
}

@test "check.sh: 静的検査が失敗したらテストを実行しない（異常系）" {
  # Arrange
  cd "$SANDBOX"
  export FAIL_ON="fmt --all"
  # Act
  run scripts/check.sh
  # Assert
  [ "$status" -ne 0 ]
  [ -z "$(stages_called)" ]
}
