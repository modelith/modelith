// @vitest-environment node
// 同じ辞書と値を、Rust（fluent-bundle。wasm の renderMessage）と TypeScript（@fluent/bundle）の実装に通し、同じ文になることを確かめる（ADR-0027 の 6）。
// コア側の辞書（crates/modelith-messages/locales/ja）のすべてのキーで比べる。
/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderMessage } from "../core/wasm/modelith_core.js";
import { createTranslator } from "./translator";

const DIR = new URL("../../../crates/modelith-messages/locales/ja/", import.meta.url);
const FILES = readdirSync(DIR)
  .filter((name) => name.endsWith(".ftl"))
  .sort()
  .map((name) => ({ area: name.replace(/\.ftl$/, ""), source: readFileSync(new URL(name, DIR), "utf8") }));

/** 辞書の 1 つの文。code はコアが返す種類のコード、names は差し込む値の名前。 */
interface Entry {
  key: string;
  code: string;
  names: string[];
}

/**
 * 辞書のテキストから、キーと、差し込む値の名前を取り出す。
 *
 * @param area 場所の名前（ファイルの名前）
 * @param source 辞書のテキスト
 * @returns 文の一覧
 */
function entries(area: string, source: string): Entry[] {
  return source.split("\n").flatMap((line) => {
    const key = /^([a-z][a-z0-9-]*)\s*=/.exec(line)?.[1];
    if (key === undefined) return [];
    const names = [...new Set([...line.matchAll(/\{\s*\$([A-Za-z0-9]+)/g)].map((m) => m[1] ?? ""))];
    return [{ key, code: `${area}.${key.slice(area.length + 1)}`, names }];
  });
}

const ALL = FILES.flatMap(({ area, source }) => entries(area, source));
const tsText = createTranslator(
  FILES.map(({ source }) => ({ locale: "ja", source })),
  (problem) => {
    throw new Error(problem);
  },
);

/** 文字化けや、実装の違いが出やすい値（タグ・波かっこ・引用符・絵文字・BMP の外の漢字・数字）。 */
const TRICKY = ["Engine", "部品 A", "<b>{ $x }</b>", "'a::b'", "\"q\"", "𠮷野家🍵", "1234567", ""];

describe("Rust と TypeScript の Fluent の実装", () => {
  it("コア側の辞書に、比べる文がある", () => {
    expect(ALL.length).toBeGreaterThan(200);
  });

  it.each(TRICKY)("どのキーも、値「%s」で同じ文になる", (value) => {
    // Arrange
    const differing: string[] = [];
    // Act
    for (const { key, code, names } of ALL) {
      const args = Object.fromEntries(names.map((name, i) => [name, `${value}${i}`]));
      const rust = renderMessage(code, JSON.stringify(args));
      const ts = tsText(key, args);
      if (rust !== ts) differing.push(`${key}: rust=${rust} ts=${ts}`);
    }
    // Assert
    expect(differing).toEqual([]);
  });

  it("値を差し込んだ文に、見えない記号（U+2068・U+2069）が入らない（どちらの実装でも）", () => {
    // Arrange
    const withValues = ALL.filter((e) => e.names.length > 0);
    // Act
    const marked = withValues.filter(({ key, code, names }) => {
      const args = Object.fromEntries(names.map((name) => [name, "x"]));
      return /[⁨⁩]/.test(renderMessage(code, JSON.stringify(args)) + tsText(key, args));
    });
    // Assert
    expect(marked.map((e) => e.key)).toEqual([]);
  });
});
