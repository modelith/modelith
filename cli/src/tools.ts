// AI のクライアントに出す道具（要求 F-AI-1：読む・確かめる）。どれも読むだけで、モデルを書き換えない。
// ここは判断だけを持つ（I/O・MCP のライブラリ・wasm に頼らない）。コアとプロジェクトは引数で受け取る。
// 説明の文は AI のクライアントが読むので、英語で書く（ADR-0027：元の言語は英語）。

import type { Core, ProblemReport, ProjectInput } from "./core.ts";

/** 道具の引数 1 つ（どれも文字列）。 */
export interface ToolParam {
  /** AI のクライアントに示す説明。 */
  description: string;
  /** 省けないなら true。 */
  required?: boolean;
}

/** 道具 1 つ。 */
export interface Tool {
  /** 道具の名前（MCP の tools/call の name）。 */
  name: string;
  /** 人に見せる短い名前。 */
  title: string;
  /** AI のクライアントに示す説明。 */
  description: string;
  /** 引数（名前 → 説明）。 */
  params: Record<string, ToolParam>;
  /** 道具を動かす。結果は JSON にできる値。利用者に伝える失敗は ToolError を投げる。 */
  run(core: Core, project: ProjectInput, args: Record<string, string | undefined>): unknown;
}

/** 道具が、AI のクライアントに文で伝える失敗（引数の誤り・見つからない要素）。 */
export class ToolError extends Error {}

/** 読めなかったファイルの問題の報告元（コアのモデルの問題と同じ）。 */
const SOURCE = "modelith";

/**
 * 読めなかったファイルを、問題一覧の 1 件にする（黙って飛ばさない）。
 *
 * @param project 読み込んだプロジェクト
 * @returns 読めなかったファイルごとの問題（位置はファイルの先頭、重さはエラー）
 * @example
 * unreadableReports({ files: [], unreadable: [{ path: "a.sysml", reason: "not UTF-8 text" }], pluginFiles: {} })
 * // → [{ file: "a.sysml", diagnostic: { range: 0:0–0:0, severity: "error", message: "This file could not be read (not UTF-8 text).", source: "modelith" } }]
 */
export function unreadableReports(project: ProjectInput): ProblemReport[] {
  const start = { line: 0, character: 0 };
  return project.unreadable.map((u) => ({
    file: u.path,
    diagnostic: {
      range: { start, end: start },
      severity: "error",
      message: `This file could not be read (${u.reason}).`,
      source: SOURCE,
    },
  }));
}

/**
 * 値が、絞り込みの条件に合うか（条件を省いたら、どれも合う）。
 *
 * @param value 調べる値
 * @param wanted 条件（省いたら undefined）
 * @returns 条件が無いか、値が条件と同じなら true
 * @example
 * matches("part def", undefined)   // → true
 * matches("part def", "part def")  // → true
 * matches("part def", "part")      // → false
 */
function matches(value: string, wanted: string | undefined): boolean {
  return wanted === undefined || value === wanted;
}

/** 道具の一覧（この順に AI のクライアントに示す）。 */
export const TOOLS: Tool[] = [
  {
    name: "list_files",
    title: "List model files",
    description:
      "List the SysML v2 model files (.sysml, .kerml) of the project folder. Paths are relative to the project folder.",
    params: {},
    run: (core, project) => core.outline(project.files).files,
  },
  {
    name: "list_elements",
    title: "List model elements",
    description:
      "List the named elements of the model (definitions and usages, including nested ones) with their qualified name, kind, file and position. " +
      "Use the qualified name with get_element. Positions are zero-based lines and UTF-16 columns.",
    params: {
      file: { description: "Only elements written in this file (a path from list_files)." },
      kind: { description: "Only elements of this kind, for example \"part def\", \"requirement def\" or \"package\"." },
    },
    run: (core, project, args) =>
      core.outline(project.files).elements.filter((e) => matches(e.file, args.file) && matches(e.kind, args.kind)),
  },
  {
    name: "get_element",
    title: "Get a model element",
    description:
      "Get one element by its qualified name: documentation, type, phase, direct members, ports, and relations to other elements " +
      "(for example satisfy, verify, derivation, composition, definedBy, specialize), including relations to elements of other files.",
    params: {
      qualifiedName: {
        description: "The qualified name as returned by list_elements, for example \"Shop::Cart\".",
        required: true,
      },
    },
    run: (core, project, args) => {
      const name = args.qualifiedName ?? "";
      const found = core.element(project.files, name);
      if (!found) {
        throw new ToolError(`No element named "${name}" was found. Use list_elements to see the qualified names.`);
      }
      return found;
    },
  },
  {
    name: "list_diagrams",
    title: "List diagrams",
    description:
      "List the diagrams written in the model as views, with their qualified name, kind (for example GeneralView or InterconnectionView), file and position.",
    params: {},
    run: (core, project) => core.outline(project.files).diagrams,
  },
  {
    name: "list_problems",
    title: "List problems",
    description:
      "Check the project and list its problems: syntax errors, references that cannot be found, text Modelith cannot handle yet, " +
      "gaps in requirement traceability, findings of the check rules of the project's plugins, and problems of modelith.json. " +
      "This is the same list as the problem list of the Modelith app. An empty list means no problems were found.",
    params: {
      file: { description: "Only problems of this file (a path from list_files)." },
    },
    run: (core, project, args) =>
      [...unreadableReports(project), ...core.problems(project)].filter((p) => matches(p.file, args.file)),
  },
];
