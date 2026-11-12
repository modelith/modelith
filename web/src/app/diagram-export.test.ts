// 図のエクスポートの中身（draw.io の XML・SVG）を、画面の状態を使わずに、図の内容・配置・描き方から作る（F-EXP-1・F-EXP-2）。
import { describe, expect, it } from "vitest";
import { build, parse } from "../core/rust";
import { drawioDocument, svgDocument } from "./diagram-export";
import { placeView } from "./geometry";
import { emptyView } from "./layout";
import { contentOf, viewDef, type ViewTarget } from "./view-content";

/** ブロック定義図の対象（対象・工程の指定なし）。 */
const STRUCTURE: ViewTarget = { view: "structure", modelView: null, ibdCtx: null, seqCtx: null, flowCtx: null, stateCtx: null, phase: "" };

/**
 * テキストからブロック定義図の内容と、座標の無い要素を置いた配置を作る。
 *
 * @param text SysML v2 のテキスト
 * @returns 図の内容と配置
 */
function structure(text: string) {
  const c = contentOf(build(parse(text)), STRUCTURE, {});
  const L = emptyView();
  placeView(c, viewDef("structure"), L.pos, null);
  return { c, L };
}

describe("drawioDocument（F-EXP-2）", () => {
  it("要素の無い図は、根の 2 つのセルだけで、ページの名前は図の種類の名前（境界）", () => {
    // Act
    const xml = drawioDocument({ nodes: [], edges: [] }, emptyView(), { view: "structure", edgeStyle: "ortho" });
    // Assert
    expect(xml).toBe('<mxfile host="app.diagrams.net"><diagram id="v" name="ブロック定義図"><mxGraphModel grid="1" gridSize="10"><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>');
  });

  it("ページの名前を渡せば、それを使う", () => {
    // Act
    const xml = drawioDocument({ nodes: [], edges: [] }, emptyView(), { view: "structure", edgeStyle: "ortho", page: "車" });
    // Assert
    expect(xml).toContain('name="車"');
  });

  it("線の形が曲線なら、draw.io の線も曲線にする", () => {
    // Arrange
    const { c, L } = structure("package P { part def A { part b : B; } part def B; }");
    // Act
    const xml = drawioDocument(c, L, { view: "structure", edgeStyle: "curve" });
    // Assert
    expect(xml).toContain("curved=1;");
    expect(xml).not.toContain("edgeStyle=orthogonalEdgeStyle;");
  });
});

describe("svgDocument（F-EXP-1・F-EXP-4）", () => {
  it("要素の無い図は 100×100 の白い背景だけ（境界）", () => {
    // Act
    const image = svgDocument({ nodes: [], edges: [] }, emptyView(), { view: "structure", edgeStyle: "ortho", phases: false });
    // Assert
    expect([image.width, image.height]).toEqual([100, 100]);
    expect(image.svg).toContain('<rect x="0" y="0" width="100" height="100" fill="#FFFFFF"/>');
  });

  it("要素が 1 つなら、余白 40 をとって囲み、透明にすれば背景を描かない", () => {
    // Arrange
    const { c, L } = structure("package P { part def A; }");
    // Act
    const image = svgDocument(c, L, { view: "structure", edgeStyle: "ortho", phases: false, transparent: true });
    // Assert
    expect([image.width, image.height]).toEqual([304, 124]);
    expect(image.svg).not.toContain('<rect x="-40" y="-40" width="304" height="124" fill="#FFFFFF"/>');
    expect(image.svg).not.toContain("var(--");
  });
});
