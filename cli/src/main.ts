// 入口（部品をつなぐだけ）。
//   modelith mcp <フォルダ>            標準入出力の MCP のサーバを動かす（要求 F-AI-1・F-AI-2・F-AI-3、ADR-0024）
//   modelith export <フォルダ> …       図を書き出す（要求 F-AI-3）
// 標準出力は MCP のやり取りと、書き出した図に使うので、知らせはすべて標準エラーに出す。

import { readFileSync } from "node:fs";
import { stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { parseArgs, USAGE } from "./cli.ts";
import { fsProjectReader, fsProjectWriter } from "./fs-project.ts";
import { callTool, createServer } from "./mcp-server.ts";
import { memoryProposals } from "./proposals.ts";
import { TOOLS } from "./tools.ts";
import { loadWasmCore } from "./wasm-core.ts";
import { loadWebRenderer } from "./web-render.ts";

const command = parseArgs(process.argv.slice(2));
if (command.kind === "usage") {
  if (command.error) console.error(`${command.error}\n`);
  console.error(USAGE);
  process.exit(command.error ? 2 : 0);
}

const folder = resolve(command.folder);
if (!(await stat(folder).then((s) => s.isDirectory(), () => false))) {
  console.error(`The project folder "${folder}" was not found.`);
  process.exit(2);
}

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
const deps = {
  core: loadWasmCore(),
  reader: fsProjectReader(folder),
  writer: fsProjectWriter(folder),
  proposals: memoryProposals(),
  renderer: loadWebRenderer(),
};

if (command.kind === "export") {
  // MCP の道具と同じ道を通す（引数の確かめ方と、失敗の文を同じにする）
  const tool = TOOLS.find((t) => t.name === "export_diagram");
  if (!tool) throw new Error("export_diagram is missing");
  const result = await callTool(tool, deps, command.args);
  const text = result.content[0]?.text ?? "";
  if (result.isError) {
    console.error(text);
    process.exit(1);
  }
  const { content, layoutProblem } = JSON.parse(text) as { content: string; layoutProblem?: string };
  if (layoutProblem) console.error(`The saved layout could not be read, so the diagram is laid out automatically (${layoutProblem}).`);
  if (command.out === undefined) process.stdout.write(content);
  else await writeFile(command.out, content, "utf8");
} else {
  const server = createServer(TOOLS, { ...deps, version });
  await server.connect(new StdioServerTransport());
  console.error(`Modelith MCP server ${version} is reading "${folder}".`);
}
