// コア側（Rust）の文言の辞書を検査する（ADR-0027 の 3・6）。判断は l10n.ts。
//   node web/tools/l10n-rust-cli.ts <辞書のフォルダ> <Rust のコードのフォルダ>…
// 辞書のフォルダは、1 つの言語の .ftl（場所ごとのファイル）を置いたフォルダ（crates/modelith-messages/locales/ja）。
// - 辞書のキーと値の名前が決まりどおりか。キーがファイルの名前で始まるか
// - 辞書のキーに当たるコード（`場所.中身`）が、どれもコードに書かれているか
// - Rust のコード（テストを除く）に、文が直接書かれていないか
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { checkDictionaries, hardcodedRustText, stripRustComments, withoutRustTests } from "./l10n.ts";

/**
 * 検査する Rust のファイルか（テストとビルドの出力を除く）。
 *
 * @param path ファイルのパス
 * @returns 検査するなら true
 * @example
 * isTarget("crates/modelith-core/src/model/mod.rs")   // → true
 * isTarget("crates/modelith-core/src/model/tests.rs") // → false
 * isTarget("crates/modelith-cli/tests/check.rs")      // → false
 */
function isTarget(path: string): boolean {
  if (/(^|\/)(target|tests)\//.test(path)) return false;
  if (/\/tests\.rs$/.test(path)) return false;
  return path.endsWith(".rs");
}

/**
 * パスの下にある、検査するファイルを集める。
 *
 * @param path ディレクトリかファイル
 * @returns 検査するファイルのパス（名前の順）
 * @example
 * collect("crates/modelith-cli/src") // → ["crates/modelith-cli/src/check.rs", "crates/modelith-cli/src/main.rs", …]
 */
function collect(path: string): string[] {
  if (!statSync(path).isDirectory()) return isTarget(path) ? [path] : [];
  return readdirSync(path)
    .sort()
    .flatMap((name) => collect(join(path, name)));
}

const [dictionary, ...roots] = process.argv.slice(2);
if (dictionary === undefined || !roots.length) {
  console.error("usage: node web/tools/l10n-rust-cli.ts <辞書のフォルダ> <Rust のコードのフォルダ>…");
  process.exit(2);
}
const errors: string[] = [];
const dictionaries = readdirSync(dictionary)
  .filter((name) => name.endsWith(".ftl"))
  .sort()
  .map((name) => ({ name: basename(name, ".ftl"), source: readFileSync(join(dictionary, name), "utf8") }));
const { problems } = checkDictionaries(dictionaries);
for (const p of problems) errors.push(`${join(dictionary, `${p.file}.ftl`)}:${p.line}: ${p.message}`);
const files = roots.flatMap(collect).map((file) => ({ file, source: readFileSync(file, "utf8") }));
// コードに書かれた文字列（コメントを除く。テストに書いたコードは数えない）
const code = files.map(({ source }) => stripRustComments(withoutRustTests(source))).join("\n");
let keys = 0;
for (const { name, source } of dictionaries) {
  for (const line of source.split("\n")) {
    const key = /^([a-z][a-z0-9-]*)\s*=/.exec(line)?.[1];
    if (key === undefined || !key.startsWith(`${name}-`)) continue;
    keys++;
    // キーは、コードの「.」を「-」に替えたもの（場所の名前の後ろの 1 つだけ）
    const messageCode = `${name}.${key.slice(name.length + 1)}`;
    if (!code.includes(`"${messageCode}"`)) errors.push(`${join(dictionary, `${name}.ftl`)}: キー「${key}」に当たるコード「${messageCode}」を、どのコードも使っていません（消すか、使ってください）`);
  }
}
for (const { file, source } of files) {
  for (const f of hardcodedRustText(source)) errors.push(`${file}:${f.line}: 文が直接書かれています（辞書に移し、Message::new("コード") で返してください）：${f.message}`);
}
for (const e of errors) console.error(e);
if (errors.length) {
  console.error(`ERROR: コア側の文言の辞書の誤りが ${errors.length} 件あります（docs/development/l10n.md）`);
  process.exit(1);
}
console.log(`l10n (rust): ok（${keys} キー）`);
