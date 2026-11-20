// AI のクライアントに出す道具（要求 F-AI-1：読む・確かめる、F-AI-2：書く）。
// 書くのは 2 段階（メンテナの判断、2026-11-20）：propose_edit は何も書かずに差分を返し、apply_edit がその提案を書き込む。
// ここは判断だけを持つ（I/O・MCP のライブラリ・wasm に頼らない）。コア・プロジェクト・書く口・提案を覚える口は引数で受け取る。
// 説明の文は AI のクライアントが読むので、英語で書く（ADR-0027：元の言語は英語）。

import {
  Refused, type Core, type EditRequest, type ProblemReport, type ProjectInput, type ProjectWriter, type ProposalStore,
} from "./core.ts";
import { applyEdits, versionOf } from "./edits.ts";

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
  /** ファイルを書き換える道具なら true（省いたら、読むだけ）。 */
  writes?: boolean;
  /** 道具を動かす。結果は JSON にできる値。利用者に伝える失敗は ToolError を投げる。 */
  run(ctx: ToolContext, args: Record<string, string | undefined>): unknown;
}

/** 道具が使うもの（道具を呼ぶたびに作る）。 */
export interface ToolContext {
  /** コアの操作。 */
  core: Core;
  /** 今読んだプロジェクト。 */
  project: ProjectInput;
  /** プロジェクトに書く口。 */
  writer: ProjectWriter;
  /** 提案を覚えておく口。 */
  proposals: ProposalStore;
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
    run: ({ core, project }) => core.outline(project.files).files,
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
    run: ({ core, project }, args) =>
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
    run: ({ core, project }, args) => {
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
    run: ({ core, project }) => core.outline(project.files).diagrams,
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
    run: ({ core, project }, args) =>
      [...unreadableReports(project), ...core.problems(project)].filter((p) => matches(p.file, args.file)),
  },
  {
    name: "propose_edit",
    title: "Propose an edit",
    description:
      "Propose one change to the model without writing anything. Returns a proposalId, the text edits per file (changes), and the problems the project would have after the change. " +
      "Show the changes to the user, then call apply_edit with the proposalId to write them. Elements are named by qualified name (see list_elements). " +
      "Set type to one of: addElement (kind, name, parent), addRelation (kind, from, to), rename (element, name), delete (element), setDoc (element, doc), replaceText (file, text). " +
      "A rename does not yet update references in other files; check the returned problems.",
    params: {
      type: { description: "The kind of change: addElement, addRelation, rename, delete, setDoc or replaceText.", required: true },
      kind: { description: "addElement: the element kind, for example \"part def\" or \"attribute\". addRelation: satisfy, verify, frame, derivation, composition or flow." },
      name: { description: "addElement and rename: the (new) name." },
      parent: { description: "addElement: the qualified name of the element to add into, usually a package." },
      from: { description: "addRelation: the qualified name of the element the relation goes out of (for satisfy, the element that satisfies)." },
      to: { description: "addRelation: the qualified name of the element the relation goes into (for satisfy, the requirement)." },
      element: { description: "rename, delete and setDoc: the qualified name of the element." },
      doc: { description: "setDoc: the documentation text. An empty text removes the documentation." },
      file: { description: "replaceText: the path of an existing model file (from list_files)." },
      text: { description: "replaceText: the whole new text of the file." },
    },
    run: ({ core, project, proposals }, args) => {
      const proposal = propose(core, project, editRequest(args));
      const files = proposal.changes.map((change) => ({
        path: change.file,
        baseVersion: change.baseVersion,
        text: applyEdits(textOf(project, change.file), change.edits),
      }));
      // 何も変わらない提案は、書き込むものが無いので覚えない
      return files.length ? { proposalId: proposals.add({ files }), ...proposal } : proposal;
    },
  },
  {
    name: "apply_edit",
    title: "Apply a proposed edit",
    description:
      "Write the changes of a proposal made by propose_edit to the model files. Only call this after the user has seen the changes. " +
      "Nothing is written if any of the files changed after the proposal; propose the edit again in that case. A proposal can be applied once. " +
      "Returns the written files and the problems of the project after writing.",
    params: {
      proposalId: { description: "The proposalId returned by propose_edit.", required: true },
    },
    writes: true,
    run: async ({ core, project, writer, proposals }, args) => {
      const pending = proposals.take(args.proposalId ?? "");
      if (!pending) {
        throw new ToolError("This proposal was not found. It may have been applied already. Call propose_edit again.");
      }
      // 1 つでも変わっていたら、どれも書かない（途中まで書いた状態にしない）
      const changed = pending.files.filter((f) => versionOf(textOf(project, f.path)) !== f.baseVersion).map((f) => f.path);
      if (changed.length) {
        throw new ToolError(`Nothing was written, because ${changed.join(", ")} changed after the proposal. Call propose_edit again.`);
      }
      for (const f of pending.files) await writer.write(f.path, f.text);
      const written = new Map(pending.files.map((f) => [f.path, f.text]));
      const after = { ...project, files: project.files.map((f) => ({ ...f, text: written.get(f.path) ?? f.text })) };
      return { written: pending.files.map((f) => f.path), problems: [...unreadableReports(after), ...core.problems(after)] };
    },
  },
];

/** 編集の意図の種類ごとの、要る引数。 */
const REQUEST_FIELDS: Record<EditRequest["type"], string[]> = {
  addElement: ["kind", "name", "parent"],
  addRelation: ["kind", "from", "to"],
  rename: ["element", "name"],
  delete: ["element"],
  setDoc: ["element", "doc"],
  replaceText: ["file", "text"],
};

/**
 * 道具の引数から、契約の編集の意図を作る。
 *
 * @param args propose_edit の引数
 * @returns 編集の意図。種類が違う・要る引数が無いときは、何が足りないかを書いた ToolError を投げる
 * @example
 * editRequest({ type: "rename", element: "P::A", name: "B" }) // → { type: "rename", element: "P::A", name: "B" }
 * editRequest({ type: "rename", element: "P::A" })            // → ToolError("rename needs name.") を投げる
 * editRequest({ type: "explode" })                            // → ToolError("Unknown type \"explode\". …") を投げる
 */
export function editRequest(args: Record<string, string | undefined>): EditRequest {
  const type = args.type ?? "";
  if (!Object.hasOwn(REQUEST_FIELDS, type)) {
    throw new ToolError(`Unknown type "${type}". Use one of: ${Object.keys(REQUEST_FIELDS).join(", ")}.`);
  }
  const fields = REQUEST_FIELDS[type as EditRequest["type"]];
  const missing = fields.filter((f) => args[f] === undefined);
  if (missing.length) throw new ToolError(`${type} needs ${missing.join(" and ")}.`);
  return { type, ...Object.fromEntries(fields.map((f) => [f, args[f]])) } as EditRequest;
}

/**
 * コアに提案を作らせる。コアが断った理由は、AI のクライアントに伝える失敗（ToolError）にする。
 *
 * @param core コアの操作
 * @param project 今読んだプロジェクト
 * @param request 編集の意図
 * @returns 提案（差分と、当てたあとの問題一覧）。断られたら、理由を書いた ToolError を投げる
 * @example
 * propose(core, project, { type: "delete", element: "P::Nope" }) // → ToolError("The edit was refused: 操作する要素「P::Nope」が見つかりません。…") を投げる
 */
function propose(core: Core, project: ProjectInput, request: EditRequest): ReturnType<Core["propose"]> {
  try {
    return core.propose(project, request);
  } catch (e) {
    if (e instanceof Refused) throw new ToolError(`The edit was refused: ${e.message}`);
    throw e;
  }
}

/**
 * プロジェクトのモデルのファイルの、今のテキストを返す。
 *
 * @param project 今読んだプロジェクト
 * @param path プロジェクトのフォルダからのパス
 * @returns テキスト。そのファイルが無い（消された・読めなくなった）ときは、そのことを書いた ToolError を投げる
 * @example
 * textOf({ files: [{ path: "a.sysml", text: "package P;" }], … }, "a.sysml") // → "package P;"
 * textOf({ files: [], … }, "a.sysml") // → ToolError("The file a.sysml was not found. …") を投げる
 */
function textOf(project: ProjectInput, path: string): string {
  const file = project.files.find((f) => f.path === path);
  if (!file) throw new ToolError(`The file ${path} was not found. It may have been removed. Call propose_edit again.`);
  return file.text;
}
