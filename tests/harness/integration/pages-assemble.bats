#!/usr/bin/env bats
# scripts/pages-assemble.sh の結合テスト。系列ごとの tar.gz を作って渡し、サイトの並び方と失敗のしかたを確かめる（ADR-0022）。

load ../helpers

# 中身が 1 つのファイルの tar.gz を作る: make_archive <名前> <index.html の中身>
make_archive() {
  local dir="$BATS_TEST_TMPDIR/src-$1"
  mkdir -p "$dir"
  printf '%s' "$2" >"$dir/index.html"
  tar -czf "$BATS_TEST_TMPDIR/$1.tar.gz" -C "$dir" .
  echo "$BATS_TEST_TMPDIR/$1.tar.gz"
}

setup() {
  bats_require_minimum_version 1.5.0
  SITE="$BATS_TEST_TMPDIR/site"
}

@test "pages-assemble: 3 つの系列を /・/rc/・/preview/ に並べる（正常系）" {
  # Arrange
  stable=$(make_archive stable S)
  rc=$(make_archive rc R)
  preview=$(make_archive preview P)
  # Act
  run "$REPO_ROOT/scripts/pages-assemble.sh" "$SITE" "$stable" "$rc" "$preview"
  # Assert
  [ "$status" -eq 0 ]
  [ "$(cat "$SITE/index.html")" = S ]
  [ "$(cat "$SITE/rc/index.html")" = R ]
  [ "$(cat "$SITE/preview/index.html")" = P ]
}

@test "pages-assemble: リリース候補版が無ければ、/rc/ に安定版への案内を置く（境界値）" {
  # Arrange
  stable=$(make_archive stable S)
  preview=$(make_archive preview P)
  # Act
  run "$REPO_ROOT/scripts/pages-assemble.sh" "$SITE" "$stable" "" "$preview"
  # Assert
  [ "$status" -eq 0 ]
  grep -q '今はリリース候補版がありません' "$SITE/rc/index.html"
  grep -q 'href="../"' "$SITE/rc/index.html"
  grep -q 'noindex' "$SITE/rc/index.html"
}

@test "pages-assemble: 前に組み立てたものは残さない（境界値）" {
  # Arrange
  stable=$(make_archive stable S)
  mkdir -p "$SITE/old"
  # Act
  run "$REPO_ROOT/scripts/pages-assemble.sh" "$SITE" "$stable"
  # Assert
  [ "$status" -eq 0 ]
  [ ! -e "$SITE/old" ]
  [ ! -e "$SITE/preview" ]
}

@test "pages-assemble: 安定版が無ければ、サイトを作らずに失敗する（異常系）" {
  # Act
  run --separate-stderr "$REPO_ROOT/scripts/pages-assemble.sh" "$SITE" "" "" ""
  # Assert
  [ "$status" -eq 1 ]
  [[ $stderr == "ERROR: 安定版がありません"* ]]
  [ ! -e "$SITE" ]
}

@test "pages-assemble: 渡された版のファイルが無ければ失敗する（異常系）" {
  # Act
  run --separate-stderr "$REPO_ROOT/scripts/pages-assemble.sh" "$SITE" "$BATS_TEST_TMPDIR/missing.tar.gz"
  # Assert
  [ "$status" -eq 1 ]
  [[ $stderr == *"missing.tar.gz がありません"* ]]
}
