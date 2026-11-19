// 入口（部品をつなぐだけ）。`modelith mcp <フォルダ>` で、標準入出力の MCP のサーバを動かす（要求 F-AI-1、ADR-0024）。
// 標準出力は MCP のやり取りに使うので、知らせはすべて標準エラーに出す。

import { readFileSync } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { parseArgs, USAGE } from "./cli.ts";
import { fsProjectReader } from "./fs-project.ts";
import { createServer } from "./mcp-server.ts";
import { TOOLS } from "./tools.ts";
import { loadWasmCore } from "./wasm-core.ts";

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
const server = createServer(TOOLS, { core: loadWasmCore(), reader: fsProjectReader(folder), version });
await server.connect(new StdioServerTransport());
console.error(`Modelith MCP server ${version} is reading "${folder}".`);
