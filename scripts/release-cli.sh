#!/usr/bin/env bash
# 組み立てた cli のパッケージ（npm pack の .tgz）を、リリースに添付する。.github/workflows/release-cli.yml が実行する。
#   scripts/release-cli.sh <タグ>          例: scripts/release-cli.sh v0.3.0-alpha.1
#   scripts/release-cli.sh --pack <タグ>   添付せずに、.tgz を作って名前を出すだけ（手元で確かめるとき）
# 先に scripts/build-cli.sh で cli/dist/ を作っておくこと。タグの版と、パッケージの版が同じであることを確かめる。
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# shellcheck source=scripts/release-cli-lib.sh
source scripts/release-cli-lib.sh

upload=true
if [[ ${1:-} == --pack ]]; then
  upload=false
  shift
fi
tag=${1:?使い方: scripts/release-cli.sh [--pack] <タグ>}

version=$(node -p 'require("./cli/package.json").version')
name=$(node -p 'require("./cli/package.json").name')
if ! reason=$(release_cli_check "$tag" "$version"); then
  echo "ERROR: $reason" >&2
  exit 1
fi
[[ -f cli/dist/cli/src/main.js ]] || { echo "ERROR: cli/dist/ がありません。先に scripts/build-cli.sh を実行してください" >&2; exit 1; }

out=$(mktemp -d)
(cd cli && npm pack --ignore-scripts --silent --pack-destination "$out" >/dev/null)
tgz="$out/$(release_cli_tarball "$name" "$version")"
[[ -f $tgz ]] || { echo "ERROR: npm pack が $tgz を作りませんでした" >&2; exit 1; }

if [[ $upload == true ]]; then
  # やり直したときに落ちないよう、同じ名前の添付があれば置き換える
  gh release upload "$tag" "$tgz" --clobber --repo "${GITHUB_REPOSITORY:?}"
  echo "リリース $tag に $(basename "$tgz") を添付しました"
else
  echo "$tgz"
fi
