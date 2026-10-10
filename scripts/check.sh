#!/usr/bin/env bash
# ハーネスの単一エントリポイント。人間・AI エージェント・CI すべてがこれを実行する。
#   scripts/check.sh          フルチェック（fmt / clippy / test）
#   scripts/check.sh --fast   高速チェック（fmt / cargo check）※ Stop フック用
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

if [[ ! -f Cargo.toml ]]; then
  step "Cargo.toml が無いため Rust チェックをスキップ"
  exit 0
fi

step "cargo fmt --check"
cargo fmt --all -- --check

if [[ "$mode" == "fast" ]]; then
  step "cargo check"
  cargo check --workspace --all-targets --quiet
else
  step "cargo clippy"
  cargo clippy --workspace --all-targets --all-features -- -D warnings
  step "cargo test"
  cargo test --workspace --all-features
fi

step "OK ($mode)"
