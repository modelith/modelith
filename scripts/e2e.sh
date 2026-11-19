#!/usr/bin/env bash
# e2e と UI テスト（見た目）を実行する。check.sh と公開のワークフローが使う。
#   scripts/e2e.sh [Playwright の引数...]
#   例: scripts/e2e.sh e2e/visual.spec.ts --update-snapshots=all   （基準画像を作り直す）
#   同時に 2 つ動かすときは、PW_APP_PORT（アプリの配信。既定 4180）と PW_REFERENCE_PORT（基準のブラウザ。既定 3123）を変える
#
# 画面の画素は、OS のフォントや描画の設定で変わる。どこで動かしても同じ画像になるよう、
# ブラウザは Playwright の公式イメージ（Docker）の中で動かし、テストはそこへつなぐ（docs/development/testing.md）。
# Docker が無い手元では、手元のブラウザで e2e だけを動かし、UI テストは飛ばす（CI では Docker を必須にする）。
#
# e2e が失敗して終わったら、失敗したテストごとの要約（操作の一覧・ブラウザのエラー・失敗時の画面）を標準出力に出す。
# CI の成果物（trace・画面）を取り出せなくても、ログだけで調べられるようにするため（docs/development/testing.md）。
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# 渡したコマンド（e2e）を実行し、失敗したら、その実行で失敗したテストの要約を出す。終了コードは e2e のものをそのまま返す。
#   run_e2e <コマンド> [引数...]
run_e2e() {
  local started status=0
  started=$(date +%s)
  "$@" || status=$?
  if ((status != 0)); then
    # 要約は調べるための助け。作れなくても、e2e の終了コードは変えない
    node web/tools/e2e-failure-cli.ts web/test-results --since "$started" || true
  fi
  return "$status"
}

# アプリは Rust のコアの wasm を使う（ADR-0015）
scripts/build-wasm.sh

# クラウドの作業環境（Claude Code on the web）には Docker が入っているが、セッションの開始時にはデーモンが止まっている。
# そこで動いているときだけ、止まっていれば起動する（開発者のコンピュータでは何もしない）
if [[ ${CLAUDE_CODE_REMOTE:-} == true ]] && command -v dockerd >/dev/null && ! docker info >/dev/null 2>&1; then
  echo "Docker のデーモンを起動します（クラウドの作業環境）" >&2
  # デーモンは残り続けるので、呼び出し元から受け継いだファイル記述子（flock のロックなど）を閉じてから起動する。
  # 閉じないと、デーモンがそれを持ち続け、e2e が終わってもロックが解けない
  (
    for fd in /proc/self/fd/*; do
      n=${fd##*/}
      if ((n > 2)); then eval "exec ${n}>&-" 2>/dev/null || true; fi
    done
    exec nohup dockerd >/tmp/dockerd.log 2>&1
  ) &
  for _ in $(seq 30); do
    docker info >/dev/null 2>&1 && break
    sleep 1
  done
fi

if ! docker info >/dev/null 2>&1; then
  if [[ -n ${CI:-} ]]; then
    echo "ERROR: CI では、UI テストの基準のブラウザを動かすために Docker が必要です" >&2
    exit 1
  fi
  echo "注意: Docker が使えないので、UI テスト（見た目）は飛ばします。見た目は CI で比べます" >&2
  run_e2e npm run e2e --prefix web --silent -- "$@"
  exit
fi

# イメージの版は、テストを動かす Playwright と同じにする（つなぐには版が一致している必要がある）
version=$(node -p 'require("./web/package.json").devDependencies["@playwright/test"]')
if [[ ! $version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "ERROR: web/package.json の @playwright/test は版を固定してください（今: $version）" >&2
  exit 1
fi
image="mcr.microsoft.com/playwright:v${version}-noble"
port=${PW_REFERENCE_PORT:-3123}
name="modelith-reference-browser-$$"

# Playwright のサーバは、手元の node_modules（JavaScript だけを使う）を読み取り専用で借りて動かす
docker run -d --rm --init --name "$name" --user pwuser -w /pw \
  -p "127.0.0.1:${port}:${port}" -v "$PWD/web/node_modules:/pw/node_modules:ro" \
  "$image" node node_modules/@playwright/test/cli.js run-server --port "$port" --host 0.0.0.0 >/dev/null
trap 'docker stop "$name" >/dev/null 2>&1 || true' EXIT

for _ in $(seq 120); do
  docker logs "$name" 2>&1 | grep -q "Listening on" && break
  sleep 0.5
done
docker logs "$name" 2>&1 | grep -q "Listening on" || {
  echo "ERROR: 基準のブラウザが起動しませんでした" >&2
  docker logs "$name" >&2 || true
  exit 1
}

run_e2e env PW_REFERENCE_WS="ws://127.0.0.1:${port}/" npm run e2e --prefix web --silent -- "$@"
