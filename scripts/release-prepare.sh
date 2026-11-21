#!/usr/bin/env bash
# 版を上げる PR の準備（docs/development/releasing.md）。版を書き換え、リリースノートのひな形を作る。
#   scripts/release-prepare.sh <版>   例: scripts/release-prepare.sh 0.1.0-alpha.4
# このあと docs/releases/v<版>.md の「（ここに書く）」を埋め、release-notes-cli.ts check <版> で確かめる。
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

version=${1:?使い方: scripts/release-prepare.sh <版>}
branch=$(git branch --show-current)
if [[ $branch != "chore/release-v$version" ]]; then
  echo "ERROR: dev から chore/release-v$version を作ってから実行してください（今は $branch）" >&2
  exit 1
fi

git fetch --quiet --tags origin || echo "注意: タグを取得できませんでした。前の版はノートのファイルから選びます" >&2
# Cargo.toml の最初の version の行（ワークスペースの版）だけを書き換える。GNU と BSD（macOS）の sed は、その場での書き換えと
# 「最初の 1 つだけ」の書き方が違うので、どちらでも動く awk で書き、できたものと置き換える
tmp=$(mktemp)
awk -v v="$version" '!done && /^version = ".*"$/ { print "version = \"" v "\""; done = 1; next } { print }' Cargo.toml >"$tmp"
cat "$tmp" >Cargo.toml
rm -f "$tmp"
cargo update --workspace --quiet
npm version "$version" --no-git-tag-version --prefix web >/dev/null
npm version "$version" --no-git-tag-version --prefix cli >/dev/null
node web/tools/release-notes-cli.ts new "$version"
echo "版を $version にしました（Cargo.toml・Cargo.lock と、web・cli の package.json・package-lock.json）"
