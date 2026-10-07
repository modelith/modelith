// モック（reference/mock/Modelith.html）のパーサとモデル構築を Node で実行し、
// reference/golden/<case>.json に出力する。Rust コアはこの出力と一致させる（ADR-0002）。
//   node reference/tools/gen-golden.mjs           生成
//   node reference/tools/gen-golden.mjs --check   生成結果が最新かを検証（CI 用）
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "mock/Modelith.html"), "utf8");

// UI に依存しない「1. パーサ」〜「2. モデル」区間と SAMPLE だけを取り出す
const script = html.slice(html.indexOf("<script>") + "<script>".length);
const start = script.indexOf("/* ================= 1. パーサ");
const end = script.indexOf("/* ================= 3. ビュー");
const sampleLine = script.slice(0, start).match(/^const SAMPLE = .*$/m);
if (start < 0 || end < 0 || !sampleLine) throw new Error("mock の区切りが見つかりません");
const ctx = vm.createContext({});
vm.runInContext(`"use strict";${sampleLine[0]}\n${script.slice(start, end)}\n;this.api = {parse, build, SAMPLE};`, ctx);
const { parse, build, SAMPLE } = ctx.api;

// 循環参照（owner / pe / entry）をエントリ番号に置き換えて JSON 化できる形にする
const ref = (e) => (e && typeof e.idx === "number" ? e.idx : null);
function project(text) {
  const P = parse(text);
  const M = build(P);
  const entries = P.entries.map((e) => ({
    idx: e.idx, kind: e.kind, isDef: e.isDef, short: e.short, name: e.name, type: e.type,
    conj: e.conj, mods: e.mods, dir: e.dir, value: e.value, doc: e.doc,
    enumValues: e.enumValues, span: [e.start, e.end], close: e.close ?? null,
    parent: ref(e.pe), children: e.children.map(ref), exprs: simplify(e.exprs), meta: simplify(e.meta),
  }));
  const rels = P.rels.map(({ pe, usage, ...r }) => ({ ...simplify(r), parent: ref(pe), usage: ref(usage) }));
  const nodes = M.nodes.map((n) => Object.fromEntries(
    Object.entries(n).map(([k, v]) => [k, k === "entry" ? ref(v) : simplify(v)])));
  const edges = M.edges.map(({ src, ...e }) => ({ ...e, src: simplify(src) }));
  return { entries, rels, errors: P.errors, layout: P.layout, model: { nodes, edges, problems: simplify(M.problems), phases: simplify(M.phases) } };
}
function simplify(v, seen = new Set()) {
  if (v == null || typeof v !== "object") return v;
  if (typeof v.idx === "number" && "kind" in v) return { $entry: v.idx };
  if (v.anon) return { $block: v.head };
  if (seen.has(v)) return { $cycle: true };
  seen = new Set(seen).add(v);
  if (v instanceof Map || v instanceof Set) return simplify([...v], seen);
  if (Array.isArray(v)) return v.map((x) => simplify(x, seen));
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, simplify(x, seen)]));
}

const cases = [["sample", SAMPLE]];
const caseDir = join(root, "golden/cases");
for (const f of readdirSync(caseDir).filter((f) => f.endsWith(".sysml")).sort())
  cases.push([basename(f, ".sysml"), readFileSync(join(caseDir, f), "utf8")]);

const check = process.argv.includes("--check");
let stale = 0;
for (const [name, text] of cases) {
  const out = join(root, "golden", `${name}.json`);
  const json = JSON.stringify({ case: name, ...simplify(project(text)) }, null, 2) + "\n";
  if (check) {
    if (!existsSync(out) || readFileSync(out, "utf8") !== json) { console.error(`stale: ${out}`); stale++; }
  } else writeFileSync(out, json);
}
if (stale) { console.error("node reference/tools/gen-golden.mjs で再生成してください"); process.exit(1); }
console.log(`${cases.length} golden case(s) ${check ? "up to date" : "written"}`);
