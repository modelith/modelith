#!/usr/bin/env bash
# ハーネスの単一エントリポイント。人間・AI エージェント・CI すべてがこれを実行する。
#   scripts/check.sh          フルチェック
#   scripts/check.sh --fast   高速チェック（Stop フック用）
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

mode="full"
[[ "${1:-}" == "--fast" ]] && mode="fast"

step() { printf '\n==> %s\n' "$*"; }

step "branch name"
scripts/check-branch-name.sh

# 非公開のモック・依存物・ビルド成果物が Git 管理下に入っていないか（guard-git.sh と同じパターン）
step "forbidden files"
FORBIDDEN='(^|/)node_modules/|^reference/mock/|^target/'
if tracked="$(git ls-files | grep -E "$FORBIDDEN")"; then
  echo "ERROR: コミットしてはいけないファイルが Git 管理下にあります:" >&2
  echo "$tracked" | head -20 >&2
  exit 1
fi

step "rust: fmt"
cargo fmt --all -- --check

if [[ "$mode" == "fast" ]]; then
  step "rust: check"
  cargo check --workspace --all-targets --quiet
else
  step "rust: clippy"
  cargo clippy --workspace --all-targets --all-features -- -D warnings
  step "rust: test"
  cargo test --workspace --all-features
  step "wasm: build (wasm32-unknown-unknown)"
  cargo build -p modelith-wasm --target wasm32-unknown-unknown --quiet
fi

step "golden: モックの出力と reference/golden が一致するか"
node reference/tools/gen-golden.mjs --check

step "web: typecheck"
[[ -d web/node_modules ]] || npm ci --prefix web --no-audit --no-fund
npm run --prefix web -s typecheck

if [[ "$mode" == "full" ]]; then
  step "web: test"
  npm run --prefix web -s test
fi

step "OK ($mode)"
