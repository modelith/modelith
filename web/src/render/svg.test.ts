// 線の記法（8.2.3）。図の種類ごとの破線と矢印。
import { describe, expect, it } from "vitest";
import { build, parse } from "../core/rust";
import { emptyView } from "./layout";
import { withNotes } from "./notes";
import type { Box } from "./geometry";
import { CV, DEFS, edgeStroke, fileBadge, kindIcon, portLabelY, svgMarkup } from "./svg";

describe("edgeStroke（8.2.3 の線の記法）", () => {
  it.each([
    ["specialize", ' marker-end="url(#mTri)"'],
    ["subset", ' marker-end="url(#mTri)"'],
    ["redefine", ' marker-end="url(#mRedef)"'],
    ["reference", ' marker-end="url(#mRef)"'],
  ])("%s は実線で、白抜きの三角の矢印を付ける", (kind, expected) => {
    // Act
    const attrs = edgeStroke(kind);
    // Assert
    expect(attrs).toBe(expected);
  });

  it("満たす関係は、これまでどおり破線と開いた矢印", () => {
    // Act
    const attrs = edgeStroke("satisfy");
    // Assert
    expect(attrs).toBe(' stroke-dasharray="6 4" marker-end="url(#mOpen)"');
  });

  it("依存は破線で、供給する側に開いた矢印を付ける（8.2.3.3）", () => {
    // Act
    const attrs = edgeStroke("dependency");
    // Assert
    expect(attrs).toBe(' stroke-dasharray="6 4" marker-end="url(#mOpen)"');
  });

  it("割り当ては破線で、割り当て先に開いた矢印を付ける（8.2.3.15 の allocate-relationship）", () => {
    // Act
    const attrs = edgeStroke("allocate");
    // Assert
    expect(attrs).toBe(' stroke-dasharray="6 4" marker-end="url(#mOpen)"');
  });

  it("部品として持つ線は、始まりの端にひし形を付ける", () => {
    // Act
    const attrs = edgeStroke("comp");
    // Assert
    expect(attrs).toBe(' marker-start="url(#mDiamond)"');
  });

  it("部品として持つ線のひし形は、線の始まりから線の向きに描く（持ち主の箱の外に出る）", () => {
    // Act
    const marker = /<marker id="mDiamond"[^>]*>/.exec(DEFS)?.[0];
    // Assert（始まりの点にひし形の端を合わせ、線の向きのまま描く。auto-start-reverse にすると箱の中に入って隠れる）
    expect(marker).toContain('refX="1"');
    expect(marker).toContain('orient="auto"');
  });

  it.each([["bind"], ["connect"]])("結び付けと n 項の接続の線（%s）は、矢印の無い実線にする（8.2.3.13 の binding-connection・n-ary-segment）", (kind) => {
    // Act
    const attrs = edgeStroke(kind);
    // Assert
    expect(attrs).toBe("");
  });

  it("知らない種類は、開いた矢印にする（境界）", () => {
    // Act
    const attrs = edgeStroke("bogus");
    // Assert
    expect(attrs).toBe(' marker-end="url(#mOpen)"');
  });
});

describe("メモ（8.2.3.4 の comment と annotation-link）", () => {
  it("メモから要素への線は、矢印の無い破線にする", () => {
    // Act
    const attrs = edgeStroke("annotate");
    // Assert
    expect(attrs).toBe(' stroke-dasharray="6 4"');
  });

  it("メモは角を折った四角に本文を書き、名前があれば «comment» と名前を書く", () => {
    // Arrange
    const M = build(parse("package P { part def A; comment c about A /* 安全のため */ }"));
    const content = withNotes(M.notes, { nodes: M.nodes, edges: [] });
    const L = emptyView();
    L.pos = { A: [0, 0], "note:c": [300, 0] };
    // Act
    const { ns } = svgMarkup(CV, content, L, { view: "all" });
    // Assert
    const note = ns.slice(ns.indexOf('<g class="node note"'));
    expect(note).toContain('data-key="note:c" transform="translate(300,0)"');
    expect(note).toContain('<path class="body" d="M0,0 H212 L224,12 V51 H0 Z"');
    expect(note).toContain("«comment» <tspan");
    expect(note).toContain(">安全のため</text>");
    expect(note).not.toContain('class="pin"');
  });
});

describe("kindIcon の色（種類の系統）", () => {
  it.each([
    ["requirement def", "req"],
    ["concern", "concern"],
    ["verification def", "ver"],
    ["analysis", "ver"],
    ["constraint def", "con"],
    ["calc", "con"],
    ["state def", "beh"],
    ["use case", "beh"],
    ["part", "part"],
    ["port def", "other"],
  ])("%s は %s の色で描く", (kind, fam) => {
    // Act
    const icon = kindIcon(kind);
    // Assert
    expect(icon).toContain(`fill="var(--k-${fam}-bg)"`);
  });
});

describe("fileBadge（ほかのファイルの要素の札、ADR-0021 §4）", () => {
  it("札にはファイルの名前だけを書き、パスはツールチップに出す", () => {
    // Act
    const svg = fileBadge(CV, "lib/parts.sysml", "inherit");
    // Assert
    expect(svg).toContain("<title>lib/parts.sysml</title>");
    expect(svg).toContain(">parts.sysml</text>");
    expect(svg).toMatch(/^<g class="filebadge" transform="translate\(0,-17\)">/);
  });

  it("名前は逃がして書く（異常系：< や & を含む名前）", () => {
    // Act
    const svg = fileBadge(CV, "a<b>&c.sysml", "inherit");
    // Assert
    expect(svg).toContain(">a&lt;b&gt;&amp;c.sysml</text>");
  });
});

describe("ポートの名前の重なり（F-VIEW-3）", () => {
  const placed = (): Box[] => [{ x: 30, y: 89, w: 40, h: 11 }];

  it.each([
    ["重ならなければ、いつもの高さ", { x: 100, w: 40 }, 127, 100],
    ["重なるなら、代わりの高さ", { x: 0, w: 40 }, 127, 127],
    ["縁が接するだけなら、いつもの高さ（境界）", { x: 70, w: 40 }, 127, 100],
    ["1 だけ重なるなら、代わりの高さ（境界）", { x: 69, w: 40 }, 127, 127],
    ["代わりが無ければ、いつもの高さのまま", { x: 0, w: 40 }, null, 100],
  ])("portLabelY：%s", (_title, span, other, expected) => {
    // Act
    const y = portLabelY(placed(), span, 100, other);
    // Assert
    expect(y).toBe(expected);
  });

  it("portLabelY：代わりの高さも重なるなら、いつもの高さのまま（異常系）", () => {
    // Arrange
    const taken = [...placed(), { x: 0, y: 116, w: 40, h: 11 }];
    // Act
    const y = portLabelY(taken, { x: 0, w: 40 }, 100, 127);
    // Assert
    expect(y).toBe(100);
  });

  it("portLabelY：決めた場所を覚え、次の名前はそこを避ける", () => {
    // Arrange
    const taken: Box[] = [];
    // Act
    const first = portLabelY(taken, { x: 0, w: 40 }, 100, 127);
    const second = portLabelY(taken, { x: 20, w: 40 }, 100, 127);
    // Assert
    expect([first, second]).toEqual([100, 127]);
  });

  it("隣り合う要素の向かい合うポートの名前は、違う高さに書く", () => {
    // Arrange（A の右の辺の出力のポートと、すぐ右の B の左の辺の入力のポートが、同じ高さで向かい合う）
    const M = build(parse("package P { port def Pt; part def A { out port longOutput : Pt; } part def B { in port longInput : ~Pt; } }"));
    const view = { ...emptyView(), pos: { A: [0, 0], B: [300, 0] } as Record<string, [number, number]> };
    // Act
    const { ns } = svgMarkup(CV, { nodes: M.nodes.filter((n) => n.key === "A" || n.key === "B"), edges: [] }, view, { view: "structure" });
    // Assert
    const y = (name: string): string | undefined => new RegExp(`<text x="[^"]*" y="([^"]*)"[^>]*>${name}</text>`).exec(ns)?.[1];
    expect(y("longOutput")).toBeDefined();
    expect(y("longInput")).toBeDefined();
    expect(y("longOutput")).not.toBe(y("longInput"));
  });
});
