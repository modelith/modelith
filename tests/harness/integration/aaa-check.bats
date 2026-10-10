#!/usr/bin/env bats
# scripts/lib/aaa-check.mjs の結合テスト（Node で実行し、各言語のテストを解析する）。

setup() {
  load ../helpers
  AAA="$REPO_ROOT/scripts/lib/aaa-check.mjs"
  FIX="$FIXTURES/aaa"
}

@test "aaa-check: 区切りがそろったテストは合格する（正常系: bats・Rust・TS）" {
  # Arrange
  local files=("$FIX/good.bats" "$FIX/good.rs" "$FIX/good.test.ts")
  # Act
  run node "$AAA" "${files[@]}"
  # Assert
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "aaa-check: 文字列・char・ライフタイム内の括弧で本体を取り違えない（境界値）" {
  # Arrange
  local file="$FIX/good.rs"
  # Act
  run node --input-type=module -e "
    import { extractTests } from '$AAA';
    import { readFileSync } from 'node:fs';
    console.log(extractTests(readFileSync('$file', 'utf8'), 'rust').map((t) => t.name).join(','));"
  # Assert
  [ "$output" = "simple,braces_in_strings_and_lifetimes" ]
}

@test "aaa-check: 区切りが欠けたテストを不足分と行番号付きで報告する（異常系: Rust）" {
  # Arrange
  local file="$FIX/bad.rs"
  # Act
  run node "$AAA" "$file"
  # Assert
  [ "$status" -eq 1 ]
  [ "${lines[0]}" = "$file:1: テスト 'missing_assert' に AAA の区切りがありません（不足: assert）" ]
  [[ ${lines[1]} == *"'no_markers'"*"arrange, act, assert"* ]]
}

@test "aaa-check: 式だけの本体のテストは違反として扱う（異常系: TS）" {
  # Arrange
  local file="$FIX/bad.test.ts"
  # Act
  run node "$AAA" "$file"
  # Assert
  [ "$status" -eq 1 ]
  [ "${#lines[@]}" -eq 2 ]
  [[ ${lines[0]} == *"expression body"*"arrange, act, assert"* ]]
  [[ ${lines[1]} == *"missing arrange"*"（不足: arrange）" ]]
}

@test "aaa-check: 区切りの無い bats テストを報告する（異常系: bats）" {
  # Arrange
  local file="$FIX/bad.bats"
  # Act
  run node "$AAA" "$file"
  # Assert
  [ "$status" -eq 1 ]
  [[ $output == *"'no markers'"* ]]
}

@test "aaa-check: 対象外の拡張子とファイル 0 件は合格する（境界値）" {
  # Arrange
  local other="$REPO_ROOT/scripts/harness.conf"
  # Act
  run node "$AAA" "$other"
  local with_other=$status
  run node "$AAA"
  # Assert
  [ "$with_other $status" = "0 0" ]
}
