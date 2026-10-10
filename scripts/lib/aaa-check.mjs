// テストが AAA（Arrange / Act / Assert）パターンで書かれているかを検査する。
// 各テストの本体に「Arrange」「Act」「Assert」を含むコメントがあることを求める。
// 例外の送出を確かめるテストなど、実行と検証が分けられない場合は「Act & Assert」と書いてよい。
//
//   node scripts/lib/aaa-check.mjs <file>...   違反があれば一覧を出して終了コード 1
//
// 対応: bats（@test）、Rust（#[test] の fn）、TypeScript（it / test、it.each / test.each）

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const MARKERS = {
  arrange: /(\/\/|#).*\bArrange\b/,
  act: /(\/\/|#).*\bAct\b/,
  assert: /(\/\/|#).*\bAssert\b/,
};

/** 本体テキストに足りない AAA マーカーの名前を返す。 */
export function missingMarkers(body) {
  return Object.entries(MARKERS)
    .filter(([, re]) => !re.test(body))
    .map(([name]) => name);
}

/** open の位置にある `{` に対応する `}` の位置を返す。文字列リテラルとコメント内の括弧は数えない。 */
export function matchBrace(src, open, kind = "ts") {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "/") i = src.indexOf("\n", i) === -1 ? src.length : src.indexOf("\n", i);
    else if (c === '"' || c === "'" || c === "`") i = skipString(src, i, kind);
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return i;
  }
  return -1;
}

function skipString(src, start, kind) {
  const quote = src[start];
  // Rust の ' は char リテラル（'a' / '\n'）かライフタイム（'a）。char 以外は文字列として扱わない
  if (kind === "rust" && quote === "'" && src[start + 2] !== "'" && !(src[start + 1] === "\\" && src[start + 3] === "'")) return start;
  for (let i = start + 1; i < src.length; i++) {
    if (src[i] === "\\") i++;
    else if (src[i] === quote) return i;
  }
  return src.length;
}

const lineOf = (src, index) => src.slice(0, index).split("\n").length;

/** ソースからテスト（名前・開始行・本体）を取り出す。 */
export function extractTests(src, kind) {
  const patterns = {
    bats: /^@test\s+(["'])(.*?)\1\s*\{/gm,
    rust: /#\[test\]\s*(?:#\[[^\]]*\]\s*)*fn\s+(\w+)[^{]*\{/g,
    // 次のテスト定義をまたがないように探す。本体が { } でない（式だけの）テストは本体を空として扱う
    ts: /\b(?:it|test)(?:\.each\([\s\S]*?\))?\(\s*(["'`])(.*?)\1(?:(?!\b(?:it|test)(?:\.each)?\()[\s\S])*?=>\s*\{?/g,
  };
  const re = patterns[kind];
  const tests = [];
  for (let m; (m = re.exec(src)); ) {
    const open = m.index + m[0].length - 1;
    if (src[open] !== "{") {
      tests.push({ name: m[2], line: lineOf(src, m.index), body: "" });
      continue;
    }
    const close = kind === "bats" ? src.indexOf("\n}", open) + 1 : matchBrace(src, open, kind);
    tests.push({ name: kind === "rust" ? m[1] : m[2], line: lineOf(src, m.index), body: src.slice(open, close + 1) });
  }
  return tests;
}

/** 拡張子からテストの種類を決める。対象外なら null。 */
export function kindOf(file) {
  if (file.endsWith(".bats")) return "bats";
  if (file.endsWith(".rs")) return "rust";
  if (/\.test\.ts$/.test(file)) return "ts";
  return null;
}

/** ファイル群を検査し、違反メッセージの配列を返す。 */
export function checkFiles(files, read = (f) => readFileSync(f, "utf8")) {
  return files.flatMap((file) => {
    const kind = kindOf(file);
    if (!kind) return [];
    return extractTests(read(file), kind)
      .map((t) => ({ ...t, missing: missingMarkers(t.body) }))
      .filter((t) => t.missing.length > 0)
      .map((t) => `${file}:${t.line}: テスト '${t.name}' に AAA の区切りがありません（不足: ${t.missing.join(", ")}）`);
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const violations = checkFiles(process.argv.slice(2));
  violations.forEach((v) => console.log(v));
  process.exit(violations.length > 0 ? 1 : 0);
}
