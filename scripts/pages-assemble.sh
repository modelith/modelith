#!/usr/bin/env bash
# 系列ごとに作っておいた版（tar.gz）を並べて、GitHub Pages に置くサイトを作る（ADR-0022）。作り直しもテストもしない。
#   scripts/pages-assemble.sh <出力先> <安定版の .tar.gz> <リリース候補版の .tar.gz> <プレビュー版の .tar.gz>
#   例: scripts/pages-assemble.sh site stable.tar.gz rc.tar.gz preview.tar.gz
# 安定版は <出力先>/、リリース候補版は <出力先>/rc/、プレビュー版は <出力先>/preview/ に置く。
# リリース候補版とプレビュー版は空でよい。リリース候補版が無いときは、/rc/ に安定版への案内のページを置く。
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)

out=${1:?出力先を渡してください}
stable=${2:-}
rc=${3:-}
preview=${4:-}

if [[ -z $stable ]]; then
  echo "ERROR: 安定版がありません（安定版の無いサイトは公開しません）" >&2
  exit 1
fi

# 1 つの版を、出力先の下の dest に広げる
unpack() {
  local archive=$1 dest=$2
  if [[ ! -f $archive ]]; then
    echo "ERROR: $archive がありません" >&2
    exit 1
  fi
  mkdir -p "$dest"
  tar -xzf "$archive" -C "$dest"
}

rm -rf "$out"
unpack "$stable" "$out"
if [[ -n $rc ]]; then
  unpack "$rc" "$out/rc"
else
  mkdir -p "$out/rc"
  cp "$here/pages/rc-none.html" "$out/rc/index.html"
fi
if [[ -n $preview ]]; then unpack "$preview" "$out/preview"; fi
echo "サイトを $out に組み立てました（安定版・リリース候補版$([[ -n $rc ]] || echo '（案内のページ）')・プレビュー版$([[ -n $preview ]] || echo '（無し）')）"
