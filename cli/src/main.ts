#!/usr/bin/env node
// 入口（部品をつなぐだけ）。
//   modelith mcp <フォルダ>            標準入出力の MCP のサーバを動かす（要求 F-AI-1・F-AI-2・F-AI-3、ADR-0024）
//   modelith export <フォルダ> …       図を書き出す（要求 F-AI-3）
// 標準出力は MCP のやり取りと、書き出した図に使うので、知らせはすべて標準エラーに出す。

import { stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { parseArgs, USAGE } from "./cli.ts";
import { fsProjectReader, fsProjectWriter } from "./fs-project.ts";
import { callTool, createServer } from "./mcp-server.ts";
import { memoryProposals } from "./proposals.ts";
import { TOOLS, toolsFor } from "./tools.ts";
import { loadRasterizer } from "./raster.ts";
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

const core = loadWasmCore();
// 版はコアから取る（本体・コア・このパッケージは同じ版。ビルドした形でも、ファイルの置き場所に頼らずに済む）
const version = core.version();
const deps = {
  core,
  reader: fsProjectReader(folder),
  writer: fsProjectWriter(folder),
  proposals: memoryProposals(),
  renderer: loadWebRenderer(),
  rasterizer: loadRasterizer(),
};

if (command.kind === "export") {
  // MCP の道具と同じ道を通す（引数の確かめ方と、失敗の文を同じにする）
  const tool = TOOLS.find((t) => t.name === "export_diagram");
  if (!tool) throw new Error("export_diagram is missing");
  const result = await callTool(tool, deps, command.args);
  const [first, image] = result.content;
  const text = first?.type === "text" ? first.text : "";
  if (result.isError) {
    console.error(text);
    process.exit(1);
  }
  const { content, layoutProblem, missingCharacters } = JSON.parse(text) as { content?: string; layoutProblem?: string; missingCharacters?: string };
  if (layoutProblem) console.error(`The saved layout could not be read, so the diagram is laid out automatically (${layoutProblem}).`);
  if (missingCharacters) console.error(`These characters are not in the fonts that come with Modelith, so they are missing from the image: ${missingCharacters}`);
  // 画像（PNG）は、道具が base64 で返したものを、もとのバイト列に戻して書く
  const output = image?.type === "image" ? Buffer.from(image.data, "base64") : (content ?? "");
  // 受け手が途中で読むのをやめたとき（`| head` など）は、例外にせずに終わる
  process.stdout.on("error", (e: NodeJS.ErrnoException) => {
    if (e.code === "EPIPE") process.exit(0);
    throw e;
  });
  if (command.out === undefined) process.stdout.write(output);
  else await writeFile(command.out, output);
} else {
  const server = createServer(toolsFor(command.direct), { ...deps, version });
  await server.connect(new StdioServerTransport());
  console.error(`Modelith MCP server ${version} is reading "${folder}".`);
  if (command.direct) console.error("Started with --write-directly: the edit tool writes changes to the model files without a separate confirmation.");
}
