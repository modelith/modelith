#!/usr/bin/env bash
# 失敗した CI のテスト結果のページ（Playwright のレポートと操作の記録）を、アプリとは別のオリジンの置き場所に置く。
# .github/workflows/ci-reports.yml が、手順ごとに呼ぶ（docs/development/testing.md の「失敗した CI のテスト結果のページ」）。
#   scripts/ci-reports.sh fetch <実行の ID> <作業用のディレクトリ>   成果物を取り出す（置くものが無ければ found=false）
#   scripts/ci-reports.sh assemble <作業用のディレクトリ>            置き場所を取ってきて、今回の分を足し、古い分を消し、一覧を作り直す
#   scripts/ci-reports.sh push <作業用のディレクトリ>                置き場所へ書き込む
#   scripts/ci-reports.sh comment <作業用のディレクトリ>             PR にリンクのコメントを付ける（前のコメントがあれば書き換える）
#
# ここは入出力（GitHub の API・git・ファイルの写し）だけ。判断（どれを置くか・どれを消すか・一覧の HTML）は web/tools/ci-reports.ts。
# 手順を分けているのは、トークンを要る手順にだけ渡すため：
#   fetch・comment は GH_TOKEN（このリポジトリの成果物を読む・PR にコメントする）、push は CI_REPORTS_TOKEN（置き場所へ書く）、assemble は何も要らない。
#
# 成果物は PR の中身から作られた、信頼できない入力として扱う：写すだけで、中のものを読まない・実行しない。
#
# 置き場所のブランチは、毎回「親の無い 1 つのコミット」に作り直して置き換える（force-push）。
# 1 回分が約 60 MB あり、コミットを積むとリポジトリがすぐ大きくなるため。置き場所は生成物だけのリポジトリで、
# 本体のリポジトリの「force-push 禁止」（docs/development/branching-strategy.md）は、ここには当てはめない。
#
# 環境変数（リポジトリ固有の値はワークフローが渡す）:
#   GITHUB_REPOSITORY      実行を調べるリポジトリ（owner/name）。fetch・comment
#   GH_TOKEN               gh が使うトークン。fetch・comment
#   CI_REPORTS_REPOSITORY  置き場所のリポジトリの URL。assemble
#   CI_REPORTS_BRANCH      置き場所のブランチ（既定は main）。assemble・push
#   CI_REPORTS_TOKEN       置き場所へ書くトークン。push
#   CI_REPORTS_AUTHOR      置き場所のコミットの作者の名前（既定は modelith-ci-reports[bot]）。assemble
#   CI_REPORTS_SITE_URL    置き場所のサイトの URL。comment
#   GITHUB_OUTPUT          手順の出力の書き先（無ければ書かない）。fetch
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
CLI=("node" "$ROOT/web/tools/ci-reports-cli.ts")
BRANCH=${CI_REPORTS_BRANCH:-main}

# 使い方の誤りなどで止める。
#   die <理由>
die() {
  echo "ERROR: $*" >&2
  exit 1
}

# 手順の出力（GitHub Actions の steps.<id>.outputs）を書く。GITHUB_OUTPUT が無ければ（手元では）標準出力に出す。
#   output <名前> <値>
output() {
  if [[ -n ${GITHUB_OUTPUT:-} ]]; then
    echo "$1=$2" >>"$GITHUB_OUTPUT"
  else
    echo "$1=$2"
  fi
}

# 成果物を取り出し、置けるものを <作業用のディレクトリ>/artifact に置く。出力 found は、置くものがあれば true。
#   fetch_report <実行の ID> <作業用のディレクトリ>
fetch_report() {
  local run_id=$1 work=$2 api attempt sha artifact_id unzip_status=0 prepare_status=0
  [[ $run_id =~ ^[1-9][0-9]*$ ]] || die "実行の ID は数で指定してください: $run_id"
  api="repos/${GITHUB_REPOSITORY:?}/actions"
  # 前の実行の残りを混ぜないよう、空のディレクトリから始める
  rm -rf "$work"
  mkdir -p "$work"

  gh api "$api/runs/$run_id" >"$work/run.json"
  # 形を確かめる（確かめられなければ、ここで止まる）
  "${CLI[@]}" key "$work/run.json" >/dev/null
  attempt=$(jq -r '.run_attempt' "$work/run.json")
  sha=$(jq -r '.head_sha' "$work/run.json")
  gh api "$api/runs/$run_id/attempts/$attempt/jobs?per_page=100" >"$work/jobs.json"
  gh api "$api/runs/$run_id/artifacts?per_page=100" >"$work/artifacts.json"
  # フォークの PR は実行に PR が結び付かないので、コミットからも探す。取れなくても、コメントを省くだけ
  gh api "repos/$GITHUB_REPOSITORY/commits/$sha/pulls?per_page=100" >"$work/pulls.json" 2>/dev/null || echo '[]' >"$work/pulls.json"

  artifact_id=$("${CLI[@]}" artifact "$work/artifacts.json" "$work/jobs.json")
  if [[ -z $artifact_id ]]; then
    output found false
    return 0
  fi

  gh api "$api/artifacts/$artifact_id/zip" >"$work/artifact.zip"
  mkdir "$work/artifact"
  # unzip は、zip の中の「..」や絶対パスを外へ書かない。終了コード 1 は警告（そういう名前を直した、など）で、取り出しは済んでいる
  unzip -q -o "$work/artifact.zip" -d "$work/artifact" || unzip_status=$?
  ((unzip_status <= 1)) || die "成果物の zip を取り出せませんでした（unzip の終了コード $unzip_status）"
  rm -f "$work/artifact.zip"
  # zip が持っていた許可（読めない・たどれない）で、あとの手順が止まらないようにする
  chmod -R u+rwX "$work/artifact"

  "${CLI[@]}" prepare "$work/artifact" || prepare_status=$?
  case $prepare_status in
    0) output found true ;;
    3) output found false ;;
    *) die "成果物を調べられませんでした" ;;
  esac
}

# 置き場所を取ってきて、今回の分を足し、古い分を消し、一覧を作り直して、親の無いコミットを作る（書き込みはしない）。
#   assemble_site <作業用のディレクトリ>
# 作ったコミットは <作業用のディレクトリ>/commit、取ってきたときの先頭は <作業用のディレクトリ>/base に書く。
assemble_site() {
  local work=$1 site key target published tree commit
  site="$work/site"
  key=$("${CLI[@]}" key "$work/run.json")
  rm -rf "$site"
  git clone --quiet --depth 1 --branch "$BRANCH" "${CI_REPORTS_REPOSITORY:?}" "$site"

  target="$site/runs/$key"
  # 同じ実行をもう一度置くとき（手で起動したとき）は、置き換える
  rm -rf "$target"
  mkdir -p "$target"
  cp -R "$work/artifact" "$target/report"
  published=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  "${CLI[@]}" meta "$work/run.json" "$work/pulls.json" "$target/report" "$published" >"$target/meta.json"

  echo "消した古い実行:"
  "${CLI[@]}" prune "$site"
  "${CLI[@]}" index "$site"

  # 親の無いコミットにする（履歴を積まない）。--force は、実行環境の無視の設定に左右されずに、あるものをすべて入れるため
  git -C "$site" add --all --force
  tree=$(git -C "$site" write-tree)
  commit=$(
    GIT_AUTHOR_NAME=${CI_REPORTS_AUTHOR:-modelith-ci-reports[bot]} GIT_AUTHOR_EMAIL=ci-reports@modelith.invalid \
      GIT_COMMITTER_NAME=${CI_REPORTS_AUTHOR:-modelith-ci-reports[bot]} GIT_COMMITTER_EMAIL=ci-reports@modelith.invalid \
      git -C "$site" commit-tree "$tree" -m "chore: publish CI test results ($key)"
  )
  git -C "$site" rev-parse HEAD >"$work/base"
  echo "$commit" >"$work/commit"
  echo "置く実行: $key（$(du -sh "$target" | cut -f1)）。置き場所の全体: $(du -sh --exclude=.git "$site" | cut -f1)"
}

# 作ったコミットで、置き場所のブランチを置き換える。取ってきたあとに誰かが書き込んでいたら、置き換えずに失敗する。
#   push_site <作業用のディレクトリ>
push_site() {
  local work=$1 commit base
  commit=$(<"$work/commit")
  base=$(<"$work/base")
  : "${CI_REPORTS_TOKEN:?}"
  # トークンは環境変数のまま git に渡す（コマンドの引数・URL・設定のファイルに書かない）
  # shellcheck disable=SC2016  # $CI_REPORTS_TOKEN は、git が呼ぶシェルで展開させる
  git -C "$work/site" \
    -c credential.helper= \
    -c credential.helper='!f() { echo username=x-access-token; echo "password=$CI_REPORTS_TOKEN"; }; f' \
    push --quiet --force-with-lease="$BRANCH:$base" origin "$commit:refs/heads/$BRANCH"
  echo "置き場所の $BRANCH を $commit に置き換えました"
}

# PR に、結果のページへのリンクのコメントを付ける。前に付けたコメントがあれば書き換える。PR の実行でなければ何もしない。
#   comment_on_pull_request <作業用のディレクトリ>
comment_on_pull_request() {
  local work=$1 meta pr body existing
  meta="$work/site/runs/$("${CLI[@]}" key "$work/run.json")/meta.json"
  pr=$(jq -r '.pr // empty' "$meta")
  if [[ -z $pr ]]; then
    echo "PR の実行ではない（または PR が見つからない）ので、コメントは付けません"
    return 0
  fi
  [[ $pr =~ ^[1-9][0-9]*$ ]] || die "PR の番号が数ではありません"
  body=$("${CLI[@]}" comment "$meta" "${CI_REPORTS_SITE_URL:?}")
  existing=$(
    gh api --paginate "repos/${GITHUB_REPOSITORY:?}/issues/$pr/comments?per_page=100" --jq '.[] | {id, login: .user.login, body} | tojson' |
      "${CLI[@]}" comment-id
  )
  if [[ -n $existing ]]; then
    gh api --method PATCH "repos/$GITHUB_REPOSITORY/issues/comments/$existing" -f body="$body" --silent
    echo "PR #$pr のコメントを書き換えました"
  else
    gh api --method POST "repos/$GITHUB_REPOSITORY/issues/$pr/comments" -f body="$body" --silent
    echo "PR #$pr にコメントを付けました"
  fi
}

case ${1:-} in
  fetch)
    [[ $# -eq 3 ]] || die "使い方: scripts/ci-reports.sh fetch <実行の ID> <作業用のディレクトリ>"
    fetch_report "$2" "$3"
    ;;
  assemble)
    [[ $# -eq 2 ]] || die "使い方: scripts/ci-reports.sh assemble <作業用のディレクトリ>"
    assemble_site "$2"
    ;;
  push)
    [[ $# -eq 2 ]] || die "使い方: scripts/ci-reports.sh push <作業用のディレクトリ>"
    push_site "$2"
    ;;
  comment)
    [[ $# -eq 2 ]] || die "使い方: scripts/ci-reports.sh comment <作業用のディレクトリ>"
    comment_on_pull_request "$2"
    ;;
  *) die "使い方: scripts/ci-reports.sh fetch|assemble|push|comment …（このファイルの先頭）" ;;
esac
