import { describe, expect, it } from "vitest";
import { applyEdits } from "./protocol";

const at = (line: number, character: number) => ({ line, character });

describe("applyEdits", () => {
  it("applies non-overlapping edits regardless of order", () => {
    const text = "part def A;\npart b : A;";
    const out = applyEdits(text, [
      { range: { start: at(0, 9), end: at(0, 10) }, newText: "Engine" },
      { range: { start: at(1, 9), end: at(1, 10) }, newText: "Engine" },
    ]);
    expect(out).toBe("part def Engine;\npart b : Engine;");
  });

  it("counts columns in UTF-16 code units", () => {
    const out = applyEdits("// 日本語\n", [{ range: { start: at(0, 6), end: at(0, 6) }, newText: "!" }]);
    expect(out).toBe("// 日本語!\n");
  });

  it("rejects out-of-range lines", () => {
    expect(() => applyEdits("a", [{ range: { start: at(5, 0), end: at(5, 0) }, newText: "" }])).toThrow(RangeError);
  });
});
