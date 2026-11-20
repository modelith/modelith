// 図を書き出す口（core.ts の Renderer）を、アプリと同じ配置と描画（web/src/render）で満たす（ADR-0024 の 3）。
// アプリのコードに触れるのはこのファイルだけ。画面（web/src/app）には頼らない。
// コアの解析は wasm の「表示中のファイルと、ほかのファイル」の口を使うので、書き出すたびにプロジェクトのファイルを渡し直す。

import { clearProjectFiles, setFocusFile, setProjectFile } from "../../web/src/core/wasm/modelith_core.js";
import { build, parse } from "../../web/src/core/rust.ts";
import { diagramDrawio, diagramSvg, type ViewTarget } from "../../web/src/render/index.ts";
import { parseLayoutFile } from "../../web/src/render/layout-file.ts";
import { baseViewOf } from "../../web/src/render/view-content.ts";
import { Refused, type DiagramOutput, type DiagramRequest, type ProjectInput, type Renderer } from "./core.ts";
import { initWasm } from "./wasm-core.ts";

/** 対象（部品定義など）を取らない自動の図の ID。 */
export const AUTO_DIAGRAMS = ["all", "structure", "trace", "control", "behavior"];

/** 対象・工程の指定の無い図の対象。 */
const NO_CONTEXT = { modelView: null, ibdCtx: null, seqCtx: null, flowCtx: null, stateCtx: null, phase: "" };

/**
 * 図を書き出す。
 *
 * @param project 読み込んだプロジェクト
 * @param request どの図を、どの形式で書き出すか
 * @returns 図の中身。配置ファイルが読めなかったときは、その理由も返す（配置なしで自動に並べる）。
 *   ファイル・図が無い、自動の図の ID が違うときは Refused を投げる
 * @example
 * renderDiagram(project, { file: "kettle.sysml", auto: "all", format: "svg" }).content.startsWith("<svg") // → true
 * renderDiagram(project, { file: "kettle.sysml", view: "nope", format: "svg" }) // → Refused を投げる
 */
function renderDiagram(project: ProjectInput, request: DiagramRequest): DiagramOutput {
  const file = project.files.find((f) => f.path === request.file);
  if (!file) throw new Refused(`The file ${request.file} was not found.`);
  clearProjectFiles();
  for (const f of project.files) setProjectFile(f.path, f.text);
  setFocusFile(file.path);
  const model = build(parse(file.text));
  let target: ViewTarget;
  if (request.view !== undefined) {
    const view = model.views.find((v) => v.name === request.view);
    if (!view) throw new Refused(`The diagram "${request.view}" was not found in ${request.file}.`);
    target = { ...NO_CONTEXT, view: baseViewOf(view), modelView: view.name };
  } else {
    const auto = request.auto ?? "all";
    if (!AUTO_DIAGRAMS.includes(auto)) {
      throw new Refused(`Unknown view "${auto}". Use one of: ${AUTO_DIAGRAMS.join(", ")}.`);
    }
    target = { ...NO_CONTEXT, view: auto };
  }
  const saved = project.layouts?.[file.path];
  const { layout, error } = saved === undefined ? { layout: {}, error: null } : parseLayoutFile(saved);
  const content = request.format === "svg" ? diagramSvg(model, target, layout).svg : diagramDrawio(model, target, layout);
  return error ? { content, layoutProblem: error } : { content };
}

/**
 * wasm を読み込み、図を書き出す口を作る。
 *
 * @returns 図を書き出す口。wasm のファイルが無ければ例外を投げる（先に scripts/build-wasm.sh が要る）
 * @example
 * loadWebRenderer().render(project, { file: "kettle.sysml", format: "svg" }).content // → "<svg …>…</svg>"
 */
export function loadWebRenderer(): Renderer {
  initWasm();
  return { render: renderDiagram };
}
