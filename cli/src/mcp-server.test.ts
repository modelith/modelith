// MCP のサーバの結合テスト（F-AI-1・F-AI-2・F-AI-3）。公式ライブラリのクライアントをメモリ上でつなぎ、本物のコア（wasm）と一時フォルダのプロジェクトで、
// AI のクライアントから見える形（道具の一覧・結果・失敗）を確かめる。
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { EditProposal, ElementDetail, ElementSummary, ProblemReport } from "./core.ts";
import { fsProjectReader, fsProjectWriter } from "./fs-project.ts";
import { callTool, createServer } from "./mcp-server.ts";
import { memoryProposals } from "./proposals.ts";
import { TOOLS } from "./tools.ts";
import { loadWasmCore, parseResult } from "./wasm-core.ts";
import { loadWebRenderer } from "./web-render.ts";

const core = loadWasmCore();
const renderer = loadWebRenderer();
let folder: string;
let client: Client;

/** プロジェクトのフォルダにファイルを書く。 */
function write(path: string, text: string): void {
  mkdirSync(join(folder, path, ".."), { recursive: true });
  writeFileSync(join(folder, path), text);
}

/** 道具を呼び、失敗かどうかと、結果の文を返す。 */
async function call(name: string, args: Record<string, string> = {}): Promise<{ isError: boolean; text: string }> {
  const result = await client.callTool({ name, arguments: args });
  const content = result.content as { type: string; text: string }[];
  return { isError: result.isError === true, text: content[0]?.text ?? "" };
}

/** 道具を呼び、結果の JSON を読む。 */
async function json<T>(name: string, args: Record<string, string> = {}): Promise<T> {
  const { isError, text } = await call(name, args);
  expect(isError, text).toBe(false);
  return JSON.parse(text) as T;
}

beforeEach(async () => {
  folder = mkdtempSync(join(tmpdir(), "modelith-mcp-"));
  write("req.sysml", "package Req {\n    requirement def <'R1'> Safe { doc /* 安全であること */ }\n}\n");
  write("app/brake.sysml", "package App {\n    part def Brake { port cmd : Cmd; }\n    port def Cmd;\n    satisfy Req::Safe by Brake;\n    view overview : GeneralView { expose App::Brake; }\n    part x : Nope;\n}\n");
  const server = createServer(TOOLS, {
    core, reader: fsProjectReader(folder), writer: fsProjectWriter(folder), proposals: memoryProposals(), renderer, version: "0.0.0-test",
  });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test", version: "0" });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
});

afterEach(async () => {
  await client.close();
  rmSync(folder, { recursive: true, force: true });
});

describe("MCP のサーバ", () => {
  it("F-AI-1・F-AI-2: 道具を、説明と引数の形つきで一覧に出す。書く道具は apply_edit だけ（正常系）", async () => {
    // Act
    const { tools } = await client.listTools();
    // Assert
    expect(tools.map((t) => t.name)).toEqual([
      "list_files", "list_elements", "get_element", "list_diagrams", "list_problems", "export_diagram", "propose_edit", "apply_edit",
    ]);
    expect(tools.every((t) => t.description)).toBe(true);
    expect(tools.filter((t) => t.annotations?.readOnlyHint !== true).map((t) => [t.name, t.annotations?.destructiveHint])).toEqual([["apply_edit", true]]);
    const getElement = tools.find((t) => t.name === "get_element");
    expect(getElement?.inputSchema.required).toEqual(["qualifiedName"]);
    expect(Object.keys(tools.find((t) => t.name === "list_elements")?.inputSchema.properties ?? {})).toEqual(["file", "kind"]);
  });

  it("F-AI-1: ファイル一覧・要素の一覧（種類・修飾名・位置）・図の一覧を得られる（正常系）", async () => {
    // Act
    const files = await json<{ path: string }[]>("list_files");
    const partDefs = await json<ElementSummary[]>("list_elements", { kind: "part def" });
    const inReq = await json<ElementSummary[]>("list_elements", { file: "req.sysml" });
    const diagrams = await json<{ qualifiedName: string; kind: string }[]>("list_diagrams");
    // Assert
    expect(files).toEqual([{ path: "app/brake.sysml" }, { path: "req.sysml" }]);
    expect(partDefs).toEqual([{
      qualifiedName: "App::Brake", name: "Brake", kind: "part def", file: "app/brake.sysml",
      range: { start: { line: 1, character: 4 }, end: { line: 1, character: 38 } },
    }]);
    expect(inReq.map((e) => [e.qualifiedName, e.shortName])).toEqual([["Req", undefined], ["Req::Safe", "R1"]]);
    expect(diagrams.map((d) => [d.qualifiedName, d.kind])).toEqual([["App::overview", "GeneralView"]]);
  });

  it("F-AI-1: 要素の中身（説明・直下の要素・ポート・ほかのファイルとの関係）を得られる（正常系）", async () => {
    // Act
    const brake = await json<ElementDetail>("get_element", { qualifiedName: "App::Brake" });
    const safe = await json<ElementDetail>("get_element", { qualifiedName: "Req::Safe" });
    // Assert
    expect(brake.members.map((m) => m.qualifiedName)).toEqual(["App::Brake::cmd"]);
    expect(brake.ports).toEqual([{ name: "cmd", type: "Cmd", direction: "inout" }]);
    expect(brake.relations).toContainEqual({ kind: "satisfy", direction: "outgoing", other: "Req::Safe" });
    expect(safe.doc).toBe("安全であること");
    expect(safe.relations).toContainEqual({ kind: "satisfy", direction: "incoming", other: "App::Brake" });
  });

  it("F-AI-1: 問題一覧（チェックルールの結果を含む）を得られ、ファイルでしぼれる（正常系）", async () => {
    // Arrange（部品定義に説明を求めるルールのプラグインを、プロジェクトで有効にする）
    write("modelith.json", '{ "plugins": { "jp.example.rules": {} } }');
    write(".modelith/plugins/jp.example.rules/modelith-plugin.json",
      '{ "id": "jp.example.rules", "name": "例", "version": "0.1.0", "apiVersion": "0", "runtime": "rules", "license": "MIT", "contributes": { "rules": ["rules.yaml"] } }');
    write(".modelith/plugins/jp.example.rules/rules.yaml",
      'rules:\n  - id: needs-satisfy\n    severity: warning\n    message: "{kind}「{name}」は要求を満たしていません"\n    match:\n      kind: port def\n    require:\n      outgoing: satisfy\n');
    // Act
    const all = await json<ProblemReport[]>("list_problems");
    const inReq = await json<ProblemReport[]>("list_problems", { file: "req.sysml" });
    // Assert
    expect(all.map((p) => [p.file, p.diagnostic.severity, p.diagnostic.message, p.diagnostic.code, p.diagnostic.source])).toEqual([
      ["app/brake.sysml", "error", "型「Nope」が見つかりません（x）", undefined, "modelith"],
      ["app/brake.sysml", "warning", "port def「Cmd」は要求を満たしていません", "needs-satisfy", "jp.example.rules"],
    ]);
    expect(all[0]?.diagnostic.range.start).toEqual({ line: 5, character: 4 });
    expect(inReq).toEqual([]);
  });

  it("道具を呼ぶたびにフォルダを読み直すので、ほかのアプリでの変更がその場で見える（正常系）", async () => {
    // Arrange
    const before = await json<ProblemReport[]>("list_problems");
    // Act（問題のあるファイルを、問題の無い中身に書き換える）
    write("app/brake.sysml", "package App {\n    part def Brake;\n}\n");
    const after = await json<ProblemReport[]>("list_problems");
    // Assert
    expect([before.length, after.length]).toEqual([1, 0]);
  });

  it("要素が無いときは、例外で切らずに、失敗の文を返す（異常系）", async () => {
    // Act
    const got = await call("get_element", { qualifiedName: "App::Missing" });
    // Assert
    expect(got).toEqual({
      isError: true,
      text: 'No element named "App::Missing" was found. Use list_elements to see the qualified names.',
    });
  });

  it("必須の引数が無い・知らない道具は、失敗として返す（異常系）", async () => {
    // Act
    const noName = await call("get_element");
    const unknown = await call("delete_everything");
    // Assert
    expect([noName.isError, unknown.isError]).toEqual([true, true]);
  });

  it("フォルダが読めなくなったら、理由つきの失敗の文を返す（異常系）", async () => {
    // Arrange
    rmSync(folder, { recursive: true, force: true });
    // Act
    const got = await call("list_files");
    // Assert
    expect(got.isError).toBe(true);
    expect(got.text).toMatch(/^The project could not be read or written \(.*ENOENT.*\)\.$/);
  });
});

describe("MCP のサーバ：書く（2 段階）", () => {
  /** ファイルの今の中身を読む。 */
  const read = (path: string): string => readFileSync(join(folder, path), "utf8");

  it("F-AI-2: 提案は何も書かず、差分と当てたあとの問題一覧を返す。書き込むと、提案の中身がファイルに入る（正常系）", async () => {
    // Arrange
    const before = read("app/brake.sysml");
    // Act（見つからない型 Nope を、定義として足す）
    const proposal = await json<EditProposal & { proposalId: string }>("propose_edit", { type: "addElement", kind: "part def", name: "Nope", parent: "App" });
    const afterPropose = read("app/brake.sysml");
    const applied = await json<{ written: string[]; problems: ProblemReport[] }>("apply_edit", { proposalId: proposal.proposalId });
    // Assert
    expect(afterPropose).toBe(before);
    expect(proposal.changes.map((c) => c.file)).toEqual(["app/brake.sysml"]);
    expect(proposal.changes[0]?.edits.map((e) => e.newText).join("")).toContain("part def Nope;");
    expect(proposal.problems).toEqual([]);
    expect(applied).toEqual({ written: ["app/brake.sysml"], problems: [] });
    expect(read("app/brake.sysml")).toBe(before.replace("    part x : Nope;\n", "    part x : Nope;\n    part def Nope;\n"));
  });

  it("F-AI-2: 要素を修飾名で指して、名前の変更・説明・関係の追加・削除を提案できる（正常系）", async () => {
    // Act
    const rename = await json<EditProposal>("propose_edit", { type: "rename", element: "App::Brake", name: "DiscBrake" });
    const doc = await json<EditProposal>("propose_edit", { type: "setDoc", element: "App::Cmd", doc: "指令" });
    const relation = await json<EditProposal>("propose_edit", { type: "addRelation", kind: "satisfy", from: "App::x", to: "Req::Safe" });
    const remove = await json<EditProposal>("propose_edit", { type: "delete", element: "App::x" });
    // Assert
    const texts = (p: EditProposal): string => p.changes.flatMap((c) => c.edits.map((e) => e.newText)).join("|");
    expect(texts(rename)).toContain("DiscBrake");
    expect(texts(doc)).toContain("doc /* 指令 */");
    expect(texts(relation)).toContain("satisfy");
    expect(remove.changes.map((c) => c.file)).toEqual(["app/brake.sysml"]);
    // 見つからない型を使う x を消すと、問題が無くなる
    expect(remove.problems).toEqual([]);
  });

  it("F-AI-2: 提案のあとにファイルが変わっていたら、黙って上書きせずに断り、何も書かない（異常系）", async () => {
    // Arrange
    const proposal = await json<{ proposalId: string }>("propose_edit", { type: "rename", element: "App::Brake", name: "DiscBrake" });
    const changedByOthers = "package App {\n    part def Brake;\n    part def Wheel;\n}\n";
    write("app/brake.sysml", changedByOthers);
    // Act
    const got = await call("apply_edit", { proposalId: proposal.proposalId });
    // Assert
    expect(got).toEqual({
      isError: true,
      text: "Nothing was written, because app/brake.sysml changed after the proposal. Call propose_edit again.",
    });
    expect(read("app/brake.sysml")).toBe(changedByOthers);
  });

  it("当てられない意図・足りない引数・知らない ID は、理由つきの失敗の文を返し、何も書かない（異常系）", async () => {
    // Arrange
    const before = read("app/brake.sysml");
    // Act
    const missing = await call("propose_edit", { type: "delete", element: "App::Gone" });
    const taken = await call("propose_edit", { type: "rename", element: "App::Brake", name: "Cmd" });
    const noName = await call("propose_edit", { type: "rename", element: "App::Brake" });
    const unknownId = await call("apply_edit", { proposalId: "nope" });
    // Assert
    expect(missing).toEqual({ isError: true, text: "The edit was refused: 操作する要素「App::Gone」が見つかりません。テキストが先に変わった可能性があります" });
    expect(taken).toEqual({ isError: true, text: "The edit was refused: 「Cmd」は既に使われています" });
    expect(noName).toEqual({ isError: true, text: "rename needs name." });
    expect(unknownId.isError).toBe(true);
    expect(read("app/brake.sysml")).toBe(before);
  });

  it("ファイルを丸ごと書き換える提案も、同じ 2 段階で書く（正常系）", async () => {
    // Arrange
    const text = "package Req {\n    requirement def Safe;\n    requirement def Quiet;\n}\n";
    // Act
    const proposal = await json<{ proposalId: string }>("propose_edit", { type: "replaceText", file: "req.sysml", text });
    await json("apply_edit", { proposalId: proposal.proposalId });
    // Assert
    expect(read("req.sysml")).toBe(text);
  });
});

describe("MCP のサーバ：図を書き出す", () => {
  it("F-AI-3: テキストに書いた図を、名前を指定して SVG と draw.io で書き出せる。図に出した要素だけが入る（正常系）", async () => {
    // Act（overview は App::Brake だけを出している）
    const svg = await json<{ format: string; file: string; content: string }>("export_diagram", { format: "svg", diagram: "App::overview" });
    const drawio = await json<{ content: string }>("export_diagram", { format: "drawio", diagram: "App::overview" });
    // Assert
    expect([svg.format, svg.file]).toEqual(["svg", "app/brake.sysml"]);
    expect(svg.content).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg.content).toContain("Brake");
    expect(svg.content).not.toContain("Cmd<");
    expect(drawio.content).toMatch(/^<mxfile /);
    expect(drawio.content).toContain("Brake");
  });

  it("F-AI-3: 保存した配置があれば、画面と同じくその位置に描く（正常系）", async () => {
    // Arrange（自動の図「すべて」で、Brake を (700, 300) に置いた配置ファイル）
    const auto = await json<{ content: string }>("export_diagram", { format: "svg", file: "app/brake.sysml" });
    write("app/brake.layout.json", JSON.stringify({ modelith: "layout", format: 1, views: { all: { Brake: [700, 300] } } }));
    // Act
    const placed = await json<{ content: string; layoutProblem?: string }>("export_diagram", { format: "svg", file: "app/brake.sysml" });
    // Assert
    expect(auto.content).not.toContain("translate(700,300)");
    expect(placed.content).toContain("translate(700,300)");
    expect(placed.layoutProblem).toBeUndefined();
  });

  it("配置ファイルが読めないときは、自動に並べて書き出し、理由を添える（異常系）", async () => {
    // Arrange
    write("app/brake.layout.json", "{ not json");
    // Act
    const got = await json<{ content: string; layoutProblem?: string }>("export_diagram", { format: "svg", file: "app/brake.sysml" });
    // Assert
    expect(got.content).toContain("Brake");
    expect(got.layoutProblem).toBeTruthy();
  });

  it("ほかのファイルの要素との関係も、画面と同じく描く（正常系）", async () => {
    // Act（Brake は、ほかのファイルの Req::Safe を満たす）
    const got = await json<{ content: string }>("export_diagram", { format: "svg", file: "app/brake.sysml" });
    // Assert
    expect(got.content).toContain("Safe");
    expect(got.content).toContain("satisfy");
  });

  it("無い図・無いファイル・知らない自動の図・扱わない形式は、理由つきの失敗の文を返す（異常系）", async () => {
    // Act
    const noDiagram = await call("export_diagram", { format: "svg", diagram: "App::gone" });
    const noFile = await call("export_diagram", { format: "svg", file: "nope.sysml" });
    const noView = await call("export_diagram", { format: "svg", file: "req.sysml", view: "ibd" });
    const png = await call("export_diagram", { format: "png", file: "req.sysml" });
    // Assert
    expect(noDiagram).toEqual({ isError: true, text: 'No diagram named "App::gone" was found. Use list_diagrams to see the qualified names.' });
    expect(noFile).toEqual({ isError: true, text: "The file nope.sysml was not found." });
    expect(noView).toEqual({ isError: true, text: 'Unknown view "ibd". Use one of: all, structure, trace, control, behavior.' });
    expect(png).toEqual({ isError: true, text: 'Unknown format "png". Use svg or drawio.' });
  });
});

describe("callTool・parseResult", () => {
  it("コアが入力を読めなかったときの理由を、例外にして伝える（異常系）", () => {
    // Act
    const read = () => parseResult('{"error":"ファイルの一覧を読み込めませんでした"}');
    // Assert
    expect(read).toThrow("ファイルの一覧を読み込めませんでした");
  });

  it("null と配列は、そのまま読む（境界値）", () => {
    // Act
    const got = [parseResult<null>("null"), parseResult<number[]>("[1]")];
    // Assert
    expect(got).toEqual([null, [1]]);
  });

  it("プロジェクトを読む口が失敗したら、道具を動かさずに失敗の文を返す（異常系）", async () => {
    // Arrange
    const reader = { read: () => Promise.reject(new Error("permission denied")) };
    // Act
    const got = await callTool(TOOLS[0]!, { core, reader, writer: fsProjectWriter(folder), proposals: memoryProposals(), renderer }, {});
    // Assert
    expect(got).toEqual({ isError: true, content: [{ type: "text", text: "The project could not be read or written (permission denied)." }] });
  });
});
