// MCP のサーバの結合テスト（F-AI-1）。公式ライブラリのクライアントをメモリ上でつなぎ、本物のコア（wasm）と一時フォルダのプロジェクトで、
// AI のクライアントから見える形（道具の一覧・結果・失敗）を確かめる。
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ElementDetail, ElementSummary, ProblemReport } from "./core.ts";
import { fsProjectReader } from "./fs-project.ts";
import { callTool, createServer } from "./mcp-server.ts";
import { TOOLS } from "./tools.ts";
import { loadWasmCore, parseResult } from "./wasm-core.ts";

const core = loadWasmCore();
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
  const server = createServer(TOOLS, { core, reader: fsProjectReader(folder), version: "0.0.0-test" });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test", version: "0" });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
});

afterEach(async () => {
  await client.close();
  rmSync(folder, { recursive: true, force: true });
});

describe("MCP のサーバ", () => {
  it("F-AI-1: 読むだけの道具を、説明と引数の形つきで一覧に出す（正常系）", async () => {
    // Act
    const { tools } = await client.listTools();
    // Assert
    expect(tools.map((t) => t.name)).toEqual(["list_files", "list_elements", "get_element", "list_diagrams", "list_problems"]);
    expect(tools.every((t) => t.annotations?.readOnlyHint === true && t.description)).toBe(true);
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
    expect(got.text).toMatch(/^The project could not be read \(.*ENOENT.*\)\.$/);
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
    const got = await callTool(TOOLS[0]!, { core, reader }, {});
    // Assert
    expect(got).toEqual({ isError: true, content: [{ type: "text", text: "The project could not be read (permission denied)." }] });
  });
});
