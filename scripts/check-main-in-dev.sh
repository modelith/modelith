#!/usr/bin/env bash
# main に入れたものが dev に戻っているか（main が dev の祖先か）を確かめる（ADR-0022 §2）。
#   scripts/check-main-in-dev.sh [<main の参照>] [<dev の参照>]
#   既定は origin/main と HEAD。戻っていれば 0、戻っていなければ理由を標準エラーに出して 1、参照が無ければ 2 を返す。
# release-draft.sh が dev で下書きを作る前に、sync-check.yml が定期的に呼ぶ。
set -euo pipefail

main=${1:-origin/main}
dev=${2:-HEAD}

for ref in "$main" "$dev"; do
  if ! git rev-parse --verify --quiet "$ref^{commit}" >/dev/null; then
    echo "ERROR: $ref が見つかりません（main と dev を取ってきてから実行してください）" >&2
    exit 2
  fi
done

if git merge-base --is-ancestor "$main" "$dev"; then
  echo "main は dev に戻っています（$main は $dev の祖先）"
  exit 0
fi
missing=$(git rev-list --count "$dev..$main")
echo "ERROR: main の $missing 個のコミットが dev に戻っていません。main → dev（食い違うときは sync/* のブランチ）をマージコミットで入れてください（ADR-0022）" >&2
exit 1
