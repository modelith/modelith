// 道具（tools.ts）を MCP のサーバとして出す。MCP の公式ライブラリ（@modelcontextprotocol/sdk）と zod に触れるのはこのファイルだけ
// （メンテナの判断、2026-11-19：やり取りは公式ライブラリに任せ、差し替えられるように 1 か所に閉じ込める）。

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Core, ProjectReader, ProjectWriter, ProposalStore, Renderer } from "./core.ts";
import { ToolError, type Tool, type ToolParam } from "./tools.ts";

/** サーバが使うもの（外から渡す）。 */
export interface ServerDeps {
  /** コアの読む操作。 */
  core: Core;
  /** プロジェクトを読む口。 */
  reader: ProjectReader;
  /** プロジェクトに書く口。 */
  writer: ProjectWriter;
  /** 提案を覚えておく口。 */
  proposals: ProposalStore;
  /** 図を書き出す口。 */
  renderer: Renderer;
  /** AI のクライアントに名乗る版。 */
  version: string;
}

/** 道具の結果（MCP の tools/call の結果のうち、使うものだけ）。 */
export type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

/**
 * 道具の引数の説明を、ライブラリの形（zod）にする。
 *
 * @param params 引数（名前 → 説明）
 * @returns 名前 → zod の型（どれも文字列。省ける引数は optional）
 * @example
 * inputShape({ file: { description: "…" } }).file.isOptional() // → true
 */
function inputShape(params: Record<string, ToolParam>): Record<string, z.ZodType<string | undefined>> {
  return Object.fromEntries(
    Object.entries(params).map(([name, p]) => {
      const text = z.string().describe(p.description);
      return [name, p.required ? text : text.optional()];
    }),
  );
}

/**
 * 道具を 1 回動かす。呼ぶたびにプロジェクトを読み直し、結果を JSON の文にする。失敗は例外にせず、AI のクライアントに文で返す。
 *
 * @param tool 道具
 * @param deps コア・プロジェクトを読む口・書く口・提案を覚えておく口・図を書き出す口
 * @param args 道具の引数
 * @returns 結果（JSON の文）。失敗なら isError を立て、理由の文を入れる
 * @example
 * await callTool(listFiles, deps, {})                    // → { content: [{ type: "text", text: "[{\"path\":\"a.sysml\"}]" }] }
 * await callTool(getElement, deps, { qualifiedName: "X" }) // → { isError: true, content: [{ type: "text", text: "No element named \"X\" was found. …" }] }
 */
export async function callTool(
  tool: Tool, deps: Omit<ServerDeps, "version">, args: Record<string, string | undefined>,
): Promise<ToolResult> {
  try {
    const { core, writer, proposals, renderer } = deps;
    const result = await tool.run({ core, project: await deps.reader.read(), writer, proposals, renderer }, args);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    const text = e instanceof ToolError ? reason : `The project could not be read or written (${reason}).`;
    return { isError: true, content: [{ type: "text", text }] };
  }
}

/**
 * 道具を登録した MCP のサーバを作る（つなぐ先は、呼ぶ側が connect で決める）。
 *
 * @param tools 出す道具
 * @param deps コア・プロジェクトを読む口と書く口・提案を覚えておく口・図を書き出す口・版
 * @returns MCP のサーバ
 * @example
 * await createServer(TOOLS, { core, reader, version: "0.3.0" }).connect(new StdioServerTransport())
 */
export function createServer(tools: Tool[], deps: ServerDeps): McpServer {
  const server = new McpServer({ name: "modelith", version: deps.version });
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: inputShape(tool.params),
        // 書く道具は apply_edit だけ。どの道具も、プロジェクトのフォルダの外には触れない
        annotations: tool.writes
          ? { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false }
          : { readOnlyHint: true, openWorldHint: false },
      },
      (args: Record<string, string | undefined>) => callTool(tool, deps, args),
    );
  }
  return server;
}
