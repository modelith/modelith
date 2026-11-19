// 失敗した CI のテスト結果のページを置き場所に並べるための入出力（scripts/ci-reports.sh が呼ぶ）。判断は ci-reports.ts。
//   node web/tools/ci-reports-cli.ts artifact <artifacts.json> <jobs.json>      置く成果物の ID を出す（置かないときは何も出さず、理由を標準エラーに）
//   node web/tools/ci-reports-cli.ts prepare <取り出した成果物のディレクトリ>     リンクなどを消し、置いてよいかを確かめる（置かないときは終了コード 3）
//   node web/tools/ci-reports-cli.ts key <run.json>                              フォルダの名前（<実行の ID>-<やり直しの回数>）を出す
//   node web/tools/ci-reports-cli.ts meta <run.json> <pulls.json> <置いた成果物のディレクトリ> <置く時刻>   meta.json の中身を出す
//   node web/tools/ci-reports-cli.ts prune <置き場所のディレクトリ>              古い実行のフォルダを消し、消したものを出す
//   node web/tools/ci-reports-cli.ts index <置き場所のディレクトリ>              index.html と .nojekyll を作り直す
//   node web/tools/ci-reports-cli.ts comment <meta.json> <サイトの URL>          PR へのコメントの本文を出す
//   node web/tools/ci-reports-cli.ts comment-id                                  標準入力のコメント（1 行に 1 つの JSON）から、書き換えるコメントの ID を出す
// 成果物の中のものは読まない・実行しない（名前と大きさだけを見る）。使い方の誤り・読めない入力は終了コード 1。
import { existsSync, lstatSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildMeta,
  checkReport,
  DEFAULT_LIMITS,
  findComment,
  parseMeta,
  pickArtifact,
  pickPullRequest,
  readRun,
  renderComment,
  renderIndex,
  REPORT_PAGES,
  runKey,
  selectRunsToRemove,
  type ReportStats,
  type RunEntry,
  type RunMeta,
  type WorkflowRun,
} from "./ci-reports.ts";

/** 置かないと決めたときの終了コード（失敗ではない。呼ぶ側が見分ける）。 */
const EXIT_SKIP = 3;

/**
 * JSON のファイルを読む。
 *
 * @param path ファイルのパス
 * @returns 読んだ値。ファイルが無い・JSON でないときは例外
 * @example
 * readJson("work/run.json") // → { id: 5, run_attempt: 1, … }
 */
function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * 実行の JSON（GitHub の API の答え）を読み、使う項目を取り出す。
 *
 * @param path `run.json` のパス
 * @returns 実行。形が違うときは例外
 * @example
 * loadRun("work/run.json") // → { runId: 5, attempt: 1, repository: "modelith/modelith", … }
 */
function loadRun(path: string): WorkflowRun {
  const run = readRun(readJson(path));
  if (run === null) throw new Error(`${path} は、ワークフローの実行の形ではありません`);
  return run;
}

/**
 * 取り出した成果物から、置かないものを消す：シンボリックリンク、ファイルでもフォルダでもないもの、名前が `.git` で始まるもの
 * （置き場所のリポジトリの動きを変えうる `.gitattributes`・`.gitignore`・`.gitmodules`・入れ子の `.git`）。
 *
 * @param directory 調べるディレクトリ（中をたどる。リンクの先はたどらない）
 * @returns 消したもの（`directory` からのパス）
 * @example
 * sanitize("work/artifact") // → ["e2e/link-to-etc", "e2e/.gitattributes"]
 * sanitize("空のディレクトリ") // → []
 */
function sanitize(directory: string): string[] {
  const removed: string[] = [];
  /**
   * 1 つのディレクトリを調べる。
   *
   * @param relative `directory` からのパス（最初は空文字）
   * @returns なし
   */
  const visit = (relative: string): void => {
    for (const name of readdirSync(join(directory, relative))) {
      const path = join(relative, name);
      const stat = lstatSync(join(directory, path));
      if (name.startsWith(".git") || !(stat.isFile() || stat.isDirectory())) {
        rmSync(join(directory, path), { recursive: true, force: true });
        removed.push(path);
      } else if (stat.isDirectory()) {
        visit(path);
      }
    }
  };
  visit("");
  return removed;
}

/**
 * ディレクトリの中のファイルの大きさと、入口のページがあるかを調べる（中身は読まない）。
 *
 * @param directory 調べるディレクトリ（`sanitize` を通したもの）
 * @returns 大きさの合計・最も大きいファイル・あった入口のページ
 * @example
 * measure("work/artifact") // → { bytes: 61234567, largestFileBytes: 4000000, pages: ["e2e/index.html", "requirements.html"] }
 */
function measure(directory: string): ReportStats {
  let bytes = 0;
  let largestFileBytes = 0;
  /**
   * 1 つのディレクトリを調べる。
   *
   * @param current 調べるディレクトリのパス
   * @returns なし
   */
  const visit = (current: string): void => {
    for (const name of readdirSync(current)) {
      const stat = lstatSync(join(current, name));
      if (stat.isDirectory()) visit(join(current, name));
      else if (stat.isFile()) {
        bytes += stat.size;
        largestFileBytes = Math.max(largestFileBytes, stat.size);
      }
    }
  };
  visit(directory);
  const pages = REPORT_PAGES.map((page) => page.path as string).filter((path) => {
    const stat = lstatSync(join(directory, path), { throwIfNoEntry: false });
    return stat !== undefined && stat.isFile();
  });
  return { bytes, largestFileBytes, pages };
}

/**
 * 置き場所の `runs/` の下のフォルダと、その `meta.json` を読む。
 *
 * @param siteDir 置き場所のディレクトリ
 * @returns フォルダの一覧（名前の順）。`runs/` が無ければ空
 * @example
 * readEntries("site") // → [{ directory: "5-1", meta: { key: "5-1", … } }, { directory: "tmp", meta: null }]
 */
function readEntries(siteDir: string): RunEntry[] {
  const runsDir = join(siteDir, "runs");
  if (!existsSync(runsDir)) return [];
  return readdirSync(runsDir)
    .sort()
    .map((directory) => {
      const metaPath = join(runsDir, directory, "meta.json");
      const stat = lstatSync(metaPath, { throwIfNoEntry: false });
      return { directory, meta: stat !== undefined && stat.isFile() ? parseMeta(readFileSync(metaPath, "utf8")) : null };
    });
}

/**
 * 引数を取り出す。無ければ、使い方の誤りとして例外にする。
 *
 * @param argv コマンドの引数
 * @param index 位置（0 始まり）
 * @param name 引数の呼び名（エラーの文に使う）
 * @returns 引数
 * @example
 * argument(["site"], 0, "置き場所のディレクトリ") // → "site"
 * argument([], 0, "置き場所のディレクトリ")       // → 例外
 */
function argument(argv: string[], index: number, name: string): string {
  const value = argv[index];
  if (value === undefined || value === "") throw new Error(`引数が足りません: ${name}`);
  return value;
}

/**
 * コマンドを実行する。
 *
 * @param command コマンドの名前（このファイルの先頭の一覧）
 * @param argv コマンドの引数
 * @returns 終了コード（0：成功、3：置かないと決めた）。使い方の誤り・読めない入力は例外
 * @example
 * run("key", ["work/run.json"]) // → 0（標準出力に "5-1"）
 * run("prepare", ["大きすぎる成果物"]) // → 3（標準エラーに理由）
 */
function run(command: string, argv: string[]): number {
  switch (command) {
    case "artifact": {
      const picked = pickArtifact(readJson(argument(argv, 0, "artifacts.json")), readJson(argument(argv, 1, "jobs.json")), DEFAULT_LIMITS);
      if ("skip" in picked) process.stderr.write(`置きません: ${picked.skip}\n`);
      else process.stdout.write(`${picked.id}\n`);
      return 0;
    }
    case "prepare": {
      const directory = argument(argv, 0, "取り出した成果物のディレクトリ");
      const removed = sanitize(directory);
      if (removed.length > 0) process.stderr.write(`リンクなど ${removed.length} 個を消しました（置かないもの）\n`);
      const reason = checkReport(measure(directory), DEFAULT_LIMITS);
      if (reason === null) return 0;
      process.stderr.write(`置きません: ${reason}\n`);
      return EXIT_SKIP;
    }
    case "key": {
      const workflowRun = loadRun(argument(argv, 0, "run.json"));
      process.stdout.write(`${runKey(workflowRun.runId, workflowRun.attempt)}\n`);
      return 0;
    }
    case "meta": {
      const workflowRun = loadRun(argument(argv, 0, "run.json"));
      const pr = pickPullRequest(workflowRun, readJson(argument(argv, 1, "pulls.json")));
      const meta = buildMeta(workflowRun, pr, measure(argument(argv, 2, "置いた成果物のディレクトリ")), argument(argv, 3, "置く時刻"));
      // 書いたものを読み戻せることを確かめる（時刻の形の誤りなどを、置く前に見つける）
      const text = `${JSON.stringify(meta, null, 2)}\n`;
      if (parseMeta(text) === null) throw new Error("メタデータの形が正しくありません（置く時刻は 2026-11-19T01:02:03Z の形）");
      process.stdout.write(text);
      return 0;
    }
    case "prune": {
      const siteDir = argument(argv, 0, "置き場所のディレクトリ");
      for (const directory of selectRunsToRemove(readEntries(siteDir), DEFAULT_LIMITS)) {
        rmSync(join(siteDir, "runs", directory), { recursive: true, force: true });
        process.stdout.write(`${directory}\n`);
      }
      return 0;
    }
    case "index": {
      const siteDir = argument(argv, 0, "置き場所のディレクトリ");
      const runs = readEntries(siteDir)
        .filter((entry) => entry.meta !== null && entry.meta.key === entry.directory)
        .map((entry) => entry.meta as RunMeta);
      writeFileSync(join(siteDir, "index.html"), renderIndex(runs, DEFAULT_LIMITS));
      // GitHub Pages の Jekyll を通さない（`_` で始まるファイルを落とさず、成果物の中のものを処理させない）
      writeFileSync(join(siteDir, ".nojekyll"), "");
      return 0;
    }
    case "comment": {
      const meta = parseMeta(readFileSync(argument(argv, 0, "meta.json"), "utf8"));
      if (meta === null) throw new Error("meta.json の形が正しくありません");
      process.stdout.write(renderComment(meta, argument(argv, 1, "サイトの URL"), DEFAULT_LIMITS));
      return 0;
    }
    case "comment-id": {
      const comments = readFileSync(0, "utf8")
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => JSON.parse(line) as unknown);
      const id = findComment(comments);
      if (id !== null) process.stdout.write(`${id}\n`);
      return 0;
    }
    default:
      throw new Error(`知らないコマンドです: ${command}（使い方は web/tools/ci-reports-cli.ts の先頭）`);
  }
}

try {
  process.exitCode = run(process.argv[2] ?? "", process.argv.slice(3));
} catch (error) {
  process.stderr.write(`ci-reports: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
