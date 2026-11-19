import { describe, expect, it } from "vitest";
import { isLayoutJson, layoutFromJson, layoutToJson } from "./layout";

describe("layoutFromJson", () => {
  it("座標・接続点・線の端を読み分ける", () => {
    // Arrange
    const raw = { trace: { A: [10, 20], "@pins": { A: { a1: ["r", 0.5] } }, "@ends": { "flow|A|B|#1": ["a1", null] } } };
    // Act
    const L = layoutFromJson(raw);
    // Assert
    expect(L).toEqual({ trace: { pos: { A: [10, 20] }, pins: { A: { a1: ["r", 0.5] } }, ends: { "flow|A|B|#1": ["a1", null] } } });
  });

  it("形の合わない値は捨てる（異常系）", () => {
    // Arrange
    const raw = { trace: { A: [1], B: "x", "@pins": { A: { a1: ["z", 0.5] } } }, broken: 3 };
    // Act
    const L = layoutFromJson(raw);
    // Assert
    expect(L).toEqual({ trace: { pos: {}, pins: { A: {} }, ends: {} } });
  });
});

describe("layoutToJson", () => {
  it("読み取った形に戻す（往復で変わらない）", () => {
    // Arrange
    const raw = { ibd: { "u:a": [0, 0], "@pins": { "u:a": { "port:p": ["l", 0.3] } }, "@ends": { e: [null, "port:p"] } } };
    // Act
    const back = layoutToJson(layoutFromJson(raw));
    // Assert
    expect(back).toEqual(raw);
  });

  it("空の接続点・線の端は書かない（境界値: 空）", () => {
    // Arrange
    const L = { v: { pos: { A: [0, 0] as [number, number] }, pins: { A: {} }, ends: {} } };
    // Act
    const json = layoutToJson(L);
    // Assert
    expect(json).toEqual({ v: { A: [0, 0] } });
  });
});

describe("isLayoutJson（C-11、#244）", () => {
  it("知っている形の項目と、知らない @ の項目は通す（正常系）", () => {
    // Arrange
    const raw = {
      trace: { A: [10, 20], "@pins": { A: { a1: ["r", 0.5] } }, "@ends": { e: ["a1", null] }, "@bends": { e: [[1, 2]] }, "@note": "新しい版の項目" },
      empty: {},
    };
    // Act / Assert
    expect(isLayoutJson(raw)).toBe(true);
    expect(isLayoutJson({})).toBe(true); // 境界値：ビューが無い
  });

  it.each([
    ["ビューが配列", { v: [1, 2] }],
    ["ビューが文字列", { v: "bad" }],
    ["座標が文字列", { v: { A: "bad" } }],
    ["座標の数が 1 つ", { v: { A: [1] } }],
    ["接続点の向きが違う", { v: { "@pins": { A: { a1: ["z", 0.5] } } } }],
    ["線の端が配列でない", { v: { "@ends": "x" } }],
    ["曲がり角が空", { v: { "@bends": { e: [] } } }],
  ])("%s なら false（異常系）", (_, raw) => {
    // Act / Assert
    expect(isLayoutJson(raw as Record<string, unknown>)).toBe(false);
  });
});
