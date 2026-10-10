#!/usr/bin/env bash
# SessionStart: 作業開始時にツールチェーンを揃え、現在のブランチ状況をエージェントに伝える。
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}"

if command -v rustup >/dev/null; then
  rustup component add rustfmt clippy >/dev/null 2>&1 || true
fi

branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
echo "現在のブランチ: $branch"
if [[ "$branch" == "main" || "$branch" == "dev" ]]; then
  echo "注意: $branch 上にいます。変更前に 'git switch dev && git switch -c <type>/<topic>' でブランチを作成してください。"
fi
echo "PR の向け先は dev。トピック → dev は CI グリーンなら Squash で自分でマージしてよい。main へのマージはメンテナの許可が必要。"
echo "完了条件: scripts/check.sh がグリーンであること（詳細は CLAUDE.md）。"
exit 0
