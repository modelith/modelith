#!/usr/bin/env bats
# scripts/release-cli-lib.sh の単体テスト。cli のパッケージをリリースに添付するときの判断（I/O なし）。

setup() {
  load ../helpers
  # shellcheck source=../../scripts/release-cli-lib.sh
  source "$REPO_ROOT/scripts/release-cli-lib.sh"
}

@test "release_cli_check: タグの版とパッケージの版が同じなら通す（正常系: alpha・rc・正式版）" {
  # Arrange
  local versions=(0.3.0-alpha.1 0.3.0-rc.2 0.3.0)
  # Act
  local results=() v
  for v in "${versions[@]}"; do results+=("$(status_of release_cli_check "v$v" "$v")"); done
  # Assert
  [ "${results[*]}" = "0 0 0" ]
}

@test "release_cli_check: 版が違うときは、両方の版を示して断る（異常系）" {
  # Act
  run release_cli_check v0.3.0 0.3.0-alpha.1
  # Assert
  [ "$status" -eq 1 ]
  [ "$output" = "タグ v0.3.0 の版（0.3.0）と、cli/package.json の版（0.3.0-alpha.1）が違います" ]
}

@test "release_cli_check: v で始まらないタグ・空のタグは断る（異常系・境界値）" {
  # Act
  local plain empty
  plain=$(status_of release_cli_check 0.3.0 0.3.0)
  empty=$(status_of release_cli_check "" 0.3.0)
  run release_cli_check 0.3.0 0.3.0
  # Assert
  [ "$plain $empty" = "1 1" ]
  [[ $output == "タグ '0.3.0' は v で始まっていません"* ]]
}

@test "release_cli_tarball: npm pack が作る名前にする（スコープなし・スコープつき）" {
  # Act
  local plain scoped
  plain=$(release_cli_tarball modelith-cli 0.3.0-alpha.1)
  scoped=$(release_cli_tarball @scope/name 1.0.0)
  # Assert
  [ "$plain" = "modelith-cli-0.3.0-alpha.1.tgz" ]
  [ "$scoped" = "scope-name-1.0.0.tgz" ]
}

@test "release_cli_dist_tag: プレリリース版は next、正式版は latest にする（同値分割: alpha・beta・rc・正式版・パッチ）" {
  # Arrange
  local versions=(0.3.0-alpha.1 0.3.0-beta.2 0.3.0-rc.1 0.3.0 1.2.3)
  # Act
  local results=() v
  for v in "${versions[@]}"; do results+=("$(release_cli_dist_tag "$v")"); done
  # Assert
  [ "${results[*]}" = "next next next latest latest" ]
}

@test "release_cli_is_published: npm にその版があるときだけ公開済みとする（同値分割: 同じ版・空・別の版）" {
  # Arrange
  local seen=(0.3.0-alpha.2 "" 0.3.0-alpha.1)
  # Act
  local results=() s
  for s in "${seen[@]}"; do
    if release_cli_is_published 0.3.0-alpha.2 "$s"; then results+=(yes); else results+=(no); fi
  done
  # Assert
  [ "${results[*]}" = "yes no no" ]
}
