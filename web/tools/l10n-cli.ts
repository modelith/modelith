// 文言の辞書を検査する（ADR-0027 の 6）。判断は l10n.ts。
//   node web/tools/l10n-cli.ts <辞書のフォルダ> <コードのフォルダ> [<移し終えたフォルダ>…]
// 辞書のフォルダは、1 つの言語の .ftl（場所ごとのファイル）を置いたフォルダ（web/src/locales/ja）。
// - 辞書のキーと値の名前が決まりどおりか。キーがファイルの名前で始まるか
// - コードのフォルダ（テストと生成物を除く .ts）が使うキーが辞書にあり、辞書のキーがどれも使われているか
// - 移し終えたフォルダのコードに、文が直接書かれていないか（移し終えたフォルダから順に足す）。.html のファイルも渡せる（キーは data-l10n… に書く）
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { checkDictionaries, hardcodedText, keyUsage } from "./l10n.ts";
import { hardcodedHtmlText } from "./l10n-html.ts";

/**
 * 検査するファイルか（テスト・生成物・型定義・辞書を入れる層そのものを除く）。
 *
 * @param path ファイルのパス
 * @returns 検査するなら true
 * @example
 * isTarget("web/src/files/types.ts")       // → true
 * isTarget("web/src/files/types.test.ts")  // → false
 * isTarget("web/src/core/wasm/x.d.ts")     // → false
 */
function isTarget(path: string): boolean {
  if (/(^|\/)(node_modules|wasm|generated|testing|samples|locales)\//.test(path)) return false;
  if (/\.test\.ts$|\.d\.ts$/.test(path)) return false;
  return path.endsWith(".ts");
}

/**
 * パスの下にある、検査するファイルを集める。
 *
 * @param path ディレクトリかファイル
 * @returns 検査するファイルのパス（名前の順）
 * @example
 * collect("web/src/files") // → ["web/src/files/browser-file.ts", "web/src/files/entry-names.ts", …]
 */
function collect(path: string): string[] {
  if (!statSync(path).isDirectory()) return isTarget(path) ? [path] : [];
  return readdirSync(path)
    .sort()
    .flatMap((name) => collect(join(path, name)));
}

const [dictionary, codeRoot, ...migrated] = process.argv.slice(2);
if (dictionary === undefined || codeRoot === undefined) {
  console.error("usage: node web/tools/l10n-cli.ts <辞書のフォルダ> <コードのフォルダ> [<移し終えたフォルダ>…]");
  process.exit(2);
}
const errors: string[] = [];
const { keys, problems } = checkDictionaries(
  readdirSync(dictionary)
    .filter((name) => name.endsWith(".ftl"))
    .sort()
    .map((name) => ({ name: basename(name, ".ftl"), source: readFileSync(join(dictionary, name), "utf8") })),
);
for (const p of problems) errors.push(`${join(dictionary, `${p.file}.ftl`)}:${p.line}: ${p.message}`);
const usage = keyUsage(
  keys,
  // .html のキーは data-l10n…="キー" と書くので、コードと同じく文字列として拾える
  [...collect(codeRoot), ...migrated.filter((path) => path.endsWith(".html"))].map((file) => ({ file, source: readFileSync(file, "utf8") })),
);
for (const u of usage.unknown) errors.push(`${u.file}:${u.line}: キー「${u.key}」が辞書（${dictionary}）にありません`);
for (const key of usage.unused) errors.push(`${dictionary}: キー「${key}」は、どのコードも使っていません（消すか、使ってください）`);
for (const file of migrated.filter((path) => path.endsWith(".html"))) {
  for (const f of hardcodedHtmlText(readFileSync(file, "utf8"))) errors.push(`${file}:${f.line}: 文が直接書かれています（辞書に移し、data-l10n="キー" で使ってください）：${f.message}`);
}
for (const file of migrated.filter((path) => !path.endsWith(".html")).flatMap(collect)) {
  for (const f of hardcodedText(readFileSync(file, "utf8"))) errors.push(`${file}:${f.line}: 文が直接書かれています（辞書に移し、t("キー") で使ってください）：${f.message}`);
}
for (const e of errors) console.error(e);
if (errors.length) {
  console.error(`ERROR: 文言の辞書の誤りが ${errors.length} 件あります（docs/development/l10n.md）`);
  process.exit(1);
}
console.log(`l10n: ok（${keys.length} キー）`);
