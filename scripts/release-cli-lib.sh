# shellcheck shell=bash
# cli のパッケージをリリースに添付するときの判断（純粋関数）。I/O を持たない。呼ぶのは scripts/release-cli.sh。
# scripts/lib/ は plugin-sdk と同じ内容を保つ場所なので、本体だけのこの判断は、そこには置かない。

# タグと、パッケージの版が合っているか。合っていれば 0、違えば理由を標準出力に 1 行で出して 1 を返す。
# 例: release_cli_check v0.3.0-alpha.1 0.3.0-alpha.1 → 0
#     release_cli_check v0.3.0 0.3.0-alpha.1        → 1（「タグ v0.3.0 の版（0.3.0）と、cli/package.json の版（0.3.0-alpha.1）が違います」）
#     release_cli_check 0.3.0 0.3.0                 → 1（タグは v で始める）
release_cli_check() {
  local tag=$1 version=$2
  if [[ $tag != v* ]]; then
    echo "タグ '$tag' は v で始まっていません（例: v0.3.0-alpha.1）"
    return 1
  fi
  if [[ ${tag#v} != "$version" ]]; then
    echo "タグ $tag の版（${tag#v}）と、cli/package.json の版（$version）が違います"
    return 1
  fi
  return 0
}

# npm pack が作る .tgz の名前（スコープつきの名前は、@ を取り、/ を - にする）。
# 例: release_cli_tarball modelith-cli 0.3.0-alpha.1 → modelith-cli-0.3.0-alpha.1.tgz
#     release_cli_tarball @scope/name 1.0.0         → scope-name-1.0.0.tgz
release_cli_tarball() {
  local name=$1 version=$2
  name=${name#@}
  printf '%s-%s.tgz\n' "${name//\//-}" "$version"
}

# npm のレジストリに置くときの印（dist-tag）。プレリリース版（版に - がある）は next、正式版は latest。
# npm install modelith-cli は latest を入れるので、プレリリース版を latest にしない。
# 例: release_cli_dist_tag 0.3.0-alpha.1 → next
#     release_cli_dist_tag 0.3.0-rc.1    → next
#     release_cli_dist_tag 0.3.0         → latest
release_cli_dist_tag() {
  local version=$1
  if [[ $version == *-* ]]; then
    echo next
  else
    echo latest
  fi
}

# その版が、もう npm で公開されているか。`npm view <名前>@<版> version` の出力を渡す（無い版は空になる）。
# 公開済みの版は置き直せない（npm が断る）ので、添付し直しで動かしたときは、置くのを飛ばす。
# 例: release_cli_is_published 0.3.0-alpha.2 0.3.0-alpha.2 → 0（公開済み）
#     release_cli_is_published 0.3.0-alpha.3 ""            → 1（まだ）
release_cli_is_published() {
  local version=$1 seen=$2
  [[ -n $seen && $seen == "$version" ]]
}
