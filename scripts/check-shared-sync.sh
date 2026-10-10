#!/usr/bin/env bash
# 共有ファイル（scripts/lib/shared-files.txt）が相手リポジトリ（harness.conf の HARNESS_SHARED_WITH）と
# 同一かを照合する。相手の取得元は HARNESS_RAW_BASE（既定 https://raw.githubusercontent.com）。
#   scripts/check-shared-sync.sh [ref]   相手リポジトリのブランチ（既定 dev）
set -euo pipefail
# shellcheck source=lib/load.sh
source "$(dirname "$0")/lib/load.sh"
harness_load
cd "$HARNESS_ROOT"

ref="${1:-dev}"
base="${HARNESS_RAW_BASE:-https://raw.githubusercontent.com}"
remote="$(mktemp)"
trap 'rm -f "$remote"' EXIT

differs=0
while read -r path; do
  if ! curl -fsS --max-time 20 -o "$remote" "$base/$HARNESS_SHARED_WITH/$ref/$path" 2>/dev/null; then
    echo "missing: $path（$HARNESS_SHARED_WITH@$ref に無い）"
    differs=1
  elif ! cmp -s "$remote" "$path"; then
    echo "differs: $path"
    differs=1
  fi
done < <(grep -vE '^(#|$)' scripts/lib/shared-files.txt)

((differs == 0)) && echo "shared files: $HARNESS_SHARED_WITH@$ref と一致"
exit "$differs"
