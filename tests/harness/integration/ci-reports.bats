#!/usr/bin/env bats
# scripts/ci-reports.sh の結合テスト。失敗した CI のテスト結果のページを、別のオリジンの置き場所に置く（docs/development/testing.md）。
# GitHub の API は PATH に置いた gh のスタブ、置き場所は file:// の手元のリポジトリで置き換え、
# 「成果物を取り出す → 置き場所に足す・掃除する → 置き換える → PR にコメントする」の配線を確かめる
# （どれを置くか・どれを消すか・一覧の HTML の網羅は、単体テスト web/tools/ci-reports.test.ts で行う）。

load ../helpers

SHA=0123456789abcdef0123456789abcdef01234567

# gh のスタブを PATH に置く。答えは $FIXTURES_DIR のファイルから返し、呼ばれ方を $GH_LOG に書く。
install_gh_stub() {
  local bin="$BATS_TEST_TMPDIR/bin"
  mkdir -p "$bin"
  cat >"$bin/gh" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >>"$GH_LOG"
case "$*" in
  *"--method "*) ;;
  *"/issues/"*"/comments"*) cat "$FIXTURES_DIR/comments.jsonl" ;;
  *"/zip") cat "$FIXTURES_DIR/artifact.zip" ;;
  *"/jobs"*) cat "$FIXTURES_DIR/jobs.json" ;;
  *"/artifacts"*) cat "$FIXTURES_DIR/artifacts.json" ;;
  *"/pulls"*) cat "$FIXTURES_DIR/pulls.json" ;;
  *"/actions/runs/"*) cat "$FIXTURES_DIR/run.json" ;;
  *) echo "gh stub: 知らない呼び出し: $*" >&2; exit 1 ;;
esac
STUB
  chmod +x "$bin/gh"
  PATH="$bin:$PATH"
}

# 実行の答え（API）を作る: write_run <実行の ID> [<きっかけ>] [<結び付いた PR の JSON>]
write_run() {
  jq -n --argjson id "$1" --arg event "${2:-pull_request}" --arg sha "$SHA" --argjson pulls "${3:-[]}" '{
    id: $id, run_attempt: 1, head_branch: "fix/<b>", head_sha: $sha, event: $event,
    run_started_at: "2026-11-19T01:02:03Z", repository: {full_name: "modelith/modelith"}, pull_requests: $pulls
  }' >"$FIXTURES_DIR/run.json"
}

# 成果物の zip を作る（Playwright のレポートの入口・シンボリックリンク・.gitattributes を入れる）。
write_artifact() {
  local src="$BATS_TEST_TMPDIR/artifact-src"
  mkdir -p "$src/e2e"
  echo '<p>report</p>' >"$src/e2e/index.html"
  echo '<p>requirements</p>' >"$src/requirements.html"
  # リンクの先は相対パスにする（macOS の unzip は、絶対パスを指すリンクを取り出さずに失敗するため。消すことを確かめるのは同じ）
  ln -s ../requirements.html "$src/e2e/link"
  echo '* filter=x' >"$src/.gitattributes"
  (cd "$src" && zip -q -r -y "$FIXTURES_DIR/artifact.zip" .)
  echo '{"artifacts":[{"id":9,"name":"test-reports","expired":false,"size_in_bytes":100,"created_at":"2026-11-19T01:30:00Z"}]}' >"$FIXTURES_DIR/artifacts.json"
}

# 置き場所に、古い実行を 1 つ置く（直接コミットする）: seed_run <実行の ID> <置いた日（2 桁）>
seed_run() {
  local dir="$SEED/runs/$1-1"
  mkdir -p "$dir/report/e2e"
  echo old >"$dir/report/e2e/index.html"
  jq -n --argjson id "$1" --arg sha "$SHA" --arg day "$2" '{
    key: "\($id)-1", runId: $id, attempt: 1, repository: "modelith/modelith", branch: "dev", sha: $sha, pr: null, event: "push",
    startedAt: "2026-10-\($day)T00:00:00Z", publishedAt: "2026-10-\($day)T00:00:00Z", bytes: 4, pages: ["e2e/index.html"]
  }' >"$dir/meta.json"
  git -C "$SEED" add runs
  git -C "$SEED" -c user.email=t@example.com -c user.name=t commit -q -m "seed $1"
  git -C "$SEED" push -q origin main
}

# fetch から push までを通す: publish <実行の ID>
publish() {
  write_run "$1"
  "$REPO_ROOT/scripts/ci-reports.sh" fetch "$1" "$WORK"
  "$REPO_ROOT/scripts/ci-reports.sh" assemble "$WORK"
  "$REPO_ROOT/scripts/ci-reports.sh" push "$WORK"
}

setup() {
  bats_require_minimum_version 1.5.0
  WORK="$BATS_TEST_TMPDIR/work"
  FIXTURES_DIR="$BATS_TEST_TMPDIR/fixtures"
  GH_LOG="$BATS_TEST_TMPDIR/gh.log"
  REMOTE="$BATS_TEST_TMPDIR/remote.git"
  SEED="$BATS_TEST_TMPDIR/seed"
  mkdir -p "$FIXTURES_DIR"
  : >"$GH_LOG"
  : >"$FIXTURES_DIR/comments.jsonl"
  echo '[]' >"$FIXTURES_DIR/pulls.json"
  echo '{"jobs":[{"name":"check","conclusion":"failure"}]}' >"$FIXTURES_DIR/jobs.json"
  write_run 5
  write_artifact
  install_gh_stub
  # 置き場所（README だけがあるリポジトリ）
  git init -q --bare -b main "$REMOTE"
  git init -q -b main "$SEED"
  echo '# reports' >"$SEED/README.md"
  git -C "$SEED" add README.md
  git -C "$SEED" -c user.email=t@example.com -c user.name=t commit -q -m init
  git -C "$SEED" remote add origin "file://$REMOTE"
  git -C "$SEED" push -q origin main
  export FIXTURES_DIR GH_LOG PATH
  export GITHUB_REPOSITORY=modelith/modelith GH_TOKEN=dummy CI_REPORTS_TOKEN=dummy
  export CI_REPORTS_REPOSITORY="file://$REMOTE" CI_REPORTS_SITE_URL=https://reports.example
  unset GITHUB_OUTPUT
}

@test "ci-reports fetch: 成果物を取り出し、シンボリックリンクと .git* を消す（正常系）" {
  # Arrange（setup の成果物）
  # Act
  run --separate-stderr "$REPO_ROOT/scripts/ci-reports.sh" fetch 5 "$WORK"
  # Assert
  [ "$status" -eq 0 ]
  [ "$output" = "found=true" ]
  [ "$(cat "$WORK/artifact/e2e/index.html")" = '<p>report</p>' ]
  [ ! -e "$WORK/artifact/e2e/link" ] && [ ! -L "$WORK/artifact/e2e/link" ]
  [ ! -e "$WORK/artifact/.gitattributes" ]
}

@test "ci-reports fetch: 成果物が無ければ、何も置かずに正常終了する（境界値）" {
  # Arrange
  echo '{"artifacts":[]}' >"$FIXTURES_DIR/artifacts.json"
  # Act
  run --separate-stderr "$REPO_ROOT/scripts/ci-reports.sh" fetch 5 "$WORK"
  # Assert
  [ "$status" -eq 0 ]
  [ "$output" = "found=false" ]
  [[ $stderr == *"成果物 test-reports が無い"* ]]
  [ ! -e "$WORK/artifact" ]
}

@test "ci-reports fetch: check ジョブが失敗していなければ、成果物があっても置かない" {
  # Arrange
  echo '{"jobs":[{"name":"conventions","conclusion":"failure"},{"name":"check","conclusion":"success"}]}' >"$FIXTURES_DIR/jobs.json"
  # Act
  run --separate-stderr "$REPO_ROOT/scripts/ci-reports.sh" fetch 5 "$WORK"
  # Assert
  [ "$status" -eq 0 ]
  [ "$output" = "found=false" ]
  [ "$(grep -c '/zip' "$GH_LOG" || true)" -eq 0 ]
}

@test "ci-reports fetch: 入口のページが無い成果物は置かない" {
  # Arrange
  rm "$FIXTURES_DIR/artifact.zip"
  echo x >"$BATS_TEST_TMPDIR/other.txt"
  (cd "$BATS_TEST_TMPDIR" && zip -q "$FIXTURES_DIR/artifact.zip" other.txt)
  # Act
  run --separate-stderr "$REPO_ROOT/scripts/ci-reports.sh" fetch 5 "$WORK"
  # Assert
  [ "$status" -eq 0 ]
  [ "$output" = "found=false" ]
  [[ $stderr == *"見るページが無い"* ]]
}

@test "ci-reports fetch: 手順の出力は GITHUB_OUTPUT に書く" {
  # Arrange
  export GITHUB_OUTPUT="$BATS_TEST_TMPDIR/output"
  # Act
  run "$REPO_ROOT/scripts/ci-reports.sh" fetch 5 "$WORK"
  # Assert
  [ "$status" -eq 0 ]
  [ "$(cat "$GITHUB_OUTPUT")" = "found=true" ]
}

@test "ci-reports fetch: 実行の ID が数でなければ、API を呼ばずに失敗する（異常系）" {
  # Arrange（シェルの文になりうる文字列）
  local run_id='5; echo x'
  # Act
  run "$REPO_ROOT/scripts/ci-reports.sh" fetch "$run_id" "$WORK"
  # Assert
  [ "$status" -eq 1 ]
  [ ! -s "$GH_LOG" ]
}

@test "ci-reports fetch: 実行の答えの形が違えば失敗する（異常系）" {
  # Arrange
  echo '{"message":"Not Found"}' >"$FIXTURES_DIR/run.json"
  # Act
  run "$REPO_ROOT/scripts/ci-reports.sh" fetch 5 "$WORK"
  # Assert
  [ "$status" -eq 1 ]
}

@test "ci-reports assemble・push: runs/<ID>-<回数>/ に置き、一覧を作り、元からあるファイルは残す（正常系）" {
  # Arrange（setup の置き場所と成果物）
  # Act
  run publish 5
  # Assert
  [ "$status" -eq 0 ]
  [ "$(git -C "$REMOTE" show main:runs/5-1/report/e2e/index.html)" = '<p>report</p>' ]
  [ "$(git -C "$REMOTE" show main:runs/5-1/meta.json | jq -r '.key + " " + .branch + " " + (.pages | join(","))')" = "5-1 fix/<b> e2e/index.html,requirements.html" ]
  [ "$(git -C "$REMOTE" show main:README.md)" = '# reports' ]
  git -C "$REMOTE" cat-file -e main:.nojekyll
  git -C "$REMOTE" show main:index.html | grep -q 'href="runs/5-1/report/e2e/index.html"'
  # ブランチ名は、一覧では HTML としてエスケープされている
  git -C "$REMOTE" show main:index.html | grep -q '<code>fix/&lt;b&gt;</code>'
}

@test "ci-reports assemble・push: 置き場所の履歴は、何度置いても 1 つのコミットだけ" {
  # Arrange
  publish 5
  # Act
  run publish 6
  # Assert
  [ "$status" -eq 0 ]
  [ "$(git -C "$REMOTE" rev-list --count main)" -eq 1 ]
  git -C "$REMOTE" cat-file -e main:runs/5-1/meta.json
  git -C "$REMOTE" cat-file -e main:runs/6-1/meta.json
}

@test "ci-reports assemble・push: 同じ実行をもう一度置くと、置き換える（前の中身を残さない）" {
  # Arrange
  seed_run 5 01
  # Act
  run publish 5
  # Assert
  [ "$status" -eq 0 ]
  [ "$(git -C "$REMOTE" show main:runs/5-1/report/e2e/index.html)" = '<p>report</p>' ]
}

@test "ci-reports assemble・push: 11 回分になったら、最も古い 1 回分を消す（境界値）" {
  # Arrange（古い実行を 10 回分）
  local i
  for i in 01 02 03 04 05 06 07 08 09 10; do seed_run "1$i" "$i"; done
  # Act
  run publish 5
  # Assert
  [ "$status" -eq 0 ]
  [ "$(git -C "$REMOTE" ls-tree --name-only main:runs | wc -l)" -eq 10 ]
  [ "$(status_of git -C "$REMOTE" cat-file -e main:runs/101-1/meta.json)" -ne 0 ]
  git -C "$REMOTE" cat-file -e main:runs/102-1/meta.json
  git -C "$REMOTE" cat-file -e main:runs/5-1/meta.json
  [ "$(git -C "$REMOTE" show main:index.html | grep -c 'runs/101-1/' || true)" -eq 0 ]
}

@test "ci-reports push: 取ってきたあとに置き場所が変わっていたら、置き換えずに失敗する（異常系）" {
  # Arrange
  "$REPO_ROOT/scripts/ci-reports.sh" fetch 5 "$WORK"
  "$REPO_ROOT/scripts/ci-reports.sh" assemble "$WORK"
  seed_run 77 01
  local before
  before=$(git -C "$REMOTE" rev-parse main)
  # Act
  run "$REPO_ROOT/scripts/ci-reports.sh" push "$WORK"
  # Assert
  [ "$status" -ne 0 ]
  [ "$(git -C "$REMOTE" rev-parse main)" = "$before" ]
}

@test "ci-reports comment: 前のコメントが無ければ、PR に新しく付ける（正常系）" {
  # Arrange
  write_run 5 pull_request "[{\"number\":12,\"head\":{\"sha\":\"$SHA\"}}]"
  "$REPO_ROOT/scripts/ci-reports.sh" fetch 5 "$WORK"
  "$REPO_ROOT/scripts/ci-reports.sh" assemble "$WORK"
  # Act
  run "$REPO_ROOT/scripts/ci-reports.sh" comment "$WORK"
  # Assert
  [ "$status" -eq 0 ]
  grep -q -- '--method POST repos/modelith/modelith/issues/12/comments -f body=<!-- ci-reports -->' "$GH_LOG"
  grep -q 'https://reports.example/runs/5-1/report/e2e/index.html' "$GH_LOG"
}

@test "ci-reports comment: 前に付けたコメントがあれば、それを書き換える（増やさない）" {
  # Arrange
  write_run 5 pull_request "[{\"number\":12,\"head\":{\"sha\":\"$SHA\"}}]"
  "$REPO_ROOT/scripts/ci-reports.sh" fetch 5 "$WORK"
  "$REPO_ROOT/scripts/ci-reports.sh" assemble "$WORK"
  printf '%s\n' '{"id":1,"login":"someone","body":"LGTM"}' '{"id":70,"login":"github-actions[bot]","body":"<!-- ci-reports -->\n前の結果"}' >"$FIXTURES_DIR/comments.jsonl"
  # Act
  run "$REPO_ROOT/scripts/ci-reports.sh" comment "$WORK"
  # Assert
  [ "$status" -eq 0 ]
  grep -q -- '--method PATCH repos/modelith/modelith/issues/comments/70 ' "$GH_LOG"
  [ "$(grep -c -- '--method POST' "$GH_LOG" || true)" -eq 0 ]
}

@test "ci-reports comment: PR の実行でなければ、コメントを付けない（境界値）" {
  # Arrange
  write_run 5 push
  "$REPO_ROOT/scripts/ci-reports.sh" fetch 5 "$WORK"
  "$REPO_ROOT/scripts/ci-reports.sh" assemble "$WORK"
  # Act
  run "$REPO_ROOT/scripts/ci-reports.sh" comment "$WORK"
  # Assert
  [ "$status" -eq 0 ]
  [ "$(grep -c -- '--method' "$GH_LOG" || true)" -eq 0 ]
  [ "$(grep -c '/issues/' "$GH_LOG" || true)" -eq 0 ]
}

@test "ci-reports: 知らないコマンド・引数の不足は失敗する（異常系）" {
  # Arrange / Act
  local unknown missing
  unknown=$(status_of "$REPO_ROOT/scripts/ci-reports.sh" publish "$WORK")
  missing=$(status_of "$REPO_ROOT/scripts/ci-reports.sh" fetch 5)
  # Assert
  [ "$unknown" -eq 1 ]
  [ "$missing" -eq 1 ]
}
