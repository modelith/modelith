// テキストの版と、編集の当て方（判断だけ。ファイルには触れない）。
// 版は、提案のあとにファイルが変わっていないかを確かめるためのもの（契約の FileChange.baseVersion。ADR-0024 の 4 の「元の版」）。

import { createHash } from "node:crypto";
import type { TextEdit } from "./core.ts";

/**
 * テキストの版を作る（中身が同じなら同じ版、違えば違う版）。
 *
 * @param text ファイルのテキスト全体
 * @returns テキストの SHA-256（16 進）
 * @example
 * versionOf("package P;") === versionOf("package P;")  // → true
 * versionOf("package P;") === versionOf("package Q;")  // → false
 */
export function versionOf(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * テキストの各行の始まりの位置を集める（行は \n で区切る。コアの数え方と同じ）。
 *
 * @param text テキスト全体
 * @returns 各行の始まりの位置（空のテキストも 1 行）
 * @example
 * lineStartsOf("a\nbc") // → [0, 2]
 * lineStartsOf("")      // → [0]
 */
function lineStartsOf(text: string): number[] {
  const starts = [0];
  for (let i = text.indexOf("\n"); i !== -1; i = text.indexOf("\n", i + 1)) starts.push(i + 1);
  return starts;
}

/**
 * 行・列の位置を、文字列の中の位置にする。
 *
 * @param text テキスト全体
 * @param at 0 始まりの行と列（列は UTF-16）
 * @returns 文字列の中の位置。テキストの外を指すときは Error を投げる
 * @example
 * offsetAt("a\nbc", { line: 1, character: 1 }) // → 3
 */
export function offsetAt(text: string, at: { line: number; character: number }): number {
  return offsetOf(lineStartsOf(text), text, at);
}

/**
 * 行・列の位置を、文字列の中の位置にする（行は \n で区切り、列は UTF-16。コアの数え方と同じ）。
 *
 * @param lineStarts 各行の始まりの位置
 * @param text テキスト全体
 * @param at 0 始まりの行と列
 * @returns 文字列の中の位置。行が無い・列が行の長さを超えるときは、範囲の外であることを伝える Error を投げる
 * @example
 * offsetOf([0, 2], "a\nbc", { line: 1, character: 1 }) // → 3
 * offsetOf([0, 2], "a\nbc", { line: 5, character: 0 }) // → Error を投げる
 */
function offsetOf(lineStarts: number[], text: string, at: { line: number; character: number }): number {
  const start = lineStarts[at.line];
  if (start === undefined) throw new Error(`line ${at.line} is outside the text`);
  // 行の終わり（改行の手前。最後の行はテキストの末尾）
  const next = lineStarts[at.line + 1];
  const lineEnd = next === undefined ? text.length : next - 1;
  const offset = start + at.character;
  if (offset > lineEnd) throw new Error(`column ${at.character} is outside line ${at.line}`);
  return offset;
}

/**
 * 編集をテキストに当てる。位置はどれも元のテキストのもので、編集どうしは重ならないこと。
 *
 * @param text 元のテキスト
 * @param edits 当てる編集（契約の TextEdit。順は問わない）
 * @returns 当てたあとのテキスト。範囲がテキストの外にあるときは Error を投げる
 * @example
 * applyEdits("part def A;", [{ range: { start: { line: 0, character: 9 }, end: { line: 0, character: 10 } }, newText: "B" }]) // → "part def B;"
 * applyEdits("abc", []) // → "abc"
 */
export function applyEdits(text: string, edits: TextEdit[]): string {
  const lineStarts = lineStartsOf(text);
  const spans = edits
    .map((e) => ({ start: offsetOf(lineStarts, text, e.range.start), end: offsetOf(lineStarts, text, e.range.end), newText: e.newText }))
    .sort((a, b) => b.start - a.start);
  let out = text;
  for (const s of spans) out = out.slice(0, s.start) + s.newText + out.slice(s.end);
  return out;
}
