# shellcheck shell=bash
# プログラミング原則・テスト原則のうち機械的に検査できるものの判断ロジック。
# .claude/skills/programming-principles/ と .claude/skills/testing-principles/ の「ハーネスで強制する項目」に対応する。
# 検査関数は「問題なし」で 0、「違反」で 1 を返し、違反を 1 行ずつ標準出力に出す。

# スクリプトごとに、同名（拡張子を除く）の bats テストが <test_root> 配下にあるか。
#   principles_missing_tests <test_root> <script>...
principles_missing_tests() {
  local test_root=$1 script name missing=0
  shift
  for script in "$@"; do
    name="$(basename "${script%.*}")"
    if [[ -z "$(find "$test_root" -name "$name.bats" -not -path '*/fixtures/*' -print -quit)" ]]; then
      echo "$script: テストがありません（$test_root/{unit,integration,system}/$name.bats を作成してください）"
      missing=1
    fi
  done
  return "$missing"
}

# シェル関数の行数が上限を超えていないか（単一責任の目安）。
#   principles_long_functions <max_lines> <file>...
principles_long_functions() {
  local max=$1
  shift
  awk -v max="$max" '
    /^[A-Za-z_][A-Za-z0-9_]*\(\)[[:space:]]*\{/ { name = $1; sub(/\(\).*/, "", name); start = FNR; next }
    /^\}/ && name != "" {
      len = FNR - start - 1
      if (len > max) { printf "%s:%d: 関数 %s が %d 行あります（上限 %d 行）\n", FILENAME, start, name, len, max; bad = 1 }
      name = ""
    }
    END { exit bad }
  ' "$@"
}

# ファイルの行数が上限を超えていないか（責務の詰め込みすぎの目安）。
#   principles_long_files <max_lines> <file>...
principles_long_files() {
  local max=$1 file lines bad=0
  shift
  for file in "$@"; do
    lines=$(wc -l <"$file")
    if ((lines > max)); then
      echo "$file: $lines 行あります（上限 $max 行）。責務ごとに分割してください"
      bad=1
    fi
  done
  return "$bad"
}
