// 道具の単体テスト（F-AI-1・F-AI-2・F-AI-3）。コア・書く口は偽物に差し替え、道具の判断（絞り込み・失敗の伝え方・読めないファイル・提案と書き込みの 2 段階）だけを確かめる。
import { describe, expect, it } from "vitest";
import { Refused, type Core, type EditProposal, type EditRequest, type ElementSummary, type ProblemReport, type ProjectInput } from "./core.ts";
import { versionOf } from "./edits.ts";
import { memoryProposals } from "./proposals.ts";
import { diagramRequest, editRequest, TOOLS, ToolError, unreadableReports, type Tool, type ToolContext } from "./tools.ts";

const RANGE = { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } };

/** 要素の概要を作る。 */
function summary(qualifiedName: string, kind: string, file: string): ElementSummary {
  return { qualifiedName, name: qualifiedName.split("::").at(-1) ?? "", kind, file, range: RANGE };
}

/** 問題 1 件を作る。 */
function problem(file: string, message: string): ProblemReport {
  return { file, diagnostic: { range: RANGE, severity: "error", message, source: "modelith" } };
}

const ELEMENTS = [
  summary("Shop", "package", "shop.sysml"),
  summary("Shop::Cart", "part def", "shop.sysml"),
  summary("Parts::Wheel", "part def", "parts.sysml"),
];

/** 決まった結果を返す偽のコア。 */
const core: Core = {
  version: () => "0.0.0-test",
  outline: (files) => ({
    files: files.map((f) => ({ path: f.path })),
    elements: ELEMENTS,
    diagrams: [{ name: "v", qualifiedName: "Shop::v", kind: "GeneralView", file: "shop.sysml", range: RANGE }],
  }),
  element: (_files, name) => (name === "Shop::Cart" ? { ...ELEMENTS[1]!, members: [], ports: [], relations: [] } : null),
  problems: () => [problem("shop.sysml", "a"), problem("parts.sysml", "b")],
  // 名前の変更だけを知っている：shop.sysml の先頭の 1 文字を新しい名前に置き換える提案を返す。「Nope」を指したら断る
  propose: (input, request): EditProposal => {
    if (request.type !== "rename" || request.element === "Nope") throw new Refused("見つかりません");
    const shop = input.files.find((f) => f.path === "shop.sysml");
    return {
      changes: request.name === "same" ? [] : [{
        file: "shop.sysml",
        baseVersion: versionOf(shop?.text ?? ""),
        edits: [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }, newText: request.name }],
      }],
      problems: [problem("shop.sysml", "after")],
    };
  },
};

const project: ProjectInput = {
  files: [{ path: "parts.sysml", text: "" }, { path: "shop.sysml", text: "abc" }],
  unreadable: [],
  pluginFiles: {},
};

/** 指定をそのまま文にして返す、偽の図を書き出す口。view が "nope" なら断る。 */
const renderer: ToolContext["renderer"] = {
  render: (_project, request) => {
    if (request.view === "nope") throw new Refused("The diagram was not found.");
    return { content: `${request.format}:${request.file}:${request.view ?? "-"}:${request.auto ?? "-"}` };
  },
};

/** 書いた中身を覚えるだけの、偽の書く口。 */
function recorder(): { written: [string, string][]; writer: ToolContext["writer"] } {
  const written: [string, string][] = [];
  return { written, writer: { write: (path, text) => Promise.resolve(void written.push([path, text])) } };
}

/** 道具に渡すもの（読むだけの道具は、書く口と提案を覚える口を使わない）。 */
function ctx(input: ProjectInput = project, more: Partial<ToolContext> = {}): ToolContext {
  return { core, project: input, writer: recorder().writer, proposals: memoryProposals(), renderer, ...more };
}

/** 名前で道具を引く。 */
function tool(name: string): Tool {
  const found = TOOLS.find((t) => t.name === name);
  if (!found) throw new Error(`道具 ${name} がありません`);
  return found;
}

describe("道具の一覧", () => {
  it("F-AI-1・F-AI-2・F-AI-3: 読む・確かめる 5 つ、図を書き出す 1 つ、提案・書き込みの 2 つの道具を、説明と引数つきで出す（正常系）", () => {
    // Act
    const names = TOOLS.map((t) => t.name);
    const required = TOOLS.flatMap((t) => Object.entries(t.params).filter(([, p]) => p.required).map(([n]) => `${t.name}.${n}`));
    // Assert
    expect(names).toEqual(["list_files", "list_elements", "get_element", "list_diagrams", "list_problems", "export_diagram", "propose_edit", "apply_edit"]);
    expect(required).toEqual(["get_element.qualifiedName", "export_diagram.format", "propose_edit.type", "apply_edit.proposalId"]);
    // 書くのは apply_edit だけ
    expect(TOOLS.filter((t) => t.writes).map((t) => t.name)).toEqual(["apply_edit"]);
    expect(TOOLS.every((t) => t.title && t.description)).toBe(true);
  });
});

describe("list_files・list_diagrams", () => {
  it("コアの概要から、ファイルと図をそのまま返す（正常系）", () => {
    // Act
    const files = tool("list_files").run(ctx(), {});
    const diagrams = tool("list_diagrams").run(ctx(), {});
    // Assert
    expect(files).toEqual([{ path: "parts.sysml" }, { path: "shop.sysml" }]);
    expect(diagrams).toEqual([{ name: "v", qualifiedName: "Shop::v", kind: "GeneralView", file: "shop.sysml", range: RANGE }]);
  });
});

describe("list_elements", () => {
  it("条件を省くとすべて、ファイル・種類を渡すと合うものだけを返す（同値分割）", () => {
    // Arrange
    const run = (args: Record<string, string>) =>
      (tool("list_elements").run(ctx(), args) as ElementSummary[]).map((e) => e.qualifiedName);
    // Act
    const all = run({});
    const byFile = run({ file: "shop.sysml" });
    const byKind = run({ kind: "part def" });
    const both = run({ file: "shop.sysml", kind: "part def" });
    // Assert
    expect(all).toEqual(["Shop", "Shop::Cart", "Parts::Wheel"]);
    expect(byFile).toEqual(["Shop", "Shop::Cart"]);
    expect(byKind).toEqual(["Shop::Cart", "Parts::Wheel"]);
    expect(both).toEqual(["Shop::Cart"]);
  });

  it("合うものが無い条件・種類の一部だけの条件では、空を返す（境界値）", () => {
    // Act
    const noFile = tool("list_elements").run(ctx(), { file: "nope.sysml" });
    const partial = tool("list_elements").run(ctx(), { kind: "part" });
    // Assert
    expect([noFile, partial]).toEqual([[], []]);
  });
});

describe("get_element", () => {
  it("修飾名の要素の詳細を返す（正常系）", () => {
    // Act
    const found = tool("get_element").run(ctx(), { qualifiedName: "Shop::Cart" });
    // Assert
    expect(found).toMatchObject({ qualifiedName: "Shop::Cart", kind: "part def" });
  });

  it("要素が無い・名前を渡さないときは、一覧の道具を案内する文で失敗を伝える（異常系）", () => {
    // Act
    const missing = () => tool("get_element").run(ctx(), { qualifiedName: "Shop::Nope" });
    const empty = () => tool("get_element").run(ctx(), {});
    // Assert
    expect(missing).toThrow(new ToolError('No element named "Shop::Nope" was found. Use list_elements to see the qualified names.'));
    expect(empty).toThrow(ToolError);
  });
});

describe("list_problems", () => {
  it("コアの問題一覧を返し、ファイルを渡すとそのファイルの問題だけにする（正常系）", () => {
    // Arrange
    const run = (args: Record<string, string>) =>
      (tool("list_problems").run(ctx(), args) as ProblemReport[]).map((p) => `${p.file}:${p.diagnostic.message}`);
    // Act
    const all = run({});
    const one = run({ file: "parts.sysml" });
    // Assert
    expect(all).toEqual(["shop.sysml:a", "parts.sysml:b"]);
    expect(one).toEqual(["parts.sysml:b"]);
  });

  it("読めなかったファイルを、黙って飛ばさずに、先頭の問題として知らせる（異常系）", () => {
    // Arrange
    const withUnreadable: ProjectInput = { ...project, unreadable: [{ path: "bad.sysml", reason: "not UTF-8 text" }] };
    // Act
    const got = tool("list_problems").run(ctx(withUnreadable), {}) as ProblemReport[];
    // Assert
    expect(got).toHaveLength(3);
    expect(got[0]).toEqual({
      file: "bad.sysml",
      diagnostic: {
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
        severity: "error",
        message: "This file could not be read (not UTF-8 text).",
        source: "modelith",
      },
    });
  });

  it("読めなかったファイルが無ければ、何も足さない（境界値）", () => {
    // Act
    const got = unreadableReports(project);
    // Assert
    expect(got).toEqual([]);
  });
});

describe("editRequest", () => {
  it("種類ごとに、要る引数だけを取り出して編集の意図にする（同値分割）", () => {
    // Arrange（余分な引数は捨てる）
    const cases: Record<string, string>[] = [
      { type: "addElement", kind: "part def", name: "B", parent: "P", doc: "ignored" },
      { type: "addRelation", kind: "satisfy", from: "P::A", to: "P::R" },
      { type: "rename", element: "P::A", name: "B" },
      { type: "delete", element: "P::A" },
      { type: "setDoc", element: "P::A", doc: "" },
      { type: "replaceText", file: "a.sysml", text: "package P;" },
    ];
    // Act
    const got = cases.map(editRequest);
    // Assert
    expect(got).toEqual<EditRequest[]>([
      { type: "addElement", kind: "part def", name: "B", parent: "P" },
      { type: "addRelation", kind: "satisfy", from: "P::A", to: "P::R" },
      { type: "rename", element: "P::A", name: "B" },
      { type: "delete", element: "P::A" },
      { type: "setDoc", element: "P::A", doc: "" },
      { type: "replaceText", file: "a.sysml", text: "package P;" },
    ]);
  });

  it("知らない種類・種類なし・足りない引数は、何が要るかを書いた文で失敗を伝える（異常系）", () => {
    // Act
    const unknown = () => editRequest({ type: "explode" });
    const none = () => editRequest({});
    const one = () => editRequest({ type: "rename", element: "P::A" });
    const two = () => editRequest({ type: "addElement", kind: "part def" });
    const inherited = () => editRequest({ type: "toString" });
    // Assert
    expect(unknown).toThrow(new ToolError('Unknown type "explode". Use one of: addElement, addRelation, rename, delete, setDoc, replaceText.'));
    expect(none).toThrow(ToolError);
    expect(one).toThrow(new ToolError("rename needs name."));
    expect(two).toThrow(new ToolError("addElement needs name and parent."));
    expect(inherited).toThrow(ToolError);
  });
});

describe("propose_edit・apply_edit", () => {
  it("F-AI-2: 提案は何も書かずに、ID・差分・当てたあとの問題一覧を返す（正常系）", () => {
    // Arrange
    const { written, writer } = recorder();
    // Act
    const got = tool("propose_edit").run(ctx(project, { writer }), { type: "rename", element: "Shop::Cart", name: "X" }) as EditProposal & { proposalId: string };
    // Assert
    expect(got.proposalId).toMatch(/^[0-9a-f-]{36}$/);
    expect(got.changes.map((c) => [c.file, c.baseVersion])).toEqual([["shop.sysml", versionOf("abc")]]);
    expect(got.problems.map((p) => p.diagnostic.message)).toEqual(["after"]);
    expect(written).toEqual([]);
  });

  it("F-AI-2: 書き込みは、提案したときの中身を書き、書いたファイルと問題一覧を返す。同じ提案は 2 回書けない（正常系）", async () => {
    // Arrange
    const { written, writer } = recorder();
    const proposals = memoryProposals();
    const { proposalId } = tool("propose_edit").run(ctx(project, { proposals }), { type: "rename", element: "Shop::Cart", name: "X" }) as { proposalId: string };
    // Act
    const got = await tool("apply_edit").run(ctx(project, { writer, proposals }), { proposalId });
    const again = async () => tool("apply_edit").run(ctx(project, { writer, proposals }), { proposalId });
    // Assert
    expect(written).toEqual([["shop.sysml", "Xbc"]]);
    expect(got).toMatchObject({ written: ["shop.sysml"] });
    await expect(again()).rejects.toThrow(new ToolError("This proposal was not found. It may have been applied already. Call propose_edit again."));
    expect(written).toHaveLength(1);
  });

  it("F-AI-2: 提案のあとにファイルが変わっていたら、黙って上書きせず、何も書かずに断る（異常系）", async () => {
    // Arrange（提案のあとで、ほかのアプリが shop.sysml を書き換えた）
    const { written, writer } = recorder();
    const proposals = memoryProposals();
    const { proposalId } = tool("propose_edit").run(ctx(project, { proposals }), { type: "rename", element: "Shop::Cart", name: "X" }) as { proposalId: string };
    const changed: ProjectInput = { ...project, files: [{ path: "parts.sysml", text: "" }, { path: "shop.sysml", text: "abcd" }] };
    // Act
    const apply = async () => tool("apply_edit").run(ctx(changed, { writer, proposals }), { proposalId });
    // Assert
    await expect(apply()).rejects.toThrow(new ToolError("Nothing was written, because shop.sysml changed after the proposal. Call propose_edit again."));
    expect(written).toEqual([]);
  });

  it("提案のあとにファイルが消えていたら、書かずに断る（異常系）", async () => {
    // Arrange
    const { written, writer } = recorder();
    const proposals = memoryProposals();
    const { proposalId } = tool("propose_edit").run(ctx(project, { proposals }), { type: "rename", element: "Shop::Cart", name: "X" }) as { proposalId: string };
    const removed: ProjectInput = { ...project, files: [{ path: "parts.sysml", text: "" }] };
    // Act
    const apply = async () => tool("apply_edit").run(ctx(removed, { writer, proposals }), { proposalId });
    // Assert
    await expect(apply()).rejects.toThrow(ToolError);
    expect(written).toEqual([]);
  });

  it("何も変わらない提案は、ID を付けず、覚えない（境界値）", () => {
    // Act
    const got = tool("propose_edit").run(ctx(), { type: "rename", element: "Shop::Cart", name: "same" });
    // Assert
    expect(got).toEqual({ changes: [], problems: [problem("shop.sysml", "after")] });
  });

  it("コアが断った理由を、失敗の文として伝える。知らない ID・ID なしの書き込みも断る（異常系）", async () => {
    // Act
    const refused = () => tool("propose_edit").run(ctx(), { type: "rename", element: "Nope", name: "X" });
    const unknownId = async () => tool("apply_edit").run(ctx(), { proposalId: "nope" });
    const noId = async () => tool("apply_edit").run(ctx(), {});
    // Assert
    expect(refused).toThrow(new ToolError("The edit was refused: 見つかりません"));
    await expect(unknownId()).rejects.toThrow(ToolError);
    await expect(noId()).rejects.toThrow(ToolError);
  });
});

describe("export_diagram", () => {
  it("F-AI-3: テキストに書いた図は、修飾名からファイルと名前を引いて書き出す（正常系）", () => {
    // Act
    const request = diagramRequest(core, project, { format: "svg", diagram: "Shop::v" });
    const got = tool("export_diagram").run(ctx(), { format: "drawio", diagram: "Shop::v" });
    // Assert
    expect(request).toEqual({ file: "shop.sysml", view: "v", format: "svg" });
    expect(got).toEqual({ format: "drawio", file: "shop.sysml", content: "drawio:shop.sysml:v:-" });
  });

  it("F-AI-3: ファイルを渡すと、そのファイルの自動の図を書き出す（view を省くと all。同値分割）", () => {
    // Act
    const byDefault = diagramRequest(core, project, { format: "svg", file: "shop.sysml" });
    const chosen = diagramRequest(core, project, { format: "svg", file: "shop.sysml", view: "structure" });
    // Assert
    expect(byDefault).toEqual({ file: "shop.sysml", auto: "all", format: "svg" });
    expect(chosen).toEqual({ file: "shop.sysml", auto: "structure", format: "svg" });
  });

  it("形式が違う・形式なし・diagram と file の両方・どちらも無し・diagram に view・無い図は、理由つきで失敗を伝える（異常系）", () => {
    // Act
    const run = (args: Record<string, string>) => () => diagramRequest(core, project, args);
    // Assert
    expect(run({ format: "png", file: "shop.sysml" })).toThrow(new ToolError('Unknown format "png". Use svg or drawio.'));
    expect(run({ file: "shop.sysml" })).toThrow(new ToolError('Unknown format "". Use svg or drawio.'));
    expect(run({ format: "svg", diagram: "Shop::v", file: "shop.sysml" })).toThrow(new ToolError("Give either diagram or file, not both."));
    expect(run({ format: "svg" })).toThrow(new ToolError("Give either diagram or file, not both."));
    expect(run({ format: "svg", diagram: "Shop::v", view: "all" })).toThrow(new ToolError("view is only used with file."));
    expect(run({ format: "svg", diagram: "Shop::gone" })).toThrow(new ToolError('No diagram named "Shop::gone" was found. Use list_diagrams to see the qualified names.'));
  });

  it("図を書き出す口が断った理由を、失敗の文として伝える（異常系）", () => {
    // Arrange（図の一覧にはあるが、書き出す口が見つけられない）
    const withNope: Core = { ...core, outline: (files) => ({ ...core.outline(files), diagrams: [{ name: "nope", qualifiedName: "Shop::nope", kind: "GeneralView", file: "shop.sysml", range: RANGE }] }) };
    // Act
    const run = () => tool("export_diagram").run(ctx(project, { core: withNope }), { format: "svg", diagram: "Shop::nope" });
    // Assert
    expect(run).toThrow(new ToolError("The diagram was not found."));
  });
});
