// 問題一覧に出す行の数（F-EDIT-5。#236）。
import { describe, expect, it } from "vitest";
import { MAX_PROBLEM_ROWS, problemRows } from "./problem-rows";

describe("problemRows（F-EDIT-5）", () => {
  it("上限以下なら、すべての行をそのまま出す（境界値: ちょうど上限）", () => {
    // Arrange
    const rows = Array.from({ length: MAX_PROBLEM_ROWS }, (_, i) => `<b>${i}</b>`);
    // Act
    const out = problemRows(rows, MAX_PROBLEM_ROWS);
    // Assert
    expect(out).toEqual(rows);
  });

  it("上限を超えたら、上限までの行と、出していない件数を示す行を出す（境界値: 上限 + 1）", () => {
    // Arrange
    const rows = Array.from({ length: MAX_PROBLEM_ROWS + 1 }, (_, i) => `<b>${i}</b>`);
    // Act
    const out = problemRows(rows, MAX_PROBLEM_ROWS);
    // Assert
    expect(out).toHaveLength(MAX_PROBLEM_ROWS + 1);
    expect(out.at(-1)).toBe('<div class="more">ほかに 1 件あります。上の問題を直すと表示します</div>');
  });

  it("行が無ければ、何も出さない（境界値: 0 件）", () => {
    expect(problemRows([], MAX_PROBLEM_ROWS)).toEqual([]);
  });
});
