// プロジェクトを読む口（core.ts の ProjectReader）を、手元のフォルダで満たす。ファイルに触れるのはこのファイルだけ。
// 読むのは、渡したフォルダの中だけ（ADR-0024 の 5）。シンボリックリンクはたどらない（フォルダの外を読まないため）。
// どのファイルをモデルとして読むかは、`modelith check`（crates/modelith-cli/src/check.rs）と同じ：
// .sysml・.kerml を、隠しフォルダ（. で始まる）・target・node_modules を除いて、名前の順にたどる。

import { lstat, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProjectInput, ProjectReader, SourceFile, UnreadableFile } from "./core.ts";

/** プロジェクトの設定ファイル。 */
const PROJECT_FILE = "modelith.json";
/** プラグインを置くフォルダ（プロジェクトのフォルダから）。 */
const PLUGINS_DIR = ".modelith/plugins";
/** プラグインのファイルとして読む拡張子（マニフェストとルール）。 */
const PLUGIN_FILE = /\.(json|ya?ml)$/;

/**
 * モデルのファイルの名前か（.sysml・.kerml。拡張子だけの名前は除く）。
 *
 * @param name ファイルの名前
 * @returns モデルのファイルなら true
 * @example
 * isModelFile("a.sysml")  // → true
 * isModelFile("a.kerml")  // → true
 * isModelFile(".sysml")   // → false
 * isModelFile("a.txt")    // → false
 */
export function isModelFile(name: string): boolean {
  return [".sysml", ".kerml"].some((ext) => name.length > ext.length && name.endsWith(ext));
}

/**
 * たどらないフォルダか（隠しフォルダ・ビルドの成果物・依存物）。
 *
 * @param name フォルダの名前
 * @returns たどらないなら true
 * @example
 * isSkippedDir(".modelith")     // → true
 * isSkippedDir("node_modules")  // → true
 * isSkippedDir("parts")         // → false
 */
export function isSkippedDir(name: string): boolean {
  return name.startsWith(".") || name === "target" || name === "node_modules";
}

/**
 * フォルダの下の、条件に合うファイルを名前の順に集める（シンボリックリンクはたどらず、ファイルとしても数えない）。
 *
 * @param root 始まりのフォルダ
 * @param rel 始まりのフォルダからのパス（`/` 区切り。始まりなら空文字）
 * @param wantFile 集めるファイルの名前か
 * @param skipDir たどらないフォルダの名前か
 * @returns 始まりのフォルダからのパス（`/` 区切り）
 * @example
 * await walk("/p", "", isModelFile, isSkippedDir) // → ["a.sysml", "parts/b.sysml"]
 */
async function walk(
  root: string, rel: string, wantFile: (name: string) => boolean, skipDir: (name: string) => boolean,
): Promise<string[]> {
  const entries = await readdir(join(root, rel), { withFileTypes: true });
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const found: string[] = [];
  for (const entry of entries) {
    const path = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory() && !skipDir(entry.name)) found.push(...(await walk(root, path, wantFile, skipDir)));
    else if (entry.isFile() && wantFile(entry.name)) found.push(path);
  }
  return found;
}

/**
 * テキストのファイルを読む。シンボリックリンクと、UTF-8 でないファイルは読まない。
 *
 * @param path ファイルのパス
 * @returns テキスト。読まない・読めないときは、理由を書いた Error を投げる
 * @example
 * await readText("/p/a.sysml")   // → "package P;"
 * await readText("/p/link.sysml") // → Error("symbolic links are not read") を投げる
 */
async function readText(path: string): Promise<string> {
  if ((await lstat(path)).isSymbolicLink()) throw new Error("symbolic links are not read");
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(await readFile(path));
  } catch (e) {
    throw e instanceof TypeError ? new Error("not UTF-8 text") : e;
  }
}

/**
 * ファイルが無いことを表すエラーか。
 *
 * @param e 捕まえた値
 * @returns ファイルやフォルダが無い（ENOENT）なら true
 * @example
 * isNotFound(Object.assign(new Error("x"), { code: "ENOENT" })) // → true
 * isNotFound(new Error("x"))                                   // → false
 */
function isNotFound(e: unknown): boolean {
  return e instanceof Error && "code" in e && e.code === "ENOENT";
}

/**
 * エラーの理由を、短い文にする。
 *
 * @param e 捕まえた値
 * @returns 理由（Error ならその文、ほかは文字列にしたもの）
 * @example
 * reasonOf(new Error("not UTF-8 text")) // → "not UTF-8 text"
 */
function reasonOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * プラグインのファイル（マニフェストとルール）を読む。読めないファイルは入れない（コアが「見つからない」として問題にする）。
 *
 * @param folder プロジェクトのフォルダ
 * @returns プラグインの ID → プラグインのフォルダからの相対パス → テキスト。プラグインのフォルダが無ければ空
 * @example
 * await readPluginFiles("/p") // → { "jp.x": { "modelith-plugin.json": "{…}", "rules.yaml": "rules:…" } }
 */
async function readPluginFiles(folder: string): Promise<Record<string, Record<string, string>>> {
  const dir = join(folder, PLUGINS_DIR);
  let ids: string[];
  try {
    ids = (await readdir(dir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  } catch (e) {
    if (isNotFound(e)) return {};
    throw e;
  }
  const plugins: Record<string, Record<string, string>> = {};
  for (const id of ids) {
    const files: Record<string, string> = {};
    for (const rel of await walk(join(dir, id), "", (name) => PLUGIN_FILE.test(name), () => false)) {
      try {
        files[rel] = await readText(join(dir, id, rel));
      } catch {
        // 読めないファイルは渡さない。マニフェストに書かれていれば、コアが「見つからない」と知らせる
      }
    }
    plugins[id] = files;
  }
  return plugins;
}

/**
 * フォルダからプロジェクトを読む（モデルのファイル・設定ファイル・プラグインのファイル）。
 *
 * @param folder プロジェクトのフォルダ
 * @returns 読み込んだプロジェクト。読めなかったモデルのファイルと設定ファイルは unreadable に入れる。フォルダが無い・読めないときは例外で拒否する
 * @example
 * await readProject("/p")
 * // → { files: [{ path: "a.sysml", text: "…" }], unreadable: [], projectFile: "{…}", pluginFiles: {} }
 */
async function readProject(folder: string): Promise<ProjectInput> {
  const files: SourceFile[] = [];
  const unreadable: UnreadableFile[] = [];
  for (const path of await walk(folder, "", isModelFile, isSkippedDir)) {
    try {
      files.push({ path, text: await readText(join(folder, path)) });
    } catch (e) {
      unreadable.push({ path, reason: reasonOf(e) });
    }
  }
  let projectFile: string | undefined;
  try {
    projectFile = await readText(join(folder, PROJECT_FILE));
  } catch (e) {
    if (!isNotFound(e)) unreadable.push({ path: PROJECT_FILE, reason: reasonOf(e) });
  }
  return { files, unreadable, projectFile, pluginFiles: await readPluginFiles(folder) };
}

/**
 * 手元のフォルダを読む口を作る。
 *
 * @param folder プロジェクトのフォルダ
 * @returns プロジェクトを読む口（read のたびにフォルダを読み直す）
 * @example
 * await fsProjectReader("/p").read() // → readProject("/p") と同じ
 */
export function fsProjectReader(folder: string): ProjectReader {
  return { read: () => readProject(folder) };
}
