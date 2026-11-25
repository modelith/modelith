// コマンドラインの引数を読む（判断だけ。I/O は main.ts）。

/** 読んだコマンド。 */
export type Command =
  | { kind: "mcp"; folder: string; direct: boolean }
  | { kind: "export"; folder: string; args: Record<string, string>; out?: string }
  | { kind: "usage"; error?: string };

/** 使い方（標準エラーに出す）。 */
export const USAGE = [
  "Usage: modelith mcp <project folder> [--write-directly]",
  "",
  "Starts an MCP server on standard input and output. AI clients can read and check the SysML v2 model",
  "in the project folder (list_files, list_elements, get_element, list_diagrams, list_problems), and change it",
  "in two steps: propose_edit returns the changes without writing, and apply_edit writes a proposal.",
  "Only files inside the project folder are read, and only its model files are written.",
  "With --write-directly, the server also offers edit, which makes a change and writes it in one step.",
  "",
  "Usage: modelith export <project folder> --format <svg|drawio> (--diagram <qualified name> | --subject <qualified name> | --file <model file> [--view <view>]) [--out <file>]",
  "",
  "Draws a diagram the same way as the Modelith app and prints it, or writes it to the file given with --out.",
  "--diagram names a diagram written in the model (for example Shop::overview). --subject names a part def, state def, action def or",
  "occurrence def, and draws its internal block, state machine, activity or sequence diagram. --file gives an automatic diagram of a model file",
  "(--view all, structure, trace, control or behavior; default all).",
].join("\n");

/**
 * コマンドラインの引数を読む。
 *
 * @param args 引数（node とスクリプトの名前を除いたもの）
 * @returns `mcp <フォルダ>`・`export <フォルダ> --名前 値 …` ならそのコマンド。ほかは使い方（誤りなら理由つき）
 * @example
 * parseArgs(["mcp", "./kettle"]) // → { kind: "mcp", folder: "./kettle" }
 * parseArgs(["--help"])          // → { kind: "usage" }
 * parseArgs(["export", "./kettle", "--format", "svg", "--file", "a.sysml", "--out", "a.svg"])
 * // → { kind: "export", folder: "./kettle", args: { format: "svg", file: "a.sysml" }, out: "a.svg" }
 * parseArgs(["mcp"])             // → { kind: "usage", error: "The project folder is missing." }
 * parseArgs(["check", "x"])      // → { kind: "usage", error: "Unknown command \"check\"." }
 */
export function parseArgs(args: string[]): Command {
  const [command, folder, ...rest] = args;
  if (command === undefined || command === "--help" || command === "-h") return { kind: "usage" };
  if (command !== "mcp" && command !== "export") return { kind: "usage", error: `Unknown command "${command}".` };
  if (folder === undefined || folder.startsWith("--")) return { kind: "usage", error: "The project folder is missing." };
  if (command === "mcp") return mcpCommand(folder, rest);
  const options = exportOptions(rest);
  if (typeof options === "string") return { kind: "usage", error: options };
  const { out, ...toolArgs } = options;
  return out === undefined ? { kind: "export", folder, args: toolArgs } : { kind: "export", folder, args: toolArgs, out };
}

/** export のオプションの名前。 */
const EXPORT_OPTIONS = ["format", "diagram", "subject", "file", "view", "out"];

/**
 * export のオプション（`--名前 値` の並び）を読む。
 *
 * @param rest フォルダのあとの引数
 * @returns 名前 → 値。知らない名前・値の無いオプション・同じ名前が 2 回あるときは、理由の文
 * @example
 * exportOptions(["--format", "svg", "--file", "a.sysml"]) // → { format: "svg", file: "a.sysml" }
 * exportOptions(["--format"])                             // → "--format needs a value."
 * exportOptions(["--colour", "red"])                      // → "Unknown option \"--colour\"."
 */
export function exportOptions(rest: string[]): Record<string, string> | string {
  const options: Record<string, string> = {};
  for (let i = 0; i < rest.length; i += 2) {
    const flag = rest[i] ?? "";
    const name = flag.slice(2);
    if (!flag.startsWith("--") || !EXPORT_OPTIONS.includes(name)) return `Unknown option "${flag}".`;
    const value = rest[i + 1];
    if (value === undefined) return `${flag} needs a value.`;
    if (Object.hasOwn(options, name)) return `${flag} is given twice.`;
    options[name] = value;
  }
  return options;
}

/** `modelith mcp` の、確かめずに書く設定の指定（ADR-0024 の 4）。 */
const WRITE_DIRECTLY = "--write-directly";

/**
 * `modelith mcp <フォルダ>` の残りの引数を読む。
 *
 * @param folder プロジェクトのフォルダ
 * @param rest フォルダの後ろの引数
 * @returns MCP のサーバを動かす指定。知らない引数・同じ指定の繰り返しがあれば、理由を付けた使い方の表示
 * @example
 * mcpCommand("proj", [])                    // → { kind: "mcp", folder: "proj", direct: false }
 * mcpCommand("proj", ["--write-directly"])  // → { kind: "mcp", folder: "proj", direct: true }
 * mcpCommand("proj", ["--nope"])            // → { kind: "usage", error: "Unknown option \"--nope\"." }
 * mcpCommand("proj", ["extra"])             // → { kind: "usage", error: "Too many arguments." }
 */
export function mcpCommand(folder: string, rest: string[]): Command {
  const unknown = rest.find((a) => a !== WRITE_DIRECTLY);
  if (unknown !== undefined) return { kind: "usage", error: unknown.startsWith("--") ? `Unknown option "${unknown}".` : "Too many arguments." };
  if (rest.length > 1) return { kind: "usage", error: `${WRITE_DIRECTLY} is given twice.` };
  return { kind: "mcp", folder, direct: rest.length === 1 };
}
