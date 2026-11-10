// 元に戻す履歴の並び（F-EDIT-4。#244）。
import { describe, expect, it } from "vitest";
import { pushVersion } from "./history-list";

describe("pushVersion（F-EDIT-4）", () => {
  it("今の位置の後ろに版を足す（正常系）", () => {
    expect(pushVersion(["a", "b"], 1, "c", 200)).toEqual({ list: ["a", "b", "c"], at: 2 });
  });

  it("元に戻した後に足すと、やり直せた版は捨てる", () => {
    expect(pushVersion(["a", "b", "c"], 0, "d", 200)).toEqual({ list: ["a", "d"], at: 1 });
  });

  it("205 回編集しても、200 回元に戻せる（境界値：今の版のほかに 200 版を持つ。#244）", () => {
    // Arrange
    let h = { list: [0], at: 0 };
    // Act
    for (let v = 1; v <= 205; v++) h = pushVersion(h.list, h.at, v, 200);
    // Assert（今の版 205 から 200 回戻ると 5 になる）
    expect(h.list).toHaveLength(201);
    expect(h.list[0]).toBe(5);
    expect(h.list[h.at]).toBe(205);
  });
});
