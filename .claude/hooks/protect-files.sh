#!/usr/bin/env bash
# PreToolUse(Edit|Write): 凍結ファイル・生成物をエージェントが直接書き換えないようにする。
set -euo pipefail

file="$(jq -r '.tool_input.file_path // .tool_input.notebook_path // ""')"
rel="${file#"${CLAUDE_PROJECT_DIR:-$PWD}"/}"

case "$rel" in
  reference/mock/*)
    msg="reference/mock/ は凍結した仕様書です（ADR-0002）。挙動の変更は ADR を追加してから行ってください。" ;;
  reference/golden/*.json)
    msg="ゴールデン JSON は生成物です。reference/golden/cases/ にケースを足し 'node reference/tools/gen-golden.mjs' で再生成してください。" ;;
  */package-lock.json | package-lock.json | Cargo.lock)
    msg="lock ファイルは手で編集せず、npm / cargo コマンドで更新してください。" ;;
  *) exit 0 ;;
esac
echo "BLOCKED: $msg" >&2
exit 2
