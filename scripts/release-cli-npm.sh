#!/usr/bin/env bash
# リリースに添付した cli のパッケージ（.tgz）を、npm のレジストリに「置く」（npm stage publish。ADR-0028 の 3）。
# 置いただけでは公開されない。メンテナが npm で中身を見て、2 段階認証で承認すると公開される。
# .github/workflows/release-cli.yml が、添付のあとに実行する。認証は、GitHub Actions と npm の結び付け（Trusted Publishing）で行い、鍵は使わない。
#   scripts/release-cli-npm.sh <タグ>   例: scripts/release-cli-npm.sh v0.3.0-alpha.2
# 添付したものと同じファイルを置くため、組み立て直さずに、リリースから取ってくる。
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# shellcheck source=scripts/release-cli-lib.sh
source scripts/release-cli-lib.sh

tag=${1:?使い方: scripts/release-cli-npm.sh <タグ>}

version=$(node -p 'require("./cli/package.json").version')
name=$(node -p 'require("./cli/package.json").name')
if ! reason=$(release_cli_check "$tag" "$version"); then
  echo "ERROR: $reason" >&2
  exit 1
fi

tarball=$(release_cli_tarball "$name" "$version")
out=$(mktemp -d)
gh release download "$tag" --pattern "$tarball" --dir "$out" --repo "${GITHUB_REPOSITORY:?}"
[[ -f $out/$tarball ]] || { echo "ERROR: リリース $tag に $tarball がありません" >&2; exit 1; }

dist_tag=$(release_cli_dist_tag "$version")
npm stage publish "$out/$tarball" --tag "$dist_tag"
echo "$name@$version を、印 $dist_tag で npm に置きました。npm（https://www.npmjs.com/package/$name）で承認すると公開されます"
