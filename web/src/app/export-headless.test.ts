// 画面の「エクスポート…」と、画面を介さない図の書き出し（render/index.ts）が、同じモデル・同じ図から同じ SVG と draw.io を作ること（ADR-0024 の 3）。
import { describe, expect, it } from "vitest";
import { build, parse } from "../core/rust";
import { diagramDrawio, diagramSvg } from "../render/index";
import { LIGHT_DIAGRAMS, LIGHT_MODEL } from "../render/testing/headless-fixture";
import type { ViewTarget } from "../render/view-content";
import { drawioXml, svgExport } from "./export";
import { S } from "./state";
import { ensureLayout } from "./sync";

/**
 * 画面の状態を、そのタブで図を開いたときと同じにする（配置は空から始め、座標の無い要素を画面と同じ手順で置く）。
 *
 * @param text SysML v2 のテキスト
 * @param t 開く図
 * @param edgeStyle 画面の線の形
 */
function openInApp(text: string, t: ViewTarget, edgeStyle: "ortho" | "curve"): void {
  S.M = build(parse(text));
  S.view = t.view;
  S.modelView = t.modelView;
  S.ibdCtx = t.ibdCtx;
  S.seqCtx = t.seqCtx;
  S.flowCtx = t.flowCtx;
  S.stateCtx = t.stateCtx;
  S.phase = t.phase;
  S.layout = {};
  S.edgeStyle = edgeStyle;
  ensureLayout();
}

describe("画面のエクスポートと、画面を介さない書き出しの一致（F-EXP-1・F-EXP-2）", () => {
  it.each(LIGHT_DIAGRAMS)("$name の SVG が一致する", ({ target }) => {
    // Arrange
    openInApp(LIGHT_MODEL, target, "ortho");
    const headless = diagramSvg(build(parse(LIGHT_MODEL)), target, {});
    // Act
    const app = svgExport();
    // Assert
    expect(app).toEqual(headless);
  });

  it.each(LIGHT_DIAGRAMS)("$name の draw.io が一致する", ({ target }) => {
    // Arrange
    openInApp(LIGHT_MODEL, target, "ortho");
    const headless = diagramDrawio(build(parse(LIGHT_MODEL)), target, {});
    // Act
    const app = drawioXml();
    // Assert
    expect(app).toBe(headless);
  });

  it("線の形が曲線でも一致する", () => {
    // Arrange
    const target = LIGHT_DIAGRAMS[1]?.target;
    if (!target) throw new Error("ブロック定義図の対象がありません");
    openInApp(LIGHT_MODEL, target, "curve");
    const headless = [diagramSvg(build(parse(LIGHT_MODEL)), target, {}, { edgeStyle: "curve" }), diagramDrawio(build(parse(LIGHT_MODEL)), target, {}, { edgeStyle: "curve" })];
    // Act
    const app = [svgExport(), drawioXml()];
    // Assert
    expect(app).toEqual(headless);
  });
});
