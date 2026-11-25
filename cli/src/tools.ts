// AI のクライアントに出す道具（要求 F-AI-1：読む・確かめる、F-AI-2：書く、F-AI-3：図を書き出す）。
// 書くのは 2 段階（メンテナの判断、2026-11-20）：propose_edit は何も書かずに差分を返し、apply_edit がその提案を書き込む。
// 確かめずに書く設定（`modelith mcp <フォルダ> --write-directly`。ADR-0024 の 4）を選んだときだけ、1 回で書く edit も出す。
// ここは判断だけを持つ（I/O・MCP のライブラリ・wasm に頼らない）。コア・プロジェクト・書く口・提案を覚える口は引数で受け取る。
// 説明の文は AI のクライアントが読むので、英語で書く（ADR-0027：元の言語は英語）。

import {
  Refused, type Core, type DiagramRequest, type EditRequest, type ProblemReport, type ProjectInput, type ProjectWriter, type ProposalStore,
  type Renderer, type SubjectView,
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
  /** 確かめずに書く設定を選んだときだけ出す道具なら true（省いたら、いつも出す）。 */
  direct?: boolean;
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
  /** 図を書き出す口。 */
  renderer: Renderer;
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

/** 編集の意図の引数（propose_edit と edit で同じ）。 */
const EDIT_PARAMS: Record<string, ToolParam> = {
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
};

/** 道具の一覧（この順に AI のクライアントに示す）。確かめずに書く設定のときだけ出す道具も含む（出す道具は toolsFor で選ぶ）。 */
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
    name: "export_diagram",
    title: "Export a diagram",
    description:
      "Draw a diagram of the model and return it as SVG or as a draw.io (diagrams.net) file, laid out the same way as in the Modelith app (saved positions are used). " +
      "Give exactly one of: diagram (a diagram written in the model, by its qualified name from list_diagrams), " +
      "subject (an element, by its qualified name: a part def gives its internal block diagram, a state def its state machine diagram, an action def its activity diagram, an occurrence def its sequence diagram), " +
      "or file (a model file, for an automatic diagram of it; view: all, structure, trace, control or behavior; default all). Nothing is written; the result has the diagram text in content.",
    params: {
      format: { description: "svg or drawio.", required: true },
      diagram: { description: "The qualified name of a diagram from list_diagrams, for example \"Shop::overview\"." },
      subject: { description: "The qualified name of a part def, state def, action def or occurrence def (from list_elements), to draw the diagram of that element." },
      file: { description: "A model file from list_files, for an automatic diagram of that file." },
      view: { description: "The automatic diagram: all (everything), structure (block definition), trace (requirement traceability), control or behavior. Default all. Only with file." },
    },
    run: ({ core, project, renderer }, args) => {
      const request = diagramRequest(core, project, args);
      try {
        return { format: request.format, file: request.file, ...renderer.render(project, request) };
      } catch (e) {
        if (e instanceof Refused) throw new ToolError(e.message);
        throw e;
      }
    },
  },
  {
    name: "propose_edit",
    title: "Propose an edit",
    description:
      "Propose one change to the model without writing anything. Returns a proposalId, the text edits per file (changes), and the problems the project would have after the change. " +
      "Show the changes to the user, then call apply_edit with the proposalId to write them. Elements are named by qualified name (see list_elements). " +
      "Set type to one of: addElement (kind, name, parent), addRelation (kind, from, to), rename (element, name), delete (element), setDoc (element, doc), replaceText (file, text). " +
      "A rename does not yet update references in other files; check the returned problems.",
    params: EDIT_PARAMS,
    run: ({ core, project, proposals }, args) => {
      const proposal = propose(core, project, editRequest(args));
      const files = proposedFiles(project, proposal);
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
  {
    name: "edit",
    title: "Edit the model",
    description:
      "Make one change to the model and write it to the model files in one step, without a separate confirmation (the server was started with --write-directly). " +
      "Returns the text edits per file (changes), the written files, and the problems of the project after the change. Elements are named by qualified name (see list_elements). " +
      "Set type to one of: addElement (kind, name, parent), addRelation (kind, from, to), rename (element, name), delete (element), setDoc (element, doc), replaceText (file, text). " +
      "A rename does not yet update references in other files; check the returned problems. Use propose_edit to see a change without writing it.",
    params: EDIT_PARAMS,
    writes: true,
    direct: true,
    run: async ({ core, project, writer }, args) => {
      // 今読んだテキストから作って、そのまま書く（提案を覚えない）
      const proposal = propose(core, project, editRequest(args));
      const files = proposedFiles(project, proposal);
      for (const f of files) await writer.write(f.path, f.text);
      return { ...proposal, written: files.map((f) => f.path) };
    },
  },
];

/**
 * AI のクライアントに出す道具を選ぶ。1 回で書く道具（edit）は、確かめずに書く設定を選んだときだけ出す（ADR-0024 の 4）。
 *
 * @param direct 確かめずに書く設定を選んだか（`modelith mcp <フォルダ> --write-directly`）
 * @returns 出す道具（TOOLS の順）
 * @example
 * toolsFor(false).map((t) => t.name) // → […, "propose_edit", "apply_edit"]（edit は無い）
 * toolsFor(true).map((t) => t.name)  // → […, "propose_edit", "apply_edit", "edit"]
 */
export function toolsFor(direct: boolean): Tool[] {
  return TOOLS.filter((t) => direct || !t.direct);
}

/** 対象にできる要素の種類と、その図の ID。 */
const SUBJECT_VIEWS: Record<string, SubjectView> = {
  "part def": "ibd",
  "state def": "stm",
  "action def": "afv",
  "occurrence def": "seq",
};

/**
 * 道具の引数から、書き出す図の指定を作る。テキストに書いた図は、修飾名からファイルと名前を引く。
 *
 * @param core コアの操作（図の一覧を引く）
 * @param project 今読んだプロジェクト
 * @param args export_diagram の引数
 * @returns 図の指定。形式が違う、diagram・subject・file のうち 1 つだけでない、その図や要素が無い、図にできない種類の要素のときは、理由を書いた ToolError を投げる
 * @example
 * diagramRequest(core, project, { format: "svg", diagram: "Shop::overview" }) // → { file: "shop.sysml", view: "overview", format: "svg" }
 * diagramRequest(core, project, { format: "drawio", file: "shop.sysml" })     // → { file: "shop.sysml", auto: "all", format: "drawio" }
 * diagramRequest(core, project, { format: "svg", subject: "Shop::Cart" })     // → { file: "shop.sysml", subject: { qualifiedName: "Shop::Cart", view: "ibd", start: … }, format: "svg" }
 * diagramRequest(core, project, { format: "png", file: "shop.sysml" })        // → ToolError("Unknown format \"png\". Use svg or drawio.") を投げる
 */
export function diagramRequest(core: Core, project: ProjectInput, args: Record<string, string | undefined>): DiagramRequest {
  const { format, diagram, subject, file, view } = args;
  if (format !== "svg" && format !== "drawio") throw new ToolError(`Unknown format "${format ?? ""}". Use svg or drawio.`);
  if ([diagram, subject, file].filter((x) => x !== undefined).length !== 1) throw new ToolError("Give exactly one of diagram, subject or file.");
  if (view !== undefined && file === undefined) throw new ToolError("view is only used with file.");
  if (subject !== undefined) {
    const found = core.element(project.files, subject);
    if (!found) throw new ToolError(`No element named "${subject}" was found. Use list_elements to see the qualified names.`);
    const subjectView = SUBJECT_VIEWS[found.kind];
    if (!subjectView) {
      throw new ToolError(`"${subject}" is a ${found.kind}. A subject must be one of: ${Object.keys(SUBJECT_VIEWS).join(", ")}.`);
    }
    return { file: found.file, subject: { qualifiedName: subject, view: subjectView, start: found.range.start }, format };
  }
  if (diagram !== undefined) {
    const found = core.outline(project.files).diagrams.find((d) => d.qualifiedName === diagram);
    if (!found) throw new ToolError(`No diagram named "${diagram}" was found. Use list_diagrams to see the qualified names.`);
    return { file: found.file, view: found.name, format };
  }
  return { file: file ?? "", auto: view ?? "all", format };
}

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

/**
 * 提案の差分を当てた、ファイルごとの新しいテキストを作る。
 *
 * @param project 今読んだプロジェクト
 * @param proposal 提案（ファイルごとの差分）
 * @returns 変わるファイルごとの、パス・提案したときの版・当てたあとのテキスト。何も変わらない提案なら空
 * @example
 * // a.sysml の "package P;" の終わりに " " を足す提案
 * proposedFiles(project, proposal) // → [{ path: "a.sysml", baseVersion: "…", text: "package P; " }]
 * proposedFiles(project, { changes: [], problems: [] }) // → []
 */
function proposedFiles(project: ProjectInput, proposal: ReturnType<Core["propose"]>): { path: string; baseVersion: string; text: string }[] {
  return proposal.changes.map((change) => ({
    path: change.file,
    baseVersion: change.baseVersion,
    text: applyEdits(textOf(project, change.file), change.edits),
  }));
}
