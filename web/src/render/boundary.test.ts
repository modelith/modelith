// @vitest-environment node
// 図の書き出し（src/render）の境目を守る（ADR-0024 の 3）。入口（index.ts）からたどれるモジュールが、画面（src/app）・DOM・
// ブラウザの保存領域に触れていないことを、import をたどって確かめる。import の向きは「画面 → 描画」だけにする。
/// <reference types="node" />
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENTRY = resolve(SRC, "render/index.ts");

/** 描画のモジュールが使ってはいけないブラウザの API の名前（DOM・画面・保存領域）。 */
const BROWSER_API = /\b(?:document|window|localStorage|sessionStorage|indexedDB|navigator|HTMLElement|requestAnimationFrame)\b/;

/**
 * ソースの、型だけでない import・export … from の行き先を集める。`import type`・`export type`・すべてが `type` の指定は、
 * 実行時には消えるので含めない。
 *
 * @param source TypeScript のソース
 * @returns 行き先の文字列（"./geometry" など）
 */
function valueImports(source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(/^(import|export)\s+(type\s+)?([^;]*?)\s+from\s+"([^"]+)";/gms)) {
    const [, , typeOnly, clause = "", spec = ""] = m;
    if (typeOnly) continue;
    const names = clause.match(/\{([^}]*)\}/)?.[1];
    if (names !== undefined && !clause.replace(/\{[^}]*\}/, "").trim().replace(/,$/, "") && names.split(",").map((s) => s.trim()).filter(Boolean).every((s) => s.startsWith("type "))) continue;
    out.push(spec);
  }
  for (const m of source.matchAll(/^import\s+"([^"]+)";/gm)) out.push(m[1] ?? "");
  return out;
}

/**
 * 相対の行き先を、ファイルのパスにする（拡張子 .ts・.js、またはフォルダの index.ts）。
 *
 * @param from import を書いたファイル
 * @param spec 行き先
 * @returns ファイルのパス。相対でない（パッケージの）行き先は null
 */
function resolveImport(from: string, spec: string): string | null {
  if (!spec.startsWith(".")) return null;
  const base = resolve(dirname(from), spec);
  for (const p of [`${base}.ts`, `${base}/index.ts`, base]) if (/\.[jt]s$/.test(p) && existsSync(p)) return p;
  throw new Error(`${relative(SRC, from)} の import "${spec}" のファイルが見つかりません`);
}

/**
 * 入口から、型だけでない import をたどって、実行時に読み込むファイルとパッケージを集める。
 *
 * @param entry 入口のファイル
 * @returns 読み込むファイル（src からの相対パス）と、パッケージの名前
 */
function reachable(entry: string): { files: string[]; packages: string[] } {
  const files = new Set<string>(), packages = new Set<string>();
  const todo = [entry];
  for (let f = todo.pop(); f; f = todo.pop()) {
    if (files.has(f)) continue;
    files.add(f);
    for (const spec of valueImports(readFileSync(f, "utf8"))) {
      const p = resolveImport(f, spec);
      if (p) todo.push(p);
      else packages.add(spec);
    }
  }
  return { files: [...files].map((f) => relative(SRC, f)).sort(), packages: [...packages].sort() };
}

/**
 * コメントを除いたソース（コメントの中の「window」などの言葉で誤って止めないため）。
 *
 * @param source TypeScript のソース
 * @returns ブロックのコメントと、行の頭からのコメントを除いたソース
 */
const codeOnly = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");

describe("valueImports（型だけでない import を集める）", () => {
  it("値の import と再エクスポートを集め、型だけのものは除く", () => {
    // Arrange
    const src = [
      'import { a } from "./a";',
      'import type { B } from "./b";',
      'import { type C, type D } from "./c";',
      'import { type E, f } from "./e";',
      'export { g } from "./g";',
      'export type { H } from "./h";',
      'import {\n  i,\n  j,\n} from "./i";',
    ].join("\n");
    // Act
    const specs = valueImports(src);
    // Assert
    expect(specs).toEqual(["./a", "./e", "./g", "./i"]);
  });
});

describe("描画（src/render）の境目（ADR-0024 の 3）", () => {
  const { files, packages } = reachable(ENTRY);

  it("入口から読み込むのは src/render と、コアの DOM に触れない部分だけ", () => {
    // Act
    const outside = files.filter((f) => !f.startsWith("render/") && !["core/views.ts", "core/rust.ts", "core/text.ts"].includes(f) && !f.startsWith("core/wasm/"));
    // Assert
    expect(outside).toEqual([]);
  });

  it("画面（src/app）のモジュールを読み込まない（import は画面 → 描画の一方向）", () => {
    // Act
    const app = files.filter((f) => f.startsWith("app/") || f === "main.ts");
    // Assert
    expect(app).toEqual([]);
  });

  it("どのモジュールも DOM・画面・ブラウザの保存領域に触れない", () => {
    // Act
    const touching = files.filter((f) => !f.startsWith("core/wasm/") && BROWSER_API.test(codeOnly(readFileSync(resolve(SRC, f), "utf8"))));
    // Assert
    expect(touching).toEqual([]);
  });

  it("npm のパッケージに依存しない", () => {
    // Assert
    expect(packages).toEqual([]);
  });

  it("src/render のどのモジュールも、src/app を読み込まない（型だけの import と、入口から読まないモジュールも含む）", () => {
    // Arrange
    const sources = readdirSync(resolve(SRC, "render"), { recursive: true, encoding: "utf8" })
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
      .map((f) => resolve(SRC, "render", f));
    // Act
    const toApp = sources.flatMap((f) => [...readFileSync(f, "utf8").matchAll(/\sfrom\s+"([^"]+)"/g)].map((m) => m[1] ?? "").filter((s) => /(^|\/)app\//.test(resolve(dirname(f), s).slice(SRC.length))).map((s) => `${relative(SRC, f)} → ${s}`));
    // Assert
    expect(toApp).toEqual([]);
  });
});
