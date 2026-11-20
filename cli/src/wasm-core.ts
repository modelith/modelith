// コアの口（core.ts の Core）を、Rust のコアの wasm で満たす。wasm に触れるのはこのファイルだけ。
// wasm は scripts/build-wasm.sh が web/src/core/wasm/ に書き出したものを使う（アプリと同じもの）。

import { readFileSync } from "node:fs";
import { initSync, proposeEdit, readElement, readOutline, readProblems } from "../../web/src/core/wasm/modelith_core.js";
import { Refused, type Core, type EditProposal, type ElementDetail, type ProblemReport, type ProjectOutline } from "./core.ts";
import { versionOf } from "./edits.ts";

/** コアの wasm のファイル。 */
const WASM = new URL("../../web/src/core/wasm/modelith_core_bg.wasm", import.meta.url);

/**
 * コアが返した JSON を読む。コアが入力を読めなかったとき（`{ "error": "理由" }`）は、その理由で例外を投げる。
 * コアが意図を断ったとき（`{ "refused": "理由" }`）は、その理由で Refused を投げる。
 *
 * @param json コアが返した JSON
 * @returns 読んだ値
 * @example
 * parseResult<number[]>("[1]")                    // → [1]
 * parseResult("{\"error\":\"読めません\"}")        // → Error("読めません") を投げる
 * parseResult("{\"refused\":\"使えない名前\"}")    // → Refused("使えない名前") を投げる
 */
export function parseResult<T>(json: string): T {
  const value: unknown = JSON.parse(json);
  if (value !== null && typeof value === "object") {
    if ("error" in value && typeof value.error === "string") throw new Error(value.error);
    if ("refused" in value && typeof value.refused === "string") throw new Refused(value.refused);
  }
  return value as T;
}

/**
 * wasm を読み込み、コアの口を作る。
 *
 * @returns コアの口。wasm のファイルが無ければ例外を投げる（先に scripts/build-wasm.sh が要る）
 * @example
 * loadWasmCore().outline([{ path: "a.sysml", text: "part def A;" }]).elements[0]?.qualifiedName // → "A"
 */
export function loadWasmCore(): Core {
  initSync({ module: readFileSync(WASM) });
  return {
    outline: (files) => parseResult<ProjectOutline>(readOutline(JSON.stringify(files))),
    element: (files, qualifiedName) => parseResult<ElementDetail | null>(readElement(JSON.stringify(files), qualifiedName)),
    problems: (project) =>
      parseResult<ProblemReport[]>(
        readProblems(JSON.stringify(project.files), project.projectFile, JSON.stringify(project.pluginFiles)),
      ),
    propose: (project, request) =>
      parseResult<EditProposal>(
        proposeEdit(
          // 版は、今読んだテキストから作る。書き込むときに、もう一度読んだテキストの版と比べる
          JSON.stringify(project.files.map((f) => ({ ...f, version: versionOf(f.text) }))),
          project.projectFile,
          JSON.stringify(project.pluginFiles),
          JSON.stringify(request),
        ),
      ),
  };
}
