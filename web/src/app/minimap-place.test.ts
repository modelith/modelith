import { describe, expect, it } from "vitest";
import { minimapPlace } from "./minimap-place";

// 幅 390px の画面の大きさ：ボタンの列は上から 12px・4 つで下の端が 160px、右の端から 46px
const ROOM = { miniH: 114, zoomBottom: 160, zoomSpan: 46 };

describe("minimapPlace（F-VIEW-4・Q-2）", () => {
  it("インスペクタを隠していれば、CSS の既定の位置のまま", () => {
    // Act
    const p = minimapPlace({ ...ROOM, wrapH: 600, inspH: null });
    // Assert
    expect(p).toEqual({ bottom: "", right: "" });
  });

  it("インスペクタを開き、図の枠が高ければ、インスペクタの上に持ち上げるだけ（正常系）", () => {
    // Act
    const p = minimapPlace({ ...ROOM, wrapH: 800, inspH: 200 });
    // Assert
    expect(p).toEqual({ bottom: "222px", right: "" });
  });

  it("持ち上げた全体図がボタンの列にかかるときは、ボタンの列の左に寄せる（#267）", () => {
    // Act
    const p = minimapPlace({ ...ROOM, wrapH: 600, inspH: 380 });
    // Assert
    expect(p).toEqual({ bottom: "402px", right: "54px" });
  });

  it.each([
    // 全体図の上の端 = 600 - (190 + 22) - 114 = 274。ボタンの列の下の端 + 間 = 168
    [190, ""], // 上の端 274（離れている）
    [296, ""], // 上の端 168（ちょうど間の幅を空けている。境界値）
    [297, "54px"], // 上の端 167（間の幅に 1px かかる。境界値）
  ])("インスペクタの高さ %i では、右からの位置は「%s」（境界値）", (inspH, right) => {
    // Act
    const p = minimapPlace({ ...ROOM, wrapH: 600, inspH });
    // Assert
    expect(p.right).toBe(right);
  });

  it("全体図を隠していれば（高さ 0）、寄せない", () => {
    // Act
    const p = minimapPlace({ ...ROOM, wrapH: 300, inspH: 280, miniH: 0 });
    // Assert
    expect(p).toEqual({ bottom: "302px", right: "" });
  });
});
