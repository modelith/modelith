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
