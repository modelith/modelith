#!/usr/bin/env bash
# Stop: エージェントが作業完了を宣言する前に高速チェックを走らせる。
# 失敗したら exit 2 で停止を差し戻し、エラー内容を修正させる。
set -uo pipefail

input="$(cat)"
# 差し戻し後の再停止では無限ループを避けるため通す
[[ "$(jq -r '.stop_hook_active // false' <<<"$input")" == "true" ]] && exit 0

cd "${CLAUDE_PROJECT_DIR:-.}"

# コード・ハーネス関連の変更が無ければ何もしない
changed="$( { git diff --name-only HEAD; git ls-files --others --exclude-standard; } 2>/dev/null)"
grep -qE '(\.(rs|ts|mjs)$|Cargo\.(toml|lock)$|package(-lock)?\.json$|^(scripts|reference)/)' <<<"$changed" || exit 0

if ! out="$(scripts/check.sh --fast 2>&1)"; then
  echo "scripts/check.sh --fast が失敗しました。修正してから完了してください。" >&2
  tail -n 60 <<<"$out" >&2
  exit 2
fi
exit 0
