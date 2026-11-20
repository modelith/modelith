// テキストの版と、編集の当て方の単体テスト。
import { describe, expect, it } from "vitest";
import type { TextEdit } from "./core.ts";
import { applyEdits, offsetAt, versionOf } from "./edits.ts";

/** 編集 1 つを作る。 */
function edit(startLine: number, startCol: number, endLine: number, endCol: number, newText: string): TextEdit {
  return { range: { start: { line: startLine, character: startCol }, end: { line: endLine, character: endCol } }, newText };
}

describe("versionOf", () => {
  it("同じ中身なら同じ版、1 文字でも違えば違う版にする（同値分割）", () => {
    // Act
    const [a, again, other, empty] = [versionOf("package P;"), versionOf("package P;"), versionOf("package Q;"), versionOf("")];
    // Assert
    expect(a).toBe(again);
    expect(a).not.toBe(other);
    expect(empty).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("offsetAt", () => {
  it("行と列を、文字列の中の位置にする（先頭・行の途中・最後の行の終わり。境界値）", () => {
    // Act
    const at = (line: number, character: number): number => offsetAt("a\nbc", { line, character });
    // Assert
    expect([at(0, 0), at(0, 1), at(1, 0), at(1, 2)]).toEqual([0, 1, 2, 4]);
  });

  it("テキストの外の行・列は、Error を投げる（異常系）", () => {
    // Act
    const beyondLine = () => offsetAt("a\nbc", { line: 2, character: 0 });
    const beyondColumn = () => offsetAt("a\nbc", { line: 0, character: 2 });
    // Assert
    expect(beyondLine).toThrow(Error);
    expect(beyondColumn).toThrow(Error);
  });
});

describe("applyEdits", () => {
  it("1 つの編集を当てる（正常系）", () => {
    // Act
    const got = applyEdits("part def A;", [edit(0, 9, 0, 10, "B")]);
    // Assert
    expect(got).toBe("part def B;");
  });

  it("複数の編集を、渡した順によらず元の位置で当てる（正常系）", () => {
    // Arrange
    const text = "package P {\n    part def A;\n    part a : A;\n}\n";
    const edits = [edit(1, 13, 1, 14, "Wheel"), edit(2, 13, 2, 14, "Wheel")];
    // Act
    const forward = applyEdits(text, edits);
    const backward = applyEdits(text, [...edits].reverse());
    // Assert
    expect(forward).toBe("package P {\n    part def Wheel;\n    part a : Wheel;\n}\n");
    expect(backward).toBe(forward);
  });

  it("行をまたぐ範囲・挿入だけ・削除だけを当てる（同値分割）", () => {
    // Arrange
    const text = "a\nb\nc\n";
    // Act
    const across = applyEdits(text, [edit(0, 1, 2, 0, "")]);
    const insert = applyEdits(text, [edit(1, 0, 1, 0, "x")]);
    const remove = applyEdits(text, [edit(1, 0, 2, 0, "")]);
    // Assert
    expect([across, insert, remove]).toEqual(["ac\n", "a\nxb\nc\n", "a\nc\n"]);
  });

  it("列は UTF-16 で数える（絵文字は 2 つ。境界値）", () => {
    // Act
    const got = applyEdits("/* 😀 */ A", [edit(0, 9, 0, 10, "B")]);
    // Assert
    expect(got).toBe("/* 😀 */ B");
  });

  it("テキストの末尾・空のテキスト・編集なしを扱う（境界値）", () => {
    // Act
    const atEnd = applyEdits("ab", [edit(0, 2, 0, 2, "c")]);
    const intoEmpty = applyEdits("", [edit(0, 0, 0, 0, "x")]);
    const none = applyEdits("abc", []);
    // Assert
    expect([atEnd, intoEmpty, none]).toEqual(["abc", "x", "abc"]);
  });

  it("テキストの外を指す範囲は、当てずに例外にする（異常系）", () => {
    // Act
    const badLine = () => applyEdits("a\nb", [edit(5, 0, 5, 0, "x")]);
    const badColumn = () => applyEdits("a\nb", [edit(0, 9, 0, 9, "x")]);
    const pastEnd = () => applyEdits("a\nb", [edit(1, 5, 1, 5, "x")]);
    // Assert
    expect(badLine).toThrow();
    expect(badColumn).toThrow();
    expect(pastEnd).toThrow();
  });
});
