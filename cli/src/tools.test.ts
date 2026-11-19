// 道具の単体テスト（F-AI-1）。コアは偽物に差し替え、道具の判断（絞り込み・失敗の伝え方・読めないファイル）だけを確かめる。
import { describe, expect, it } from "vitest";
import type { Core, ElementSummary, ProblemReport, ProjectInput } from "./core.ts";
import { TOOLS, ToolError, unreadableReports, type Tool } from "./tools.ts";

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
  outline: (files) => ({
    files: files.map((f) => ({ path: f.path })),
    elements: ELEMENTS,
    diagrams: [{ name: "v", qualifiedName: "Shop::v", kind: "GeneralView", file: "shop.sysml", range: RANGE }],
  }),
  element: (_files, name) => (name === "Shop::Cart" ? { ...ELEMENTS[1]!, members: [], ports: [], relations: [] } : null),
  problems: () => [problem("shop.sysml", "a"), problem("parts.sysml", "b")],
};

const project: ProjectInput = {
  files: [{ path: "parts.sysml", text: "" }, { path: "shop.sysml", text: "" }],
  unreadable: [],
  pluginFiles: {},
};

/** 名前で道具を引く。 */
function tool(name: string): Tool {
  const found = TOOLS.find((t) => t.name === name);
  if (!found) throw new Error(`道具 ${name} がありません`);
  return found;
}

describe("道具の一覧", () => {
  it("F-AI-1: 読む・確かめるための 5 つの道具を、説明と引数つきで出す（正常系）", () => {
    // Act
    const names = TOOLS.map((t) => t.name);
    const required = TOOLS.flatMap((t) => Object.entries(t.params).filter(([, p]) => p.required).map(([n]) => `${t.name}.${n}`));
    // Assert
    expect(names).toEqual(["list_files", "list_elements", "get_element", "list_diagrams", "list_problems"]);
    expect(required).toEqual(["get_element.qualifiedName"]);
    expect(TOOLS.every((t) => t.title && t.description)).toBe(true);
  });
});

describe("list_files・list_diagrams", () => {
  it("コアの概要から、ファイルと図をそのまま返す（正常系）", () => {
    // Act
    const files = tool("list_files").run(core, project, {});
    const diagrams = tool("list_diagrams").run(core, project, {});
    // Assert
    expect(files).toEqual([{ path: "parts.sysml" }, { path: "shop.sysml" }]);
    expect(diagrams).toEqual([{ name: "v", qualifiedName: "Shop::v", kind: "GeneralView", file: "shop.sysml", range: RANGE }]);
  });
});

describe("list_elements", () => {
  it("条件を省くとすべて、ファイル・種類を渡すと合うものだけを返す（同値分割）", () => {
    // Arrange
    const run = (args: Record<string, string>) =>
      (tool("list_elements").run(core, project, args) as ElementSummary[]).map((e) => e.qualifiedName);
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
    const noFile = tool("list_elements").run(core, project, { file: "nope.sysml" });
    const partial = tool("list_elements").run(core, project, { kind: "part" });
    // Assert
    expect([noFile, partial]).toEqual([[], []]);
  });
});

describe("get_element", () => {
  it("修飾名の要素の詳細を返す（正常系）", () => {
    // Act
    const found = tool("get_element").run(core, project, { qualifiedName: "Shop::Cart" });
    // Assert
    expect(found).toMatchObject({ qualifiedName: "Shop::Cart", kind: "part def" });
  });

  it("要素が無い・名前を渡さないときは、一覧の道具を案内する文で失敗を伝える（異常系）", () => {
    // Act
    const missing = () => tool("get_element").run(core, project, { qualifiedName: "Shop::Nope" });
    const empty = () => tool("get_element").run(core, project, {});
    // Assert
    expect(missing).toThrow(new ToolError('No element named "Shop::Nope" was found. Use list_elements to see the qualified names.'));
    expect(empty).toThrow(ToolError);
  });
});

describe("list_problems", () => {
  it("コアの問題一覧を返し、ファイルを渡すとそのファイルの問題だけにする（正常系）", () => {
    // Arrange
    const run = (args: Record<string, string>) =>
      (tool("list_problems").run(core, project, args) as ProblemReport[]).map((p) => `${p.file}:${p.diagnostic.message}`);
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
    const got = tool("list_problems").run(core, withUnreadable, {}) as ProblemReport[];
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
