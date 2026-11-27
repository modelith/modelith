// 図の幾何計算のうち、package の枠（F-VIEW-9）。
import { describe, expect, it } from "vitest";
import type { Entry, ModelEdge, ModelLane, ModelNode } from "../core";
import { build, parse } from "../core/rust";
import { contentOf, viewDef, type ViewTarget } from "./view-content";
import { assertWord, autoPlace, BOUNDARY, boundaryBoxes, boxesOf, chooseFreeSide, clearSpot, pinsOf, LANE_HEAD, LANE_PAD, laneRects, placeInLanes, compartment, DOT, downward, endLabelPos, enumLines, featureText, freeSpot, keywordOf, nodeH, noteLines, NEST_PAD, NEST_TOP, packageRects, spreadLabels, computeRoutes, placeJunctions, placeNested, placeNotes, placeView, PKG_PAD, PKG_TAB, stackedHeight, stackedWidth, W, type Box, type NodeBox, type RouteEnd } from "./geometry";

const boxes: Record<string, Box> = {
  A: { x: 0, y: 0, w: 100, h: 50 },
  B: { x: 200, y: 100, w: 100, h: 50 },
};
const boxOf = (k: string): Box | undefined => boxes[k];

describe("packageRects（F-VIEW-9）", () => {
  it("枠は中の要素をすべて囲み、上に名前の札の分をあける", () => {
    // Act
    const [r] = packageRects([{ keys: ["A", "B"], inner: [] }], boxOf);
    // Assert
    expect(r).toEqual({ x: -PKG_PAD, y: -PKG_TAB, w: 300 + 2 * PKG_PAD, h: 150 + PKG_TAB + PKG_PAD });
  });

  it("外の枠は、中の枠も囲む（入れ子）", () => {
    // Act（0 番の中に 1 番がある。0 番に直接の要素は無い）
    const [outer, inner] = packageRects([{ keys: [], inner: [1] }, { keys: ["B"], inner: [] }], boxOf);
    // Assert
    expect(inner).toEqual({ x: 200 - PKG_PAD, y: 100 - PKG_TAB, w: 100 + 2 * PKG_PAD, h: 50 + PKG_TAB + PKG_PAD });
    expect(outer?.x).toBe((inner?.x ?? 0) - PKG_PAD);
    expect(outer?.y).toBe((inner?.y ?? 0) - PKG_TAB);
  });

  it("中に描く要素が無い枠は描かない（境界値）", () => {
    // Act
    const rs = packageRects([{ keys: ["Gone"], inner: [] }], boxOf);
    // Assert
    expect(rs).toEqual([null]);
  });

  it("入れ子の指定に輪があっても止まる（異常系）", () => {
    // Act
    const rs = packageRects([{ keys: ["A"], inner: [1] }, { keys: ["B"], inner: [0] }], boxOf);
    // Assert
    expect(rs.every((r) => r !== null)).toBe(true);
  });
});

describe("endLabelPos（8.2.3 の multiplicity：線の端の文字）", () => {
  const end = (P: [number, number], N: [number, number]): RouteEnd => ({ P, N, side: "t", t: 0.5, pin: null });

  it("上の辺の端では、線の右・辺の上に置く", () => {
    // Act
    const at = endLabelPos(end([100, 50], [0, -1]));
    // Assert
    expect(at).toEqual({ x: 104, y: 44, a: "start" });
  });

  it("下の辺の端では、線の右・辺の下に置く", () => {
    // Act
    const at = endLabelPos(end([100, 50], [0, 1]));
    // Assert
    expect(at).toEqual({ x: 104, y: 64, a: "start" });
  });

  it("左右の辺の端では、辺の外側に向けて揃え、線の上に置く", () => {
    // Act
    const [left, right] = [endLabelPos(end([0, 25], [-1, 0])), endLabelPos(end([224, 25], [1, 0]))];
    // Assert
    expect(left).toEqual({ x: -6, y: 20, a: "end" });
    expect(right).toEqual({ x: 230, y: 20, a: "start" });
  });
});

describe("featureText（8.2.3 の usage-cp：区画の属性の行）", () => {
  /** 属性の宣言を、必要な項目だけ指定して作る。 */
  const attr = (x: Partial<Entry>): Entry => ({
    kind: "attribute", isDef: false, short: "", name: "", type: "", owner: null, pe: null, start: 0, headEnd: 0, end: 0, head: "", exprs: [], children: [], idx: 0, ...x,
  });

  it("多重度も特殊化の相手も無ければ、これまでどおり「名前 : 型」か「名前 = 値」", () => {
    // Act
    const [typed, valued] = [featureText(attr({ name: "mass", type: "Real" })), featureText(attr({ name: "mass", type: "Real", value: "1500" }))];
    // Assert
    expect(typed).toBe("mass : Real");
    expect(valued).toBe("mass = 1500");
  });

  it("多重度は型の後ろに、ordered・nonunique を続けて書く", () => {
    // Act
    const t = featureText(attr({ name: "w", type: "Wheel", multiplicity: { range: "4", ordered: true, nonunique: false } }));
    // Assert
    expect(t).toBe("w : Wheel [4] ordered");
  });

  it("名前を書かずに再定義した特性は、名前を省いて「:>> 相手 = 値」にする", () => {
    // Act
    const t = featureText(attr({ name: "mass", value: "1500", specs: [{ op: "redefines", target: "mass", start: 0, end: 0 }] }));
    // Assert
    expect(t).toBe(":>> mass = 1500");
  });

  it("部分集合と参照は、相手ごとに記号を付けて並べる", () => {
    // Act
    const t = featureText(attr({ name: "b", type: "B", specs: [{ op: "subsets", target: "a", start: 0, end: 0 }, { op: "references", target: "x.y", start: 0, end: 0 }] }));
    // Assert
    expect(t).toBe("b : B :> a ::> x.y");
  });

  it("交差（crosses）は => で書く（8.2.2.6 の Crosses）", () => {
    // Act
    const t = featureText(attr({ name: "w", type: "A", specs: [{ op: "crosses", target: "q.r", start: 0, end: 0 }] }));
    // Assert
    expect(t).toBe("w : A => q.r");
  });

  it("初期値・既定値は、書いた記号（:=・default）のまま書く（8.2.2.6 の FeatureValue）", () => {
    // Act
    const [initial, byDefault, defaultInitial] = [
      featureText(attr({ name: "m", type: "Real", value: "10", valueOp: ":=" })),
      featureText(attr({ name: "m", type: "Real", value: "10", valueOp: "default" })),
      featureText(attr({ name: "m", value: "10", valueOp: "default :=", multiplicity: { range: "1", ordered: false, nonunique: false } })),
    ];
    // Assert
    expect([initial, byDefault, defaultInitial]).toEqual(["m := 10", "m default 10", "m [1] default := 10"]);
  });

  it("型も値も無い参照（ref r）は、名前だけを書く（境界）", () => {
    // Act
    const t = featureText(attr({ name: "r", type: "" }));
    // Assert
    expect(t).toBe("r");
  });

  it("範囲の無い多重度（nonunique だけ）は、括弧を書かない（境界）", () => {
    // Act
    const t = featureText(attr({ name: "n", type: "N", multiplicity: { range: "", ordered: false, nonunique: true } }));
    // Assert
    expect(t).toBe("n : N nonunique");
  });
});

describe("downward・autoPlace（ブロック定義図で、一般な側を上に置く）", () => {
  const edge = (kind: ModelEdge["kind"], from: string, to: string): ModelEdge => ({ id: `${kind}|${from}|${to}`, kind, from, to, label: "", src: { start: 0, end: 0 } });

  it("特殊化の線は一般な側（終わり）を上に、部品として持つ線は持ち主（始まり）を上にする", () => {
    // Act
    const [spec, comp] = [downward(edge("specialize", "B", "A")), downward(edge("comp", "V", "W"))];
    // Assert
    expect(spec).toEqual(["A", "B"]);
    expect(comp).toEqual(["V", "W"]);
  });

  it("深さで並べる図では、特殊化した定義を元の定義の下の段に置く", () => {
    // Arrange
    const node = (key: string): ModelNode => ({
      key, name: key, short: "", kind: "part def", isDef: true, fam: "part", trans: [], ports: [], phase: null, phaseOwn: false,
      entry: { kind: "part def", isDef: true, short: "", name: key, type: "", owner: null, pe: null, start: 0, headEnd: 0, end: 0, head: "", exprs: [], children: [], idx: 0 },
    });
    const pos: Record<string, [number, number]> = {};
    // Act
    autoPlace([node("B"), node("A")], [edge("specialize", "B", "A")], pos, { id: "structure", label: "ブロック定義図", diagramName: "ブロック定義図", std: "GeneralView", depth: true }, null);
    // Assert
    expect((pos["A"]?.[1] ?? NaN) < (pos["B"]?.[1] ?? NaN)).toBe(true);
  });
});

describe("boxesOf・placeJunctions（内部ブロック図の n 項の接続の点、8.2.3.13 の n-ary-connection-dot）", () => {
  const node = (key: string, junction = false): ModelNode => ({
    key, name: key, short: "", kind: junction ? "connection" : "part", isDef: false, fam: "part", trans: [], ports: [], phase: null, phaseOwn: false,
    ...(junction ? { junction: true } : {}),
    entry: { kind: "part", isDef: false, short: "", name: key, type: "", owner: null, pe: null, start: 0, headEnd: 0, end: 0, head: "", exprs: [], children: [], idx: 0 },
  });
  const seg = (from: string, to: string): ModelEdge => ({ id: `connect|${from}|${to}|#1`, kind: "connect", from, to, label: "", src: { start: 0, end: 0 } });

  it("点は DOT 四方、ほかの要素は幅 W の矩形にする", () => {
    // Act
    const boxes = boxesOf([node("u:a"), node("j:#1", true)], { "u:a": [10, 20], "j:#1": [300, 40] });
    // Assert
    expect(boxes.get("u:a")).toEqual({ x: 10, y: 20, w: W, h: 44 });
    expect(boxes.get("j:#1")).toEqual({ x: 300, y: 40, w: DOT, h: DOT });
  });

  it("座標の無い点は、つながる要素の中心の平均に置く", () => {
    // Arrange
    const nodes = [node("u:a"), node("u:b"), node("j:#1", true)];
    const pos: Record<string, [number, number]> = { "u:a": [0, 0], "u:b": [0, 400] };
    // Act
    placeJunctions(nodes, [seg("j:#1", "u:a"), seg("j:#1", "u:b")], pos);
    // Assert
    expect(pos["j:#1"]).toEqual([W / 2 - DOT / 2, (22 + 422) / 2 - DOT / 2]);
  });

  it("中心の平均が要素に重なるときは、つながる要素の下に置く", () => {
    // Arrange（3 つが横に並び、平均が真ん中の要素の中に入る）
    const nodes = [node("u:a"), node("u:b"), node("u:c"), node("j:#1", true)];
    const pos: Record<string, [number, number]> = { "u:a": [0, 0], "u:b": [300, 0], "u:c": [600, 0] };
    // Act
    placeJunctions(nodes, [seg("j:#1", "u:a"), seg("j:#1", "u:b"), seg("j:#1", "u:c")], pos);
    // Assert
    expect(pos["j:#1"]).toEqual([300 + W / 2 - DOT / 2, 44 + 60 - DOT / 2]);
  });

  it("座標のある点と、つながる要素に座標の無い点は動かさない（境界値）", () => {
    // Arrange
    const nodes = [node("u:a"), node("j:#1", true), node("j:#2", true)];
    const pos: Record<string, [number, number]> = { "j:#1": [5, 5] };
    // Act
    placeJunctions(nodes, [seg("j:#1", "u:a"), seg("j:#2", "u:a")], pos);
    // Assert
    expect(pos).toEqual({ "j:#1": [5, 5] });
  });
});

describe("boxesOf・stackedHeight・stackedWidth・placeNested（内部ブロック図の入れ子）", () => {
  const node = (key: string, container?: string): ModelNode => ({
    key, name: key, short: "", kind: "part", isDef: false, fam: "part", trans: [], ports: [], phase: null, phaseOwn: false,
    ...(container ? { container } : {}),
    entry: { kind: "part", isDef: false, short: "", name: key, type: "", owner: null, pe: null, start: 0, headEnd: 0, end: 0, head: "", exprs: [], children: [], idx: 0 },
  });
  const nodes = [node("u:a"), node("u:a.x", "u:a"), node("u:a.y", "u:a"), node("u:b")];

  it("中に部品を描く部品は、自身の座標によらず中の部品をすべて囲む", () => {
    // Act
    const box = boxesOf(nodes, { "u:a": [999, 999], "u:a.x": [100, 100], "u:a.y": [100, 200] }).get("u:a");
    // Assert
    expect(box).toEqual({ x: 100 - NEST_PAD, y: 100 - NEST_TOP, w: W + 2 * NEST_PAD, h: 144 - 100 + 100 + NEST_TOP + NEST_PAD });
  });

  it("並べるときの高さは、中の部品を縦に積んだ高さ。中に部品が無ければふつうの高さ（境界値）", () => {
    // Act
    const [a, b] = [stackedHeight(nodes[0] as ModelNode, nodes), stackedHeight(nodes[3] as ModelNode, nodes)];
    // Assert
    expect(a).toBe(NEST_TOP + 44 + 30 + 44 + NEST_PAD);
    expect(b).toBe(44);
  });

  it("座標の無い中の部品は、外の部品の中に縦に積む", () => {
    // Arrange
    const pos: Record<string, [number, number]> = { "u:a": [0, 0] };
    // Act
    placeNested(nodes, pos);
    // Assert
    expect([pos["u:a.x"], pos["u:a.y"]]).toEqual([[NEST_PAD, NEST_TOP], [NEST_PAD, NEST_TOP + 44 + 30]]);
    expect(boxesOf(nodes, pos).get("u:a")).toEqual({ x: 0, y: 0, w: W + 2 * NEST_PAD, h: stackedHeight(nodes[0] as ModelNode, nodes) });
  });

  it("3 段目の入れ子：中の中の部品の高さと幅まで数えて積み、外の部品の矩形はすべてを囲む", () => {
    // Arrange（u:a の中に u:a.x（その中に u:a.x.v）と u:a.y）
    const deep = [node("u:a"), node("u:a.x", "u:a"), node("u:a.x.v", "u:a.x"), node("u:a.y", "u:a")];
    const pos: Record<string, [number, number]> = { "u:a": [0, 0] };
    // Act
    placeNested(deep, pos);
    // Assert
    const inner = NEST_TOP + 44 + NEST_PAD;
    expect([pos["u:a.x"], pos["u:a.x.v"], pos["u:a.y"]]).toEqual([[NEST_PAD, NEST_TOP], [2 * NEST_PAD, 2 * NEST_TOP], [NEST_PAD, NEST_TOP + inner + 30]]);
    expect(stackedHeight(deep[0] as ModelNode, deep)).toBe(NEST_TOP + inner + 30 + 44 + NEST_PAD);
    expect(stackedWidth(deep[0] as ModelNode, deep)).toBe(W + 4 * NEST_PAD);
    expect(boxesOf(deep, pos).get("u:a")).toEqual({ x: 0, y: 0, w: W + 4 * NEST_PAD, h: stackedHeight(deep[0] as ModelNode, deep) });
  });

  it("中に部品が無ければ、並べるときの幅はふつうの幅（境界値）", () => {
    // Act
    const w = stackedWidth(nodes[3] as ModelNode, nodes);
    // Assert
    expect(w).toBe(W);
  });

  it("外の部品に座標が無ければ、中の部品を置かない（異常系）", () => {
    // Arrange
    const pos: Record<string, [number, number]> = {};
    // Act
    placeNested(nodes, pos);
    // Assert
    expect(pos).toEqual({});
  });
});

describe("keywordOf（見出しのキーワード、8.2.2.9 の individual）", () => {
  /** 図の要素を、種類と修飾だけ指定して作る。 */
  const node = (kind: string, mods: string): ModelNode => ({
    key: "A", name: "A", short: "", kind, isDef: kind.endsWith(" def"), fam: "part", trans: [], ports: [], phase: null, phaseOwn: false,
    entry: { kind, isDef: kind.endsWith(" def"), short: "", name: "A", type: "", owner: null, pe: null, start: 0, headEnd: 0, end: 0, head: "", exprs: [], children: [], idx: 0, mods },
  });

  it("個体なら、種類の前に individual を付ける", () => {
    // Act
    const k = keywordOf(node("part def", "individual"));
    // Assert
    expect(k).toBe("individual part def");
  });

  it("ほかの修飾だけなら、種類のまま（individual を含む語と取り違えない）", () => {
    // Act
    const [plain, other] = [keywordOf(node("part def", "abstract")), keywordOf(node("part", "individualish"))];
    // Assert
    expect([plain, other]).toEqual(["part def", "part"]);
  });
});

describe("メモ（8.2.3.4 の comment）", () => {
  /** メモの図の要素を、名前と本文だけ指定して作る。 */
  const note = (key: string, name: string, body: string): ModelNode => ({
    key, name, short: "", kind: "comment", isDef: false, fam: "other", trans: [], ports: [], phase: null, phaseOwn: false, note: true,
    entry: { kind: "comment", isDef: false, short: "", name, type: "", owner: null, pe: null, start: 0, headEnd: 0, end: 0, head: "", exprs: [], children: [], idx: 0, body },
  });
  /** 幅 W・高さ 44 の要素。 */
  const block = (key: string): ModelNode => ({
    key, name: key, short: "", kind: "part def", isDef: true, fam: "part", trans: [], ports: [], phase: null, phaseOwn: false,
    entry: { kind: "part def", isDef: true, short: "", name: key, type: "", owner: null, pe: null, start: 0, headEnd: 0, end: 0, head: "", exprs: [], children: [], idx: 0 },
  });
  const annotate = (from: string, to: string): ModelEdge => ({ id: `annotate|${from}|${to}`, kind: "annotate", from, to, label: "", src: { start: 0, end: 0 } });

  it("noteLines は本文の改行を保ち、6 行を超えたら最後の行を「…」で切る", () => {
    // Act
    const [two, many, empty] = [noteLines("1 行目\n2 行目"), noteLines("a\nb\nc\nd\ne\nf\ng"), noteLines("")];
    // Assert
    expect(two.map((l) => l.t)).toEqual(["1 行目", "2 行目"]);
    expect(many.map((l) => l.t)).toEqual(["a", "b", "c", "d", "e", "…"]);
    expect(empty).toEqual([]);
  });

  it("nodeH は、名前の無いメモは本文だけ、名前のあるメモは名前の行の分だけ高い", () => {
    // Act
    const [unnamed, named] = [nodeH(note("note:#1", "", "x")), nodeH(note("note:c", "c", "x"))];
    // Assert
    expect([unnamed, named]).toEqual([33, 51]);
  });

  it("placeNotes は、座標の無いメモを注釈する要素の右に置き、右がふさがっていれば上に置く", () => {
    // Arrange
    const [A, B, N] = [block("A"), block("B"), note("note:#1", "", "x")];
    const free: Record<string, [number, number]> = { A: [0, 0] };
    const blocked: Record<string, [number, number]> = { A: [0, 0], B: [264, 0] };
    // Act
    placeNotes([A, N], [annotate("note:#1", "A")], free);
    placeNotes([A, B, N], [annotate("note:#1", "A")], blocked);
    // Assert
    expect(free["note:#1"]).toEqual([W + 40, 0]);
    expect(blocked["note:#1"]).toEqual([0, -73]);
  });

  it("placeNotes は、相手に座標が無ければ置かず、置いたメモは動かさない（境界）", () => {
    // Arrange
    const [A, N, M] = [block("A"), note("note:#1", "", "x"), note("note:#2", "", "y")];
    const pos: Record<string, [number, number]> = { "note:#2": [5, 5] };
    // Act
    placeNotes([A, N, M], [annotate("note:#1", "A"), annotate("note:#2", "A")], pos);
    // Assert
    expect(pos).toEqual({ "note:#2": [5, 5] });
  });
});

describe("compartment（要求図の区画：前提・満たすべき制約・目的。8.2.3.20〜22）", () => {
  /** テキストを読み、名前の要素の区画の行を返す。 */
  const rows = (text: string, name: string): string[] => {
    const n = build(parse(text)).nodes.find((x) => x.name === name);
    return n ? compartment(n).map((l) => l.t) : [];
  };

  it("要求には、require の式に加えて assume と assert（否定は assert not）の式を書く（正常系）", () => {
    // Act
    const got = rows("package P { requirement def R { require constraint { a > 0 } assume constraint { b > 0 } assert not constraint { c > 0 } } }", "R");
    // Assert
    expect(got).toEqual(["{ a > 0 }", "assume { b > 0 }", "assert not { c > 0 }"]);
  });

  it("部品定義にも、満たすべき制約（assert）の式を書く", () => {
    // Act
    const got = rows("package P { part def H { assert constraint { x < 0 } } }", "H");
    // Assert
    expect(got).toEqual(["assert { x < 0 }"]);
  });

  it("検証には、目的の説明と式を書き、持ち主の説明も残す", () => {
    // Act
    const got = rows("package P { requirement def R; verification def V { doc /* 沸騰の検証 */ objective { doc /* 3 分で沸く */ verify R; } } }", "V");
    // Assert
    expect(got).toEqual(["沸騰の検証", "objective: 3 分で沸く"]);
  });

  it("assertWord は否定した制約に not を付ける（境界値）", () => {
    // Act / Assert
    expect([assertWord({ text: "x", via: "assert" }), assertWord({ text: "x", via: "assert", neg: true })]).toEqual(["assert", "assert not"]);
  });
});

describe("compartment（列挙の定義の区画、8.2.3.8 の enums-compartment）", () => {
  /** テキストを読み、名前で図の要素を引く。 */
  const nodeOf = (text: string, name: string): ModelNode => {
    const n = build(parse(text)).nodes.find((x) => x.name === name);
    if (!n) throw new Error(`${name} がありません`);
    return n;
  };

  it("F-EDIT-8: 列挙値を、書いた順に 1 行ずつ書く。値や型を書いた列挙値は、キーワードの有無によらず `名前 = 値`・`名前 : 型` と書く（同値分割）", () => {
    // Arrange
    const n = nodeOf("package P { enum def Level { low; enum mid; enum high = 3; top = 4; typed : Real; } }", "Level");
    // Act
    const [lines, drawn] = [enumLines(n.entry), compartment(n)];
    // Assert
    expect(lines).toEqual(["low", "mid", "high = 3", "top = 4", "typed : Real"]);
    expect(drawn).toEqual(lines.map((t) => ({ t, cls: "attr" })));
  });

  it("列挙値の無い列挙の定義は、区画に何も書かない。ほかの定義は、列挙値の行を持たない（境界値）", () => {
    // Arrange
    const text = "package P { enum def Empty; enum def E { a; } part def A { enum e : E; } }";
    // Act
    const [empty, other] = [compartment(nodeOf(text, "Empty")), enumLines(nodeOf(text, "A").entry)];
    // Assert
    expect(empty).toEqual([]);
    expect(other).toEqual([]);
  });

  it("列挙値が多いときは、ほかの区画と同じく 8 行で切って残りの行数を示す（境界値：8 個と 9 個）", () => {
    // Arrange
    const def = (count: number): string => `package P { enum def E { ${Array.from({ length: count }, (_, i) => `v${i};`).join(" ")} } }`;
    // Act
    const [eight, nine] = [compartment(nodeOf(def(8), "E")), compartment(nodeOf(def(9), "E"))];
    // Assert
    expect(eight.map((l) => l.t)).toEqual(["v0", "v1", "v2", "v3", "v4", "v5", "v6", "v7"]);
    expect(nine.map((l) => l.t)).toEqual(["v0", "v1", "v2", "v3", "v4", "v5", "v6", "… ほか 2 行"]);
  });
});

describe("compartment（説明の区画、8.2.3.4 の documentation-compartment）", () => {
  it("部品定義などにも説明（doc）を 2 行まで書く", () => {
    // Arrange
    const n = build(parse("package P { part def A { doc /* お湯を沸かす道具 */ attribute m : Real; } }")).nodes.find((x) => x.name === "A");
    // Act
    const got = n ? compartment(n).map((l) => [l.t, l.cls]) : [];
    // Assert
    expect(got).toEqual([["お湯を沸かす道具", "doc"], ["m : Real", "attr"]]);
  });
});

describe("boundaryBoxes（内部ブロック図の枠の上のポート、8.2.3.13）", () => {
  /** 向きだけを持つ枠の上のポート。 */
  const bp = (name: string, dir: "in" | "out" | "inout"): ModelNode =>
    ({ key: "b:" + name, name, boundary: dir }) as unknown as ModelNode;
  const frame: Box = { x: 0, y: 0, w: 400, h: 300 };

  it("入力は左の辺、出力は右の辺、両向きは下の辺に、四角の中心を辺に載せる", () => {
    // Arrange
    const ports = [bp("a", "in"), bp("b", "out"), bp("c", "inout")];
    // Act
    const r = boundaryBoxes(frame, ports);
    // Assert
    const h = BOUNDARY / 2;
    expect(r.get("b:a")).toEqual({ x: -h, y: 150 - h, w: BOUNDARY, h: BOUNDARY });
    expect(r.get("b:b")).toEqual({ x: 400 - h, y: 150 - h, w: BOUNDARY, h: BOUNDARY });
    expect(r.get("b:c")).toEqual({ x: 200 - h, y: 300 - h, w: BOUNDARY, h: BOUNDARY });
  });

  it("同じ辺のポートは、等しい間隔で並べる", () => {
    // Arrange
    const ports = [bp("a", "in"), bp("b", "in")];
    // Act
    const r = boundaryBoxes(frame, ports);
    // Assert
    expect([r.get("b:a")?.y, r.get("b:b")?.y]).toEqual([100 - BOUNDARY / 2, 200 - BOUNDARY / 2]);
  });

  it("ポートが無ければ空（境界値）", () => {
    // Act / Assert
    expect(boundaryBoxes(frame, []).size).toBe(0);
  });
});

describe("laneRects・placeInLanes（アクティビティ図の区画、8.2.3.17 の swimlane）", () => {
  /** 受け持つ要素のキーだけを持つ区画。 */
  const lane = (name: string, nodes: string[]): ModelLane => ({ key: "lane:" + name, name, nodes }) as unknown as ModelLane;
  /** 幅 168・高さ 44 のアクション。 */
  const act = (key: string): ModelNode =>
    ({ key, name: key, kind: "action", flow: true, ports: [], entry: { kind: "action", children: [], head: "", type: "" } }) as unknown as ModelNode;

  it("区画ごとに受け持つ要素を左右の余白付きで囲み、上下はすべての区画でそろえる", () => {
    // Arrange
    const boxes = new Map<string, Box>([
      ["a", { x: 100, y: 200, w: 168, h: 44 }],
      ["b", { x: 300, y: 300, w: 168, h: 44 }],
    ]);
    // Act
    const r = laneRects([lane("heater", ["a"]), lane("ctrl", ["b"])], boxes);
    // Assert
    expect(r.map((x) => [x.lane.name, x.r])).toEqual([
      ["heater", { x: 100 - LANE_PAD, y: 200 - LANE_HEAD, w: 168 + 2 * LANE_PAD, h: 344 + LANE_PAD - (200 - LANE_HEAD) }],
      ["ctrl", { x: 300 - LANE_PAD, y: 200 - LANE_HEAD, w: 168 + 2 * LANE_PAD, h: 344 + LANE_PAD - (200 - LANE_HEAD) }],
    ]);
  });

  it("受け持つ要素が図に無い区画は描かず、区画が無ければ空（境界値）", () => {
    // Act / Assert
    expect(laneRects([lane("x", ["nope"])], new Map())).toEqual([]);
    expect(laneRects([], new Map())).toEqual([]);
  });

  it("置いたばかりの要素を、区画を受け持たない列・区画ごとの列に、縦の位置はそのまま置き直す", () => {
    // Arrange
    const nodes = [act("start"), act("a"), act("b")];
    const pos: Record<string, [number, number]> = { start: [0, 0], a: [0, 100], b: [0, 200] };
    // Act
    placeInLanes(nodes, [lane("heater", ["a"]), lane("ctrl", ["b"])], pos, new Set(["start", "a", "b"]));
    // Assert（列の幅は 168 + 2 × LANE_PAD。列は隙間なく並ぶ）
    const col = 168 + 2 * LANE_PAD;
    expect([pos["start"], pos["a"], pos["b"]]).toEqual([
      [LANE_PAD, 0],
      [col + LANE_PAD, 100],
      [2 * col + LANE_PAD, 200],
    ]);
  });

  it("自分で動かした要素（置いたばかりでない要素）は動かさない", () => {
    // Arrange
    const pos: Record<string, [number, number]> = { a: [500, 100] };
    // Act
    placeInLanes([act("a")], [lane("heater", ["a"])], pos, new Set());
    // Assert
    expect(pos["a"]).toEqual([500, 100]);
  });
});


describe("placeView（座標の無い要素を自動で並べる、F-VIEW-3）", () => {
  const auto = (view: string): ViewTarget => ({ view, modelView: null, ibdCtx: null, seqCtx: null, flowCtx: null, stateCtx: null, phase: "" });

  it("置かれた要素があれば、座標の無い要素をその一番下から 80 下に並べる", () => {
    // Arrange
    const M = build(parse("package P { part def A; part def B; }"));
    const c = contentOf(M, auto("structure"), {});
    const pos: Record<string, [number, number]> = { A: [0, 0] };
    const a = c.nodes.find((n) => n.key === "A");
    if (!a) throw new Error("A がありません");
    // Act
    placeView(c, viewDef("structure"), pos, null);
    // Assert
    expect(pos["A"]).toEqual([0, 0]);
    expect(pos["B"]?.[1]).toBe(nodeH(a) + 80);
  });

  it("すべて置かれていれば、座標を変えない（境界）", () => {
    // Arrange
    const M = build(parse("package P { part def A; part def B; }"));
    const c = contentOf(M, auto("structure"), {});
    const pos: Record<string, [number, number]> = { A: [0, 0], B: [300, 40] };
    // Act
    placeView(c, viewDef("structure"), pos, null);
    // Assert
    expect(pos).toEqual({ A: [0, 0], B: [300, 40] });
  });

  it("シーケンス図では何もしない", () => {
    // Arrange
    const M = build(parse("package P { part def A; occurrence def S { part a : A; part b : A; message m from a to b; } }"));
    const c = contentOf(M, { ...auto("seq"), seqCtx: "S" }, {});
    const pos: Record<string, [number, number]> = {};
    // Act
    placeView(c, viewDef("seq"), pos, null);
    // Assert
    expect(pos).toEqual({});
  });

  it("状態遷移図は、状態を遷移の向きに並べる（placeStates）", () => {
    // Arrange
    const M = build(parse("package P { state def K { entry; then idle; state idle; transition first idle then busy; state busy; } }"));
    const c = contentOf(M, { ...auto("stm"), stateCtx: "K" }, {});
    const pos: Record<string, [number, number]> = {};
    // Act
    placeView(c, viewDef("stm"), pos, null);
    // Assert
    expect((pos["s:idle"]?.[0] ?? NaN) < (pos["s:busy"]?.[0] ?? NaN)).toBe(true);
  });
});

describe("freeSpot（既にある要素に重ならない位置、F-VIEW-8・#297）", () => {
  const size = { w: W, h: 44 };
  const at = (x: number, y: number): Box => ({ x, y, ...size });

  it("何も無ければ、置きたい位置のまま（正常系）", () => {
    // Act
    const p = freeSpot([200, 170], size, []);
    // Assert
    expect(p).toEqual([200, 170]);
  });

  it("同じ位置に要素があれば、その下に間を空けて置く（3 つ続けて置いても重ならない）", () => {
    // Act
    const second = freeSpot([200, 170], size, [at(200, 170)]);
    const third = freeSpot([200, 170], size, [at(200, 170), at(second[0], second[1])]);
    // Assert（下端 214 から 40 空けて 254、10 単位に切り上げて 260。その下端 304 から 40 空けて 344 → 350）
    expect(second).toEqual([200, 260]);
    expect(third).toEqual([200, 350]);
  });

  it("ずらした先にも要素があれば、さらにその下に置く（並びの順によらない）", () => {
    // Act（下の要素を先に渡す）
    const p = freeSpot([200, 170], size, [at(200, 260), at(200, 170)]);
    // Assert
    expect(p).toEqual([200, 350]);
  });

  it("一部だけ重なる要素も避ける", () => {
    // Act（右下にずれた要素と、角が重なる）
    const p = freeSpot([200, 170], size, [at(400, 200)]);
    // Assert（下端 244 から 40 空けて 284 → 290）
    expect(p).toEqual([200, 290]);
  });

  it("縁が接するだけの要素・離れた要素は避けない（境界値）", () => {
    // Act（右隣にちょうど接する・真下にちょうど接する・1 だけ重なる）
    const right = freeSpot([200, 170], size, [at(200 + W, 170)]);
    const below = freeSpot([200, 170], size, [at(200, 170 + 44)]);
    const one = freeSpot([200, 170], size, [at(200 + W - 1, 170 + 43)]);
    // Assert
    expect(right).toEqual([200, 170]);
    expect(below).toEqual([200, 170]);
    expect(one).toEqual([200, 300]);
  });
});

describe("spreadLabels：重なる線のラベル（F-VIEW-3・#325）", () => {
  it("同じ位置のラベルは、後のものを 1 行ずつ下へずらす", () => {
    // Act
    const out = spreadLabels([
      { x: 50, y: 13, a: "middle", w: 40 },
      { x: 50, y: 13, a: "middle", w: 30 },
      { x: 50, y: 13, a: "middle", w: 30 },
    ]);
    // Assert
    expect(out).toEqual([{ x: 50, y: 13, a: "middle" }, { x: 50, y: 26, a: "middle" }, { x: 50, y: 39, a: "middle" }]);
  });

  it("横に並ぶだけ・縦に 1 行離れているラベルは、動かさない（境界値）", () => {
    // Arrange（1 つめは x が 0〜40。2 つめは 40 から始まり、3 つめは 1 行下にある）
    const labs = [
      { x: 0, y: 13, a: "start" as const, w: 40 },
      { x: 40, y: 13, a: "start" as const, w: 30 },
      { x: 0, y: 26, a: "start" as const, w: 40 },
    ];
    // Act
    const out = spreadLabels(labs);
    // Assert
    expect(out.map((l) => l.y)).toEqual([13, 13, 26]);
  });

  it("中央揃えと左揃えのラベルは、文字の範囲で重なりを見る", () => {
    // Act（中央揃えは 30〜70、左揃えは 60〜90 で重なる。左揃えが 70 から始まれば重ならない）
    const hit = spreadLabels([{ x: 50, y: 13, a: "middle", w: 40 }, { x: 60, y: 13, a: "start", w: 30 }]);
    const free = spreadLabels([{ x: 50, y: 13, a: "middle", w: 40 }, { x: 70, y: 13, a: "start", w: 30 }]);
    // Assert
    expect(hit[1]?.y).toBe(26);
    expect(free[1]?.y).toBe(13);
  });

  it("ラベルが無ければ、空を返す（境界値）", () => {
    expect(spreadLabels([])).toEqual([]);
  });

  it("同じ 2 つの要素の間の 2 本の線が同じ経路を通っても、ラベルは重ならない", () => {
    // Arrange（A と B の間の少し下に C があり、2 本の線はどちらも C の上の同じ道を通る）
    const M = build(parse("package P { part def A { part one : B; ref part two : B; } part def B; part def C; }"));
    const pos: Record<string, [number, number]> = { A: [600, 30], C: [300, 50], B: [0, 30] };
    const rects = boxesOf(M.nodes, pos);
    const box = new Map<string, NodeBox>(M.nodes.filter((n) => n.key in pos).map((n) => [n.key, { ...(rects.get(n.key) as NodeBox), n, pins: [] }]));
    const edges = M.edges.filter((e) => box.has(e.from) && box.has(e.to) && e.label);
    // Act
    const labs = [...computeRoutes(box, edges, undefined, "ortho").values()].map((r) => r.lab);
    // Assert
    expect(labs).toHaveLength(2);
    expect(labs[0]?.x).toBe(labs[1]?.x);
    expect(Math.abs((labs[0]?.y ?? 0) - (labs[1]?.y ?? 0))).toBe(13);
  });
});

describe("線の端をポートから離す（F-VIEW-3）", () => {
  it.each([
    ["接続点が無ければ、望む位置のまま", 100, [], 50, 50],
    ["接続点の近くなら、16 離れた近い側へ動かす", 100, [50], 52, 66],
    ["接続点からちょうど 16 離れていれば、そのまま（境界）", 100, [50], 66, 66],
    ["接続点から 15 なら、動かす（境界）", 100, [50], 65, 66],
    ["角に近すぎる望みは、角から 8 の位置にする", 100, [], 2, 8],
    ["動かした先が別の接続点に近ければ、どれからも離れた位置にする", 100, [40, 56], 50, 72],
  ])("clearSpot：%s", (_title, len, fixed, want, expected) => {
    // Act
    const pos = clearSpot(len, fixed, want);
    // Assert
    expect(pos).toBe(expected);
  });

  it("clearSpot：角からも接続点からも離せる所が無い辺は null（異常系）", () => {
    // Act（長さ 44 の辺の中央に接続点。置けるのは 8〜36 で、どこも接続点から 16 未満）
    const pos = clearSpot(44, [22], 22);
    // Assert
    expect(pos).toBeNull();
  });

  /** 位置 (0, 0)・幅 224・高さ h の要素の矩形を、右の辺の中央のポートの有無を指定して作る。 */
  const boxWith = (h: number, pins: NodeBox["pins"]): NodeBox => ({ x: 0, y: 0, w: 224, h, n: build(parse("part def A;")).nodes[0] as NodeBox["n"], pins });
  const port = { name: "o", dir: "out" } as NonNullable<NodeBox["pins"][number]["port"]>;
  const upperRight: Box = { x: 450, y: -160, w: 224, h: 44 };

  it("chooseFreeSide：ポートが無ければ、相手の向きの辺のまま", () => {
    // Act
    const side = chooseFreeSide(boxWith(44, []), upperRight);
    // Assert
    expect(side).toBe("r");
  });

  it("chooseFreeSide：相手の向きの辺がポートでふさがっていれば、相手の側のほかの辺にする", () => {
    // Act（高さ 44 の右の辺の中央にポート。相手は右上）
    const side = chooseFreeSide(boxWith(44, [{ id: "port:o", side: "r", t: 0.5, port }]), upperRight);
    // Assert
    expect(side).toBe("t");
  });

  it("chooseFreeSide：辺が長く、ポートから離して置ければ、相手の向きの辺のまま", () => {
    // Act（高さ 71 の右の辺の中央にポート。下に 16 離して置ける）
    const side = chooseFreeSide(boxWith(71, [{ id: "port:o", side: "r", t: 0.5, port }]), upperRight);
    // Assert
    expect(side).toBe("r");
  });

  it("chooseFreeSide：ほかの辺もふさがっていれば、相手の向きの辺のまま（異常系）", () => {
    // Arrange（右の辺の中央と、上の辺に 16 おきに接続点を並べる）
    const top = Array.from({ length: 15 }, (_, i) => ({ id: `a${i}`, side: "t" as const, t: (i * 16) / 224 }));
    // Act
    const side = chooseFreeSide(boxWith(44, [{ id: "port:o", side: "r", t: 0.5, port }, ...top]), upperRight);
    // Assert
    expect(side).toBe("r");
  });

  it("部品として持つ線は、ポートのある短い辺を避けて、要素の上の辺に着く", () => {
    // Arrange（持ち主 K の左下に、右の辺にポートのある C を置く）
    const M = build(parse("package P { port def Pt; part def K { part c : C; } part def C { out port o : Pt; } }"));
    const pos: Record<string, [number, number]> = { K: [450, 0], C: [0, 180] };
    const rects = boxesOf(M.nodes, pos);
    const box = new Map<string, NodeBox>(M.nodes.filter((n) => n.key in pos).map((n) => [n.key, { ...(rects.get(n.key) as NodeBox), n, pins: pinsOf(n, undefined, "structure") }]));
    const edges = M.edges.filter((e) => e.kind === "comp" && box.has(e.from) && box.has(e.to));
    // Act
    const [route] = [...computeRoutes(box, edges, undefined, "ortho").values()];
    // Assert
    expect(box.get("C")?.pins.map((p) => p.side)).toEqual(["r"]);
    expect(route?.to.side).toBe("t");
  });
});
