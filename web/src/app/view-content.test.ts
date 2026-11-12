// 図に出す要素の選び方を、画面の状態（S）を使わずに、図の対象（ViewTarget）から決める（ADR-0024）。
import { describe, expect, it } from "vitest";
import { build, parse } from "../core/rust";
import { contentOf, layoutKey, resolveTarget, type ViewTarget } from "./view-content";

/** 自動の図の対象（対象・工程の指定なし）。 */
const AUTO: ViewTarget = { view: "all", modelView: null, ibdCtx: null, seqCtx: null, flowCtx: null, stateCtx: null, phase: "" };

const MODEL = `package P {
  part def Engine { part c : Cyl; }
  part def Cyl;
  part def Vehicle { part e : Engine; part w : Wheel; part x : Wheel; }
  part def Wheel;
  view V : InterconnectionView { expose P::Engine; }
}`;

describe("resolveTarget（図の対象を選び直す）", () => {
  it("自動の内部ブロック図で対象が無ければ、部品が最も多いブロックを選ぶ", () => {
    // Arrange
    const M = build(parse(MODEL));
    // Act
    const t = resolveTarget(M, { ...AUTO, view: "ibd" });
    // Assert
    expect(t.ibdCtx).toBe("Vehicle");
  });

  it("自動の内部ブロック図で対象がモデルにあれば、そのまま使う", () => {
    // Arrange
    const M = build(parse(MODEL));
    // Act
    const t = resolveTarget(M, { ...AUTO, view: "ibd", ibdCtx: "Engine" });
    // Assert
    expect(t.ibdCtx).toBe("Engine");
  });

  it("テキストの view では、expose の対象を内部ブロック図の対象にする（F-VIEW-7）", () => {
    // Arrange
    const M = build(parse(MODEL));
    // Act
    const t = resolveTarget(M, { ...AUTO, view: "ibd", modelView: "V", ibdCtx: "Vehicle" });
    // Assert
    expect(t.ibdCtx).toBe("Engine");
  });

  it("テキストから消えた view では、対象を変えない（異常系）", () => {
    // Arrange
    const M = build(parse(MODEL));
    const before = { ...AUTO, view: "ibd", modelView: "Gone", ibdCtx: "Vehicle" };
    // Act
    const t = resolveTarget(M, before);
    // Assert
    expect(t).toEqual(before);
    expect(t).not.toBe(before);
  });
});

describe("layoutKey（配置のキー）", () => {
  it.each([
    [{ ...AUTO, view: "ibd", ibdCtx: "Vehicle" }, "ibd:Vehicle"],
    [{ ...AUTO, view: "afv", flowCtx: "Control" }, "afv:Control"],
    [{ ...AUTO, view: "stm", stateCtx: "Kettle" }, "stm:Kettle"],
    [{ ...AUTO, modelView: "Overview" }, "view:Overview"],
    [{ ...AUTO, view: "seq", modelView: "Scenario" }, "seq"],
    [{ ...AUTO, view: "structure" }, "structure"],
  ])("%o → %s", (t, expected) => {
    // Act
    const k = layoutKey(t);
    // Assert
    expect(k).toBe(expected);
  });
});

describe("contentOf（図に出す要素と関係）", () => {
  it("内部ブロック図は、対象の部品と、対象の枠を出す", () => {
    // Arrange
    const M = build(parse(MODEL));
    // Act
    const c = contentOf(M, { ...AUTO, view: "ibd", ibdCtx: "Vehicle" }, {});
    // Assert
    expect(c.nodes.map((n) => n.key)).toEqual(["u:e", "u:w", "u:x"]);
    expect(c.frame).toEqual({ kind: "part def", title: "Vehicle" });
  });

  it("テキストから消えた view は、空で、その名前を案内に出す（異常系）", () => {
    // Arrange
    const M = build(parse(MODEL));
    // Act
    const c = contentOf(M, { ...AUTO, modelView: "Gone" }, {});
    // Assert
    expect(c.nodes).toEqual([]);
    expect(c.empty).toBe("作成した図「Gone」は、モデルから消えています。");
  });

  it("自動の図は、配置に座標がある要素を、種類が違っても出す（配置は書き換えない）", () => {
    // Arrange
    const M = build(parse("package P { part def A; requirement def R; }"));
    const layout = { structure: { pos: { R: [0, 0] as [number, number] }, pins: {}, ends: {} } };
    // Act
    const c = contentOf(M, { ...AUTO, view: "structure" }, layout);
    // Assert
    expect(c.nodes.map((n) => n.key)).toEqual(["A", "R"]);
    expect(Object.keys(layout)).toEqual(["structure"]);
  });

  it("配置が空なら、種類の合う要素だけを出す（境界）", () => {
    // Arrange
    const M = build(parse("package P { part def A; requirement def R; }"));
    // Act
    const c = contentOf(M, { ...AUTO, view: "structure" }, {});
    // Assert
    expect(c.nodes.map((n) => n.key)).toEqual(["A"]);
  });
});
