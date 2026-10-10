#!/usr/bin/env bash
# PR の向け先とマージ元の組み合わせがブランチ戦略に沿っているか検証する（ADR-0007）。
#   scripts/check-pr-base.sh <base> <head>
#
#   main ← dev     リリース
#   main ← fix/*   緊急修正
#   dev  ← main    緊急修正後の同期
#   dev  ← その他  通常の作業（トピックブランチ）
set -euo pipefail

base="${1:?usage: $0 <base> <head>}"
head="${2:?usage: $0 <base> <head>}"

fail() {
  echo "ERROR: $head → $base の PR はブランチ戦略で認められていません。$1" >&2
  echo "  詳細: docs/development/branching-strategy.md" >&2
  exit 1
}

case "$base" in
  main)
    [[ "$head" == "dev" || "$head" == fix/* ]] ||
      fail "通常の作業は dev に向けてください（main へは dev のリリースか fix/* の緊急修正のみ）。" ;;
  dev) ;;
  *) ;; # 積み上げたブランチ同士の PR は対象外
esac
echo "PR base OK: $head → $base"
