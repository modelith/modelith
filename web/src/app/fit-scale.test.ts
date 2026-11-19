// 図を開いたとき・「全体」を押したときの拡大率（F-VIEW-4）。
import { describe, expect, it } from "vitest";
import { fitScale, READABLE_FIT_MIN, READABLE_MIN } from "./fit-scale";

describe("fitScale（図全体を収める拡大率）", () => {
  it("ふつうの図は、全体が収まる拡大率にする（正常系）", () => {
    // Act
    const s = fitScale(0.5, 0.25, false);
    // Assert
    expect(s).toBe(0.5);
  });

  it("上限 1.1 と下限（floor）に収める（境界値）", () => {
    // Act
    const big = fitScale(3, 0.25, false);
    const top = fitScale(1.1, 0.25, false);
    const small = fitScale(0.1, 0.25, false);
    const narrow = fitScale(0.1, 0.45, false);
    // Assert
    expect([big, top, small, narrow]).toEqual([1.1, 1.1, 0.25, 0.45]);
  });

  it("読める大きさで開く図でも、少し縮めれば全体が収まるなら収める（端だけが切れた図にしない。#297）", () => {
    // Act（0.8 では右端が切れるが、0.73 なら収まる図）
    const s = fitScale(0.73, 0.25, true);
    // Assert
    expect(s).toBe(0.73);
  });

  it("読める大きさで開く図の、収める・収めないの境目は 0.7（境界値）", () => {
    // Act
    const at = fitScale(READABLE_FIT_MIN, 0.25, true);
    const below = fitScale(READABLE_FIT_MIN - 0.001, 0.25, true);
    // Assert（ちょうど 0.7 は収める。それより小さくしないと収まらない図は 0.8 で開く）
    expect(at).toBe(READABLE_FIT_MIN);
    expect(below).toBe(READABLE_MIN);
  });

  it("読める大きさで開く図でも、収まるならふつうの図と同じ（上限 1.1）", () => {
    // Act
    const s = fitScale(2, 0.25, true);
    const fits = fitScale(0.9, 0.25, true);
    // Assert
    expect([s, fits]).toEqual([1.1, 0.9]);
  });

  it("「全体」を押したとき（readable でない）は、大きな図も全体を収める", () => {
    // Act
    const s = fitScale(0.4, 0.25, false);
    // Assert
    expect(s).toBe(0.4);
  });
});
