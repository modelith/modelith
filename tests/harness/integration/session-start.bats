#!/usr/bin/env bats
# .claude/hooks/session-start.sh の結合テスト。rustup・npm・pip を PATH 上のスタブに置き換える。

setup() {
  load ../helpers
  make_sandbox
  cp "$REPO_ROOT/.claude/hooks/session-start.sh" "$SANDBOX/.claude/hooks/"
  HOOK="$SANDBOX/.claude/hooks/session-start.sh"
  BIN="$BATS_TEST_TMPDIR/bin" LOG="$BATS_TEST_TMPDIR/calls.log"
  mkdir -p "$BIN"
  export LOG
}

# 呼び出しを記録して exit_code で終わるスタブ: stub <name> <exit_code>
stub() {
  printf '#!/usr/bin/env bash\necho "$(basename "$0") $*" >>"$LOG"\nexit %s\n' "$2" >"$BIN/$1"
  chmod +x "$BIN/$1"
}

# 必要なコマンドだけを含む PATH（shellcheck の有無を制御するため、システムの PATH から git・jq 等だけを借りる）
isolated_path() {
  local cmd
  for cmd in bash git cat dirname basename; do ln -sf "$(command -v "$cmd")" "$BIN/$cmd"; done
  echo "$BIN"
}

@test "session-start: トピックブランチでは作業ルールだけを案内する（正常系）" {
  # Arrange
  stub rustup 0; stub npm 0; stub pip 0; stub shellcheck 0
  # Act
  run env PATH="$(isolated_path)" "$HOOK"
  # Assert
  [ "$status" -eq 0 ]
  [[ $output == *"現在のブランチ: feat/sandbox"* && $output != *"注意:"* ]]
  [[ $output == *"testing-principles"* ]]
}

@test "session-start: dev 上ではブランチを切るよう注意する（異常系）" {
  # Arrange
  stub rustup 0; stub npm 0; stub pip 0; stub shellcheck 0
  git -C "$SANDBOX" switch -q -c dev
  # Act
  run env PATH="$(isolated_path)" "$HOOK"
  # Assert
  [[ $output == *"注意: dev 上にいます"* ]]
}

@test "session-start: lock があり node_modules が無いディレクトリだけ npm ci する（境界値）" {
  # Arrange
  stub rustup 0; stub npm 0; stub pip 0; stub shellcheck 0
  mkdir -p "$SANDBOX/web" "$SANDBOX/tests/harness/node_modules"
  touch "$SANDBOX/web/package-lock.json" "$SANDBOX/tests/harness/package-lock.json"
  # Act
  run env PATH="$(isolated_path)" "$HOOK"
  # Assert
  [ "$(grep -c '^npm ci' "$LOG")" -eq 1 ]
  grep -q '^npm ci --prefix web' "$LOG"
}

@test "session-start: shellcheck が無ければ pip で入れ、失敗しても開始を妨げない（異常系）" {
  # Arrange
  stub rustup 0; stub npm 0; stub pip 1
  # Act
  run env PATH="$(isolated_path)" "$HOOK"
  # Assert
  [ "$status" -eq 0 ]
  grep -q '^pip install --quiet shellcheck-py' "$LOG"
  [[ $output == *"警告: shellcheck を導入できませんでした"* ]]
}
