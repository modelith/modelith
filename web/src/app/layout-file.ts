// 配置ファイル（model.sysml の隣の model.layout.json、ADR-0005）の読み書き。判断だけの純粋関数。
// 差分とマージを読みやすくするため、キー順を固定し、要素ごとに 1 行で書く。

import { emptyView, layoutFromJson, layoutToJson, type Layout } from "./layout";

/** 配置ファイルの形式の版。古い版が読み違える変更をしたときだけ上げる（ADR-0023 §3）。 */
export const LAYOUT_FORMAT = 1;

/** この版が知っている、いちばん外側の項目。 */
const KNOWN_TOP = new Set(["modelith", "format", "views"]);

/** この版が知っている、ビューの中の `@` で始まる項目。 */
const KNOWN_VIEW = new Set(["@pins", "@ends"]);

/**
 * この版が守れる機能の名前。新しい版は、古い版が残すだけでは中身が食い違う機能を使ったとき、その名前を配置ファイルの
 * `requires` に書く（ADR-0023 §3）。ここに無い名前があれば、この版はそのファイルを保存しない。この版は、名前の付いた機能をまだ持たない。
 */
export const KNOWN_FEATURES: ReadonlySet<string> = new Set();

/** 配置ファイルの、この版が知らない項目。保存するときに、そのまま書き戻す（ADR-0023 §3）。 */
export interface LayoutExtras {
  /** いちばん外側の、知らない項目（`requires` を含む）。 */
  top: Record<string, unknown>;
  /** ビューのキー → そのビューの中の、知らない `@` で始まる項目。 */
  views: Record<string, Record<string, unknown>>;
}

/** 知らない項目の無い状態。 */
export const NO_EXTRAS: LayoutExtras = { top: {}, views: {} };

/**
 * オブジェクトの項目を、キーの文字コード順に並べた組の配列にする。
 *
 * @param o 並べるオブジェクト
 * @returns `[キー, 値]` の配列（キーの昇順）
 * @example
 * sortKeys({ b: 2, a: 1 }) // → [["a", 1], ["b", 2]]
 * sortKeys({})             // → []
 */
const sortKeys = <T>(o: Record<string, T>): [string, T][] => Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

/**
 * 値を、キー順を固定した 1 行の JSON にする（空白を入れない）。
 *
 * @param v JSON にできる値
 * @returns 1 行の JSON の文字列
 * @example
 * stable({ a2: ["r", 0.5], a1: ["l", 0.3] }) // → '{"a1":["l",0.3],"a2":["r",0.5]}'
 * stable(["a1", null])                       // → '["a1",null]'
 */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") return `{${sortKeys(v as Record<string, unknown>).map(([k, x]) => `${JSON.stringify(k)}:${stable(x)}`).join(",")}}`;
  return JSON.stringify(v);
}

/**
 * 配置を、配置ファイル（`model.layout.json`、ADR-0005）の文字列にする。キー順を固定し、接続点・線の端は要素ごとに 1 行で書く。空のビューは書かない。
 *
 * 読んだときにあった、この版の知らない項目（extras）も書き戻す。項目はいちばん外側なら `views` の後に、ビューの中ならそのビューに並べる。
 *
 * @param layout ビューごとの配置
 * @param extras 書き戻す、知らない項目（省くと無し）
 * @returns 配置ファイルの中身（末尾に改行を付ける）。同じ配置なら作った順によらず同じ文字列
 * @example
 * serializeLayout({ trace: { pos: { B: [10, 20], A: [0, 0] }, pins: {}, ends: {} } })
 * // → '{\n  "modelith": "layout",\n  "format": 1,\n  "views": {\n    "trace": {\n      "A": [0,0],\n      "B": [10,20]\n    }\n  }\n}\n'
 * serializeLayout({}) // → '{\n  "modelith": "layout",\n  "format": 1,\n  "views": {}\n}\n'（境界値）
 * serializeLayout({}, { top: { note: 1 }, views: { trace: { "@bends": {} } } })
 * // → '{\n  "modelith": "layout",\n  "format": 1,\n  "views": {\n    "trace": {\n      "@bends": {}\n    }\n  },\n  "note": 1\n}\n'
 */
export function serializeLayout(layout: Layout, extras: LayoutExtras = NO_EXTRAS): string {
  const known = layoutToJson(layout);
  const merged: Record<string, Record<string, unknown>> = { ...known };
  for (const [vk, x] of Object.entries(extras.views)) merged[vk] = { ...(known[vk] ?? {}), ...x };
  const views = sortKeys(merged).filter(([, v]) => Object.keys(v).length);
  const view = ([vk, v]: [string, Record<string, unknown>]): string => {
    const lines = sortKeys(v).map(([k, x]) => {
      // 接続点・線の端は、要素ごとに 1 行にする
      if ((k === "@pins" || k === "@ends") && x && typeof x === "object") {
        const inner = sortKeys(x as Record<string, unknown>).map(([ik, ix]) => `        ${JSON.stringify(ik)}: ${stable(ix)}`);
        return `      ${JSON.stringify(k)}: {\n${inner.join(",\n")}\n      }`;
      }
      return `      ${JSON.stringify(k)}: ${stable(x)}`;
    });
    return `    ${JSON.stringify(vk)}: {\n${lines.join(",\n")}\n    }`;
  };
  const body = views.length ? `{\n${views.map(view).join(",\n")}\n  }` : "{}";
  const top = sortKeys(extras.top).map(([k, x]) => `,\n  ${JSON.stringify(k)}: ${stable(x)}`).join("");
  return `{\n  "modelith": "layout",\n  "format": ${LAYOUT_FORMAT},\n  "views": ${body}${top}\n}\n`;
}

/**
 * 配置ファイルの中身を、形まで確かめて読む。
 *
 * @param text 配置ファイルの中身
 * @returns 読めたら、いちばん外側のオブジェクトと views。空なら "empty"、読めなければ理由
 * @example
 * readRaw('{"modelith":"layout","format":1,"views":{}}') // → { top: {…}, views: {} }
 * readRaw("")                                          // → "empty"
 * readRaw("{}")                                        // → "empty"（中身の無いオブジェクト）
 * readRaw("{ broken")                                  // → { error: "配置ファイルを読めません（JSON の形が壊れています）" }
 */
function readRaw(text: string): { top: Record<string, unknown>; views: Record<string, unknown> } | { error: string } | "empty" {
  if (!text.trim()) return "empty";
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: "配置ファイルを読めません（JSON の形が壊れています）" };
  }
  // 中身の無いオブジェクト（手で作った `{}` など）は、失うものが無いので空のファイルと同じに扱う
  if (raw && typeof raw === "object" && !Array.isArray(raw) && !Object.keys(raw).length) return "empty";
  const o = raw as { modelith?: unknown; format?: unknown; views?: unknown } | null;
  if (!o || typeof o !== "object" || o.modelith !== "layout" || typeof o.views !== "object" || o.views === null) {
    return { error: "配置ファイルの形が違います" };
  }
  if (o.format !== LAYOUT_FORMAT) return { error: `配置ファイルの形式（${String(o.format)}）に対応していません` };
  return { top: o as Record<string, unknown>, views: o.views as Record<string, unknown> };
}

/**
 * 配置ファイルの、この版が知らない項目を取り出す（保存するときに書き戻すため。ADR-0023 §3）。
 *
 * @param text 配置ファイルの中身（読んだときのもの）
 * @returns 知らない項目。空・読めないファイルなら無し
 * @example
 * layoutExtras('{"modelith":"layout","format":1,"views":{"t":{"A":[0,0],"@bends":{"e":[[1,2]]}}},"requires":[]}')
 * // → { top: { requires: [] }, views: { t: { "@bends": { e: [[1, 2]] } } } }
 * layoutExtras("") // → NO_EXTRAS
 */
export function layoutExtras(text: string): LayoutExtras {
  const raw = readRaw(text);
  if (raw === "empty" || "error" in raw) return NO_EXTRAS;
  const top = Object.fromEntries(Object.entries(raw.top).filter(([k]) => !KNOWN_TOP.has(k)));
  const views: Record<string, Record<string, unknown>> = {};
  for (const [vk, v] of Object.entries(raw.views)) {
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    const x = Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([k]) => k.startsWith("@") && !KNOWN_VIEW.has(k)));
    if (Object.keys(x).length) views[vk] = x;
  }
  return { top, views };
}

/**
 * この版がその配置ファイルを保存してはいけない理由（ADR-0023 §3）。読めなかったファイルと、この版の知らない機能
 * （`requires`）を含むファイルは、上書きしてほかの版の内容を壊さないよう、保存しない。
 *
 * @param text 配置ファイルの中身（読んだときのもの）
 * @returns 保存しない理由（利用者に見せる文）。保存してよければ null（空のファイルを含む）
 * @example
 * writeLock("")                                                          // → null
 * writeLock("{}")                                                        // → null（中身が無いので失うものが無い）
 * writeLock('{"modelith":"layout","format":1,"views":{}}')               // → null
 * writeLock('{"modelith":"layout","format":2,"views":{}}')               // → "配置ファイルの形式（2）に対応していません。…この版では図の配置を保存しません"
 * writeLock('{"modelith":"layout","format":1,"views":{},"requires":["edge-shapes"]}') // → "…新しい版の Modelith で使った機能（edge-shapes）…"
 */
export function writeLock(text: string): string | null {
  const raw = readRaw(text);
  if (raw === "empty") return null;
  if ("error" in raw) return `${raw.error}。ファイルを守るため、この版では図の配置を保存しません`;
  const req = raw.top["requires"];
  const names = Array.isArray(req) ? req.map(String) : req === undefined ? [] : [String(req)];
  const unknown = names.filter((n) => !KNOWN_FEATURES.has(n));
  if (!unknown.length) return null;
  return `配置ファイルに、新しい版の Modelith で使った機能（${unknown.join("・")}）が入っています。ファイルを守るため、この版では図の配置を保存しません`;
}

/**
 * 配置ファイルの中身に、読んだときのファイルにあった、この版の知らない項目を書き戻す（ADR-0023 §3）。
 *
 * @param text この版が書いた配置ファイルの中身
 * @param base 読んだときの配置ファイルの中身
 * @returns 知らない項目を書き戻した中身。base に知らない項目が無ければ text のまま
 * @example
 * keepExtras(serializeLayout(L), "")                         // → serializeLayout(L)
 * keepExtras(serializeLayout(L), '{…,"note":1}')             // → serializeLayout(L, { top: { note: 1 }, views: {} })
 */
export function keepExtras(text: string, base: string): string {
  const extras = layoutExtras(base);
  if (!Object.keys(extras.top).length && !Object.keys(extras.views).length) return text;
  return serializeLayout(parseLayoutFile(text).layout, extras);
}

/**
 * 配置ファイルを読む。空・壊れた内容・知らない形式なら、理由を添えて空の配置を返す。
 *
 * @param text 配置ファイルの中身
 * @returns 読んだ配置と、読めなかった理由（読めたとき・空のファイルは null）。例外は投げない
 * @example
 * parseLayoutFile(serializeLayout(L)) // → { layout: L, error: null }（空のビューを除く）
 * parseLayoutFile("  \n")             // → { layout: {}, error: null }（空のファイル）
 * parseLayoutFile("{ broken")         // → { layout: {}, error: "配置ファイルを読めません（JSON の形が壊れています）" }
 * parseLayoutFile('{"modelith":"layout","format":2,"views":{}}') // → { layout: {}, error: "配置ファイルの形式（2）に対応していません" }
 */
export function parseLayoutFile(text: string): { layout: Layout; error: string | null } {
  const raw = readRaw(text);
  if (raw === "empty") return { layout: {}, error: null };
  if ("error" in raw) return { layout: {}, error: raw.error };
  return { layout: layoutFromJson(raw.views), error: null };
}

/**
 * 配置が空か（どのビューにも座標・接続点・線の端が無い）を判定する。
 *
 * @param layout ビューごとの配置
 * @returns 空なら true。ビューが無いときも true
 * @example
 * isEmptyLayout({})                                     // → true（境界値）
 * isEmptyLayout({ v: { pos: {}, pins: {}, ends: {} } }) // → true
 * isEmptyLayout({ v: { pos: { A: [0, 0] }, pins: {}, ends: {} } }) // → false
 */
export const isEmptyLayout = (layout: Layout): boolean =>
  Object.values(layout).every((v) => !Object.keys(v.pos).length && !Object.keys(v.pins).length && !Object.keys(v.ends).length);

/**
 * ビューの配置を取り出す。無ければ空の配置を作って layout に足す（layout を書き換える）。
 *
 * @param layout ビューごとの配置
 * @param vk ビューのキー（`trace`・`ibd:<文脈>` など）
 * @returns そのビューの配置（layout の中のオブジェクトそのもの）
 * @example
 * viewOf({}, "trace") // → { pos: {}, pins: {}, ends: {} }（足した上で返す）
 */
export const viewOf = (layout: Layout, vk: string) => (layout[vk] ||= emptyView());
