// @vitest-environment node
// 画面を介さずに図を書き出す（ADR-0024 の 3）。DOM の無い Node の環境で、コア（wasm）が作ったモデルから SVG と draw.io を作れること。
import { describe, expect, it } from "vitest";
import { build, parse } from "../core/rust";
import { diagramDrawio, diagramSvg, prepareDiagram, type Layout } from "./index";
import { LIGHT_DIAGRAMS, LIGHT_MODEL } from "./testing/headless-fixture";

describe("diagramSvg・diagramDrawio（DOM の無い環境での図の書き出し）", () => {
  it("DOM の無い環境で動いている（前提）", () => {
    // Act
    const hasDom = typeof (globalThis as { document?: unknown }).document !== "undefined" || typeof (globalThis as { window?: unknown }).window !== "undefined";
    // Assert
    expect(hasDom).toBe(false);
  });

  it.each(LIGHT_DIAGRAMS)("$name を SVG にすると、図の要素の名前が入る", ({ target, names }) => {
    // Arrange
    const M = build(parse(LIGHT_MODEL));
    // Act
    const image = diagramSvg(M, target, {});
    // Assert
    expect(image.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(image.width).toBeGreaterThan(100);
    for (const name of names) expect(image.svg).toContain(name);
  });

  it.each(LIGHT_DIAGRAMS)("$name を draw.io にすると、図の要素の名前が入る", ({ target, names }) => {
    // Arrange
    const M = build(parse(LIGHT_MODEL));
    // Act
    const xml = diagramDrawio(M, target, {});
    // Assert
    expect(xml.startsWith('<mxfile host="app.diagrams.net">')).toBe(true);
    for (const name of names) expect(xml).toContain(name);
  });

  it("同じ入力からは、同じ図ができる（決定的）", () => {
    // Arrange
    const M = build(parse(LIGHT_MODEL));
    const target = LIGHT_DIAGRAMS[2]?.target;
    if (!target) throw new Error("内部ブロック図の対象がありません");
    // Act
    const [a, b] = [diagramSvg(M, target, {}), diagramSvg(build(parse(LIGHT_MODEL)), target, {})];
    // Assert
    expect(a).toEqual(b);
  });

  it("渡した配置は書き換えず、保存した座標はそのまま使う", () => {
    // Arrange
    const M = build(parse(LIGHT_MODEL));
    const layout: Layout = { structure: { pos: { Battery: [500, 300] }, pins: {}, ends: {} } };
    const before = structuredClone(layout);
    // Act
    const d = prepareDiagram(M, { view: "structure", modelView: null, ibdCtx: null, seqCtx: null, flowCtx: null, stateCtx: null, phase: "" }, layout);
    // Assert
    expect(layout).toEqual(before);
    expect(d.layout.pos["Battery"]).toEqual([500, 300]);
    expect(Object.keys(d.layout.pos).sort()).toEqual(["Battery", "Lamp", "Light"]);
  });

  it("線の形に曲線を選ぶと、draw.io の線も曲線になる", () => {
    // Arrange
    const M = build(parse(LIGHT_MODEL));
    // Act
    const xml = diagramDrawio(M, { view: "structure", modelView: null, ibdCtx: null, seqCtx: null, flowCtx: null, stateCtx: null, phase: "" }, {}, { edgeStyle: "curve" });
    // Assert
    expect(xml).toContain("curved=1;");
  });

  it("対象の無い図は、空の図になる（異常系：内部ブロック図に描ける部品定義が無い）", () => {
    // Arrange
    const M = build(parse("package P { part def A; }"));
    // Act
    const image = diagramSvg(M, { view: "ibd", modelView: null, ibdCtx: null, seqCtx: null, flowCtx: null, stateCtx: null, phase: "" }, {});
    // Assert
    expect([image.width, image.height]).toEqual([100, 100]);
  });
});
