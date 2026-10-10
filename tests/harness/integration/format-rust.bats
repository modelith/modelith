#!/usr/bin/env bats
# .claude/hooks/format-rust.sh の結合テスト（rustfmt を実際に呼ぶ）。

setup() {
  load ../helpers
  make_sandbox
  HOOK="$SANDBOX/.claude/hooks/format-rust.sh"
  printf 'edition = "2024"\n' >"$SANDBOX/rustfmt.toml"
}

@test "format-rust: 編集された .rs を整形する（正常系）" {
  # Arrange
  printf 'fn main(){println!("hi");}\n' >"$SANDBOX/a.rs"
  # Act
  run "$HOOK" <<<"$(hook_input "{tool_input:{file_path:\"$SANDBOX/a.rs\"}}")"
  # Assert
  [ "$status" -eq 0 ]
  [ "$(cat "$SANDBOX/a.rs")" = $'fn main() {\n    println!("hi");\n}' ]
}

@test "format-rust: .rs 以外のファイルは変更しない（正常系）" {
  # Arrange
  printf 'fn main(){}\n' >"$SANDBOX/a.txt"
  # Act
  run "$HOOK" <<<"$(hook_input "{tool_input:{file_path:\"$SANDBOX/a.txt\"}}")"
  # Assert
  [ "$status" -eq 0 ]
  [ "$(cat "$SANDBOX/a.txt")" = 'fn main(){}' ]
}

@test "format-rust: 構文エラーのファイルでもツール実行を妨げない（異常系）" {
  # Arrange
  printf 'fn main( {\n' >"$SANDBOX/broken.rs"
  # Act
  run "$HOOK" <<<"$(hook_input "{tool_input:{file_path:\"$SANDBOX/broken.rs\"}}")"
  # Assert
  [ "$status" -eq 0 ]
}
