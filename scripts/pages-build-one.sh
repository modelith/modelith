#!/usr/bin/env bash
# 1 つの版（タグ）を、1 つの公開の系列向けにテストして組み立て、tar.gz にまとめる（ADR-0022）。
#   scripts/pages-build-one.sh <タグ> <系列> <base> <出力先の .tar.gz>
#   例: scripts/pages-build-one.sh v0.2.0-rc.1 rc /modelith/rc/ modelith-web-rc.tar.gz
# できたものはワークフロー（.github/workflows/pages.yml）がそのリリースに添付し、次からは作り直さずに使う。
# 版の中身はタグのもの、組み立ての手順はこのスクリプト（dev）のものを使う。
# テストが落ちたときは、原因を追えるように、その版の結果（失敗時の画面・差分画像・トレース・レポート）を
# pages-test-results/<系列>/ に残す（ワークフローがアーティファクトとして上げる）。
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

tag=${1:?タグを渡してください}
channel=${2:?系列（stable・rc・preview）を渡してください}
base=${3:?base（/modelith/ など）を渡してください}
out=${4:?出力先の .tar.gz を渡してください}
case $out in /*) ;; *) out="$PWD/$out" ;; esac
failed_results="$PWD/pages-test-results/$channel"

# 今の作業ツリー（版のタグ）の .nvmrc にある Node.js を、PATH の先頭に置く。版ごとに、その版を出したときと同じ
# Node.js でテストして組み立てる（古い版のテストの道具が、新しい Node.js では動かないことがあるため）。
# CI では、ワークフローが setup-node で入れておいた版を RUNNER_TOOL_CACHE から探し、無ければ止める。
# 手元（RUNNER_TOOL_CACHE が無い）では今の node のまま使い、版が違えば知らせる
use_node_of_tag() {
  local want bin
  want=$(tr -d '[:space:]v' < .nvmrc)
  if [[ -n ${RUNNER_TOOL_CACHE:-} ]]; then
    bin=$(printf '%s\n' "$RUNNER_TOOL_CACHE"/node/"$want".*/x64/bin | grep -v '\*' | sort -V | tail -n 1)
    if [[ -z $bin ]]; then
      echo "ERROR: Node.js $want が入っていません（ワークフローで setup-node してください）" >&2
      exit 1
    fi
    PATH="$bin:$PATH"
  elif [[ $(node -p 'process.versions.node.split(".")[0]') != "$want" ]]; then
    echo "注意: この版は Node.js $want で作られていますが、今の Node.js は $(node -v) です" >&2
  fi
  echo "Node.js $(node -v) で確かめます"
}

dir=$(mktemp -d)
trap 'git worktree remove --force "$dir" 2>/dev/null || true' EXIT
git worktree add --detach "$dir" "$tag"
rm -rf "$failed_results"
(
  cd "$dir"
  use_node_of_tag
  npm ci --prefix web --ignore-scripts --no-audit --no-fund
  # 公開済みの版は後から直せないので、その版のテストの揺らぎで公開が止まらないよう、落ちたテストを 1 回だけやり直す
  # （やり直して通ったものは、レポートに不安定（flaky）として残る）
  if ! scripts/e2e.sh --retries=1; then
    mkdir -p "$failed_results"
    cp -r web/test-results web/reports "$failed_results/" 2>/dev/null || true
    echo "$channel（$tag）のテストが落ちたため公開しません。結果は pages-test-results/$channel/ にあります" >&2
    exit 1
  fi
  MODELITH_BASE=$base MODELITH_CHANNEL=$channel npm run build --prefix web
  cp -r web/reports web/dist/reports
  # reports/e2e/ の画面は Playwright（Apache-2.0）の配布物なので、LICENSE と NOTICE を添える（C-5）
  cp web/node_modules/playwright-core/{LICENSE,NOTICE,ThirdPartyNotices.txt} web/dist/reports/e2e/
  tar -czf "$out" -C web/dist .
)
echo "$channel（$tag）を $out にまとめました"
