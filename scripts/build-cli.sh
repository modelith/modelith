#!/usr/bin/env bash
# cli（`modelith mcp`・`modelith export`）を、配れる形（JavaScript）にする。出力は cli/dist/。
#   scripts/build-cli.sh           組み立てる
#   scripts/build-cli.sh --smoke   組み立てて、動くことと、パッケージに入るファイルを確かめる（scripts/check.sh が使う）
#
# 手元では TypeScript のソースを Node でそのまま動かすが、npm で入れたパッケージ（node_modules の下）では、
# Node が TypeScript を読まないので、JavaScript にして配る。束ねる道具は使わず、TypeScript のコンパイラだけで作る
# （cli と、cli が使う web/src の描画とコアの包みを、フォルダの形のまま cli/dist/ に出す）。コアの wasm は写す。
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

wasm_dir=web/src/core/wasm

build() {
  # アプリと同じコアの wasm を使う（ADR-0015）
  scripts/build-wasm.sh
  rm -rf cli/dist
  (cd cli && node_modules/.bin/tsc -p tsconfig.build.json)
  mkdir -p "cli/dist/$wasm_dir"
  cp "$wasm_dir/modelith_core.js" "$wasm_dir/modelith_core_bg.wasm" "cli/dist/$wasm_dir/"
  chmod +x cli/dist/cli/src/main.js
}

# 組み立てたものを動かし、公開のサンプルモデルの図を書き出せることと、パッケージに入るファイルを確かめる。
smoke() {
  local main=cli/dist/cli/src/main.js sample out files
  sample=$(mktemp -d)
  # shellcheck disable=SC2064  # 今の値（一時フォルダ）で片付ける
  trap "rm -rf '$sample'" EXIT
  cp web/src/samples/electric-kettle.sysml web/src/samples/electric-kettle.layout.json "$sample/"
  out=$(node "$main" export "$sample" --format svg --file electric-kettle.sysml)
  [[ $out == '<svg xmlns="http://www.w3.org/2000/svg"'* ]] || { echo "ERROR: 組み立てた cli が SVG を書き出しませんでした" >&2; exit 1; }
  out=$(node "$main" export "$sample" --format drawio --file electric-kettle.sysml)
  [[ $out == '<mxfile '* ]] || { echo "ERROR: 組み立てた cli が draw.io を書き出しませんでした" >&2; exit 1; }
  files=$(cd cli && npm pack --dry-run --json --ignore-scripts 2>/dev/null | node -e 'let s="";process.stdin.on("data",(d)=>s+=d).on("end",()=>console.log(JSON.parse(s)[0].files.map((f)=>f.path).join("\n")))')
  local need
  for need in dist/cli/src/main.js dist/web/src/render/index.js "dist/$wasm_dir/modelith_core_bg.wasm" package.json; do
    grep -qxF "$need" <<<"$files" || { echo "ERROR: パッケージに $need が入っていません" >&2; exit 1; }
  done
  if grep -E '(^|/)src/[^/]+\.ts$|\.test\.|node_modules/' <<<"$files" | grep -v '^dist/' >/dev/null; then
    echo "ERROR: パッケージに、ソースやテストが入っています" >&2
    exit 1
  fi
  if grep -E '\.test\.js$' <<<"$files" >/dev/null; then
    echo "ERROR: パッケージに、テストが入っています" >&2
    exit 1
  fi
  echo "cli: 組み立てたものが動き、パッケージの中身も正しい（$(wc -l <<<"$files") ファイル）"
}

build
[[ ${1:-} == --smoke ]] && smoke
echo "cli: cli/dist/ に組み立てました"
