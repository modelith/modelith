#!/usr/bin/env bash
# cli が PNG を書き出すときに使うフォントを、cli/fonts/ に取ってくる（ADR-0029 の 2）。
# フォントはリポジトリに入れない（合わせて 9MB ほどあり、履歴に残り続けるため）。決めた版（コミット）を、ハッシュを確かめて取る。
# 既にあって、ハッシュが合っていれば、何もしない。
#   scripts/fetch-fonts.sh
# フォントはどれも SIL Open Font License 1.1。ライセンスの文は web/tools/third-party-licenses/fonts/ に置いてある。
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

OUT_DIR=cli/fonts
NOTO_CJK=https://raw.githubusercontent.com/notofonts/noto-cjk/165c01b46ea533872e002e0785ff17e44f6d97d8/Sans/SubsetOTF/JP
GOOGLE_FONTS=https://raw.githubusercontent.com/google/fonts/633f3200539c52ee0aba2dfd7f46921417a81877/ofl/ibmplexmono

# ファイルの SHA-256 を出す（Linux は sha256sum、macOS は shasum）。
sha256_of() {
  if command -v sha256sum >/dev/null; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

# フォントを 1 つ取る。引数：ファイル名・取る先の URL・SHA-256。
fetch() {
  local name=$1 url=$2 sha=$3 file=$OUT_DIR/$1
  if [[ -f $file && $(sha256_of "$file") == "$sha" ]]; then return; fi
  echo "フォント $name を取得します" >&2
  curl -sSfL --retry 3 -o "$file.part" "$url"
  if [[ $(sha256_of "$file.part") != "$sha" ]]; then
    rm -f "$file.part"
    echo "ERROR: $name のハッシュが、scripts/fetch-fonts.sh に書いたものと違います" >&2
    exit 1
  fi
  mv "$file.part" "$file"
}

mkdir -p "$OUT_DIR"
fetch NotoSansJP-Regular.otf "$NOTO_CJK/NotoSansJP-Regular.otf" dff723ba59d57d136764a04b9b2d03205544f7cd785a711442d6d2d085ac5073
fetch NotoSansJP-Bold.otf "$NOTO_CJK/NotoSansJP-Bold.otf" 1b0edfb500b73a4fa8a4fcaae1bbbd403994e08e73e3e0da37e70d3853f42c5f
fetch IBMPlexMono-Regular.ttf "$GOOGLE_FONTS/IBMPlexMono-Regular.ttf" 6a3412f058c7d8dfd9170c41e85ade48e5156ecb89356110ca57a0a27734af46
