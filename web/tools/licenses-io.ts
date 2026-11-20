// 配布物に添えるライセンス文のうち、ファイルと cargo を読む部分（判断は licenses.ts）。
// アプリのビルド（vite.config.ts）と、cli のパッケージ（licenses-cli.ts）が同じものを使う。
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chooseLicenses, LICENSE_FILES, licenseDirs, wasmRuntimeCrates, type BundledPart, type CargoMetadata } from "./licenses.ts";

/** 著作権表示。画面（index.html）と LICENSE.txt に出す。 */
export const COPYRIGHT = "Copyright (C) 2026 The Modelith Authors";

/**
 * Rust のコア（wasm）に組み込まれる第三者のクレートと、そのライセンス文を集める（ADR-0015）。
 *
 * @returns クレートごとの名前と版・ライセンス・使い道・ライセンス文。ライセンス文が見つからないクレートがあれば例外を投げる
 * @example
 * rustCrateParts()[0] // → { name: "rowan 0.16.1", license: "MIT", usage: "Rust のコア（wasm）の部品", text: "MIT License …" }
 */
export function rustCrateParts(): BundledPart[] {
  const json = execSync("cargo metadata --format-version 1 --filter-platform wasm32-unknown-unknown", {
    cwd: new URL("../..", import.meta.url),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return wasmRuntimeCrates(JSON.parse(json) as CargoMetadata, "modelith-wasm").map((p) => {
    const licenses = chooseLicenses(p.license ?? "");
    const texts = licenses.map((l) => {
      // 配布物にライセンス文の無いクレートは、そのリポジトリから写しておいたもの（tools/third-party-licenses/<名前>/）を使う。
      // 今は該当なし（写したら、どこから写したかをここに書く）
      const copied = fileURLToPath(new URL(`./third-party-licenses/${p.name}`, import.meta.url));
      const file = [...licenseDirs(p.manifest_path.replace(/\\/g, "/"), p.source), copied]
        .flatMap((dir) => (LICENSE_FILES[l] ?? []).map((f) => join(dir, f)))
        .find((f) => existsSync(f));
      if (!file) throw new Error(`${p.name} ${p.version} の ${l} のライセンス文が見つかりません`);
      return readFileSync(file, "utf8");
    });
    return { name: `${p.name} ${p.version}`, license: licenses.join(" AND "), usage: "Rust のコア（wasm）の部品", text: texts.join("\n\n") };
  });
}
