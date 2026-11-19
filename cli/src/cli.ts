// コマンドラインの引数を読む（判断だけ。I/O は main.ts）。

/** 読んだコマンド。 */
export type Command =
  | { kind: "mcp"; folder: string }
  | { kind: "usage"; error?: string };

/** 使い方（標準エラーに出す）。 */
export const USAGE = [
  "Usage: modelith mcp <project folder>",
  "",
  "Starts an MCP server on standard input and output. AI clients can read and check the SysML v2 model",
  "in the project folder (list_files, list_elements, get_element, list_diagrams, list_problems).",
  "Only files inside the project folder are read. Nothing is written.",
].join("\n");

/**
 * コマンドラインの引数を読む。
 *
 * @param args 引数（node とスクリプトの名前を除いたもの）
 * @returns `mcp <フォルダ>` ならそのコマンド。ほかは使い方（誤りなら理由つき）
 * @example
 * parseArgs(["mcp", "./kettle"]) // → { kind: "mcp", folder: "./kettle" }
 * parseArgs(["--help"])          // → { kind: "usage" }
 * parseArgs(["mcp"])             // → { kind: "usage", error: "The project folder is missing." }
 * parseArgs(["check", "x"])      // → { kind: "usage", error: "Unknown command \"check\"." }
 */
export function parseArgs(args: string[]): Command {
  const [command, folder, ...rest] = args;
  if (command === undefined || command === "--help" || command === "-h") return { kind: "usage" };
  if (command !== "mcp") return { kind: "usage", error: `Unknown command "${command}".` };
  if (folder === undefined) return { kind: "usage", error: "The project folder is missing." };
  if (rest.length) return { kind: "usage", error: "Too many arguments." };
  return { kind: "mcp", folder };
}
