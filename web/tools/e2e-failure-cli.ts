// 失敗した e2e のテストの要約を、標準出力に出す（scripts/e2e.sh が、e2e が失敗して終わったときに呼ぶ）。判断は e2e-failure.ts。
//   node web/tools/e2e-failure-cli.ts <test-results のディレクトリ> [--since <秒（UNIX 時刻）>]
// 失敗したテストの結果のフォルダ（error-context.md か trace*.zip があるもの）ごとに、操作の一覧・ブラウザのエラー・失敗時の画面を出す。
// --since を渡すと、それより前に書かれたフォルダ（前の実行の残り）は出さない。
// 要約は調べるための助けなので、読めないものがあっても、終了コードはいつも 0（e2e の成否を変えない）。
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DEFAULT_LIMITS, summarizeFailure, type Failure, type TraceTexts } from "./e2e-failure.ts";

/** 要約を詳しく出すテストの数の上限（ほとんどのテストが落ちたときに、ログを埋めないため）。 */
const MAX_FAILURES = 10;
/** trace.zip の中の 1 つのファイルを読むときの上限（バイト）。 */
const MAX_ENTRY_BYTES = 256 * 1024 * 1024;

/**
 * zip の中のファイルの名前を並べる（`unzip` コマンドを使う）。
 *
 * @param zip zip のパス
 * @returns 中のファイルの名前。`unzip` が無い・zip が壊れているときは例外
 * @example
 * zipEntries("test-results/a-chromium/trace.zip") // → ["0-trace.trace", "1-trace.network", "test.trace", "resources/…", …]
 */
function zipEntries(zip: string): string[] {
  return execFileSync("unzip", ["-Z1", zip], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).split("\n").filter(Boolean);
}

/**
 * zip の中の 1 つのファイルを、テキストとして読む（`unzip` コマンドを使う）。
 *
 * @param zip zip のパス
 * @param entry 中のファイルの名前（`unzip` がワイルドカードとして読む文字を含まないもの）
 * @returns ファイルの中身（UTF-8）。読めなければ例外
 * @example
 * zipText("test-results/a-chromium/trace.zip", "test.trace") // → '{"version":10,"type":"context-options",…}\n…'
 */
function zipText(zip: string, entry: string): string {
  return execFileSync("unzip", ["-p", zip, entry], { encoding: "utf8", maxBuffer: MAX_ENTRY_BYTES, stdio: ["ignore", "pipe", "pipe"] });
}

/**
 * trace.zip から、要約に使う記録（test.trace・*-trace.trace・*-trace.network）を取り出す。
 *
 * @param zip trace.zip のパス
 * @returns 記録の中身。読めなければ例外
 * @example
 * readTrace("test-results/a-chromium/trace.zip") // → { test: "…", library: ["…", "…"], network: ["", "…"] }
 */
function readTrace(zip: string): TraceTexts {
  const entries = zipEntries(zip).sort();
  const texts = (pattern: RegExp): string[] => entries.filter((entry) => pattern.test(entry)).map((entry) => zipText(zip, entry));
  return { test: texts(/^test\.trace$/).join("\n"), library: texts(/^\d+-trace\.trace$/), network: texts(/^\d+-trace\.network$/) };
}

/**
 * 1 つのテストの結果のフォルダから、要約の材料を集める。読めないものは、説明（notes）に書いて先へ進む。
 *
 * @param resultsDir test-results のディレクトリ
 * @param directory その下の、テストの結果のフォルダの名前
 * @returns 集めたもの
 * @example
 * collectFailure("web/test-results", "a-chromium") // → { directory: "a-chromium", trace: { … }, errorContext: "# Instructions…", notes: [] }
 */
function collectFailure(resultsDir: string, directory: string): Failure {
  const folder = join(resultsDir, directory);
  const notes: string[] = [];
  const contextPath = join(folder, "error-context.md");
  const zips = readdirSync(folder).filter((name) => /^trace.*\.zip$/.test(name)).sort();
  let trace: TraceTexts | null = null;
  const zip = zips[0];
  if (zip !== undefined) {
    if (zips.length > 1) notes.push(`trace が ${zips.length} 個ある。${zip} だけを読む`);
    try {
      trace = readTrace(join(folder, zip));
    } catch (error) {
      notes.push(`${zip} を読めない（unzip コマンドが要る）: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    }
  }
  return { directory, trace, errorContext: existsSync(contextPath) ? readFileSync(contextPath, "utf8") : null, notes };
}

/**
 * 失敗したテストの結果のフォルダを探す（error-context.md か trace*.zip があり、`since` 以降に書かれたもの）。
 *
 * @param resultsDir test-results のディレクトリ
 * @param since これより前（UNIX 時刻の秒）に書かれたものは除く
 * @returns フォルダの名前（名前の順）。ディレクトリが無ければ空
 * @example
 * failedDirectories("web/test-results", 0) // → ["export-images-…-chromium", "shell-…-chromium"]
 * failedDirectories("無いディレクトリ", 0)   // → []
 */
function failedDirectories(resultsDir: string, since: number): string[] {
  if (!existsSync(resultsDir)) return [];
  return readdirSync(resultsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) =>
      readdirSync(join(resultsDir, name)).some(
        (file) => (file === "error-context.md" || /^trace.*\.zip$/.test(file)) && statSync(join(resultsDir, name, file)).mtimeMs / 1000 >= since,
      ),
    )
    .sort();
}

/**
 * 失敗したテストの要約を標準出力に出す。
 *
 * @param argv コマンドの引数（`<test-results のディレクトリ> [--since <秒>]`）
 * @returns なし
 */
function main(argv: string[]): void {
  const resultsDir = argv[0];
  if (resultsDir === undefined) {
    process.stdout.write("使い方: node web/tools/e2e-failure-cli.ts <test-results のディレクトリ> [--since <秒>]\n");
    return;
  }
  const sinceIndex = argv.indexOf("--since");
  const since = sinceIndex < 0 ? 0 : Number(argv[sinceIndex + 1]) || 0;
  // trace の中のパスは、Playwright を動かしたディレクトリ（test-results の親）からの絶対パス
  const root = dirname(resolve(resultsDir));
  const directories = failedDirectories(resultsDir, since);
  for (const directory of directories.slice(0, MAX_FAILURES)) {
    process.stdout.write(`\n${summarizeFailure(collectFailure(resultsDir, directory), root, DEFAULT_LIMITS)}\n`);
  }
  if (directories.length > MAX_FAILURES) {
    const rest = directories.slice(MAX_FAILURES);
    process.stdout.write(`\n失敗したテストが多いので、残りの ${rest.length} 件は要約を省く:\n${rest.map((name) => `  test-results/${name}`).join("\n")}\n`);
  }
}

try {
  main(process.argv.slice(2));
} catch (error) {
  // 要約を作れなくても、e2e の結果（終了コード）は変えない
  process.stdout.write(`e2e の失敗の要約を作れませんでした: ${error instanceof Error ? error.message : String(error)}\n`);
}
