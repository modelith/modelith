// 無題の文書の下書きと、すべて閉じて終えたかを、キーと値の保存先（ブラウザでは localStorage）に置く（F-FILE-11・F-FILE-14）。

import type { Draft, DraftStore } from "./workspace";

/** キーと値の保存先。set は書けたかを返す（ブラウザの保存領域がいっぱいのときは false。F-FILE-11）。 */
export interface KeyValue {
  get(key: string): string | null;
  set(key: string, value: string): boolean;
}

const KEY = "modelith-drafts-v1";
/** すべての文書を閉じて終えたら "1" を置くキー（下書きの形は以前の版と同じに保つため、別のキーにする）。 */
const CLOSED_ALL_KEY = "modelith-closed-all";

/** この版の下書きの項目。ほかの項目がある記録は、新しい版が書いたものとして使わない（使うと、その項目を消してしまうため。C-11）。 */
const DRAFT_KEYS = new Set(["name", "text", "layout"]);

/**
 * 保存先から読んだ値が、この版の下書きの形か（name と text が文字列で、layout は無いか文字列で、ほかの項目が無いか）。
 *
 * @param v JSON から読んだ値
 * @returns 下書きの形なら true（型を Draft に絞る）
 * @example
 * isDraft({ name: "無題.sysml", text: "package P;" })              // → true
 * isDraft({ name: "無題.sysml", text: "package P;", color: "red" }) // → false（この版の知らない項目がある）
 * isDraft({ name: "x" })                                           // → false（text が無い）
 * isDraft(null)                                                    // → false
 */
const isDraft = (v: unknown): v is Draft => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const d = v as Record<string, unknown>;
  return (
    typeof d["name"] === "string" &&
    typeof d["text"] === "string" &&
    (d["layout"] === undefined || typeof d["layout"] === "string") &&
    Object.keys(d).every((k) => DRAFT_KEYS.has(k))
  );
};

/**
 * キーと値の保存先（ブラウザでは localStorage）に下書きを置く DraftStore を作る（F-FILE-11・F-FILE-14）。
 * 下書きはまとめて 1 つのキー（modelith-drafts-v1）に JSON で置き、すべて閉じて終えたかは別のキー（modelith-closed-all）に置く。
 *
 * @param kv キーと値の保存先
 * @returns 下書きの読み書き
 * @example
 * kvDraftStore(kv).load()                              // → { drafts: [], closedAll: false, unused: 0, locked: false }（まだ何も置いていない）
 * kvDraftStore({ get: () => "{not json", set }).load() // → { drafts: [], closedAll: false, unused: 0, locked: false }（壊れた下書きは読まない）
 */
export function kvDraftStore(kv: KeyValue): DraftStore {
  // 下書きの一覧にあった、この版の知らない形の記録（新しい版が書いたものなど）。使わないが、置き直すときに消さない（C-11、ADR-0023 §4）
  let unknown: unknown[] = [];
  // 一覧そのものが知らない形（配列でない）なら、書き換えずに残す
  let locked = false;
  // このタブが読んだ・置いた下書き（JSON の文字列）。置き直すとき、これ以外の下書きはほかのタブが置いたものとして残す（#266）
  let mine = new Set<string>();
  return {
    /**
     * 置いてある下書きと、すべて閉じて終えたかを読む。
     *
     * @returns 下書きの一覧（無い・JSON が壊れている・配列でないときは空。この版の下書きの形でない記録は除く）と、すべて閉じて終えたか、
     *   使わずに残した記録の数、一覧を書き換えずに残すか
     * @example
     * load() // → { drafts: [{ name: "無題.sysml", text: "package P;" }], closedAll: false, unused: 0, locked: false }
     * load() // → { drafts: [], closedAll: true, unused: 0, locked: false }（すべて閉じて終えた）
     * load() // → { drafts: [d], closedAll: false, unused: 2, locked: false }（知らない形の記録が 2 つある）
     * load() // → { drafts: [], closedAll: false, unused: 0, locked: true }（一覧が {"version":2,…} の形）
     */
    load() {
      const read = readAll(kv);
      locked = read.locked;
      unknown = read.all.filter((v) => !isDraft(v));
      mine = new Set(read.all.filter(isDraft).map((d) => JSON.stringify(d)));
      return { drafts: read.all.filter(isDraft), closedAll: kv.get(CLOSED_ALL_KEY) === "1", unused: unknown.length, locked };
    },
    /**
     * このタブの下書きの一覧と、すべて閉じて終えたかを置く。置く直前に保存先を読み直し、このタブが読んでも置いてもいない下書き
     * （同じブラウザのほかのタブが置いたもの）と、知らない形の記録は、後ろに残す（#266）。
     * 一覧そのものが知らない形のときは、一覧を書き換えない（すべて閉じて終えたかだけを置く）。
     *
     * @param state 置く下書きの一覧（空なら、このタブの下書きを外す）と、すべて閉じて終えたか
     * @returns 下書きを置けたら true。保存先に書けなかった（保存領域がいっぱい）か、一覧が知らない形で、置く下書きがあるのに置けなかったなら false
     * @example
     * save({ drafts: [{ name: "無題.sysml", text: "package P;" }], closedAll: false }) // → true
     * save({ drafts: [huge], closedAll: false })                                       // → false（保存領域がいっぱい）
     * save({ drafts: [d], closedAll: false })                                          // → false（一覧が {"version":2,…} の形で置けない）
     * save({ drafts: [], closedAll: true })                                            // → true（一覧が知らない形でも、置くものが無い）
     */
    save(state) {
      const now = readAll(kv);
      locked = now.locked;
      const others = now.all.filter((v) => isDraft(v) && !mine.has(JSON.stringify(v)));
      unknown = now.all.filter((v) => !isDraft(v));
      const saved = locked ? state.drafts.length === 0 : kv.set(KEY, JSON.stringify([...state.drafts, ...others, ...unknown]));
      if (saved) mine = new Set(state.drafts.map((d) => JSON.stringify(d)));
      kv.set(CLOSED_ALL_KEY, state.closedAll ? "1" : "0");
      return saved;
    },
  };
}

/**
 * 保存先から、下書きの一覧の記録をそのまま読む（形はまだ確かめない）。
 *
 * @param kv キーと値の保存先
 * @returns 記録の配列と、一覧そのものがこの版の知らない形（JSON として読めるが配列でない）か。
 *   無い・JSON が壊れているときは空の配列で、知らない形ではない（壊れた一覧は置き直してよい）
 * @example
 * readAll(kv) // → { all: [{ name: "無題.sysml", text: "package P;" }, { title: "新しい版の形" }], locked: false }
 * readAll(kv) // → { all: [], locked: false }（JSON が壊れている）
 * readAll(kv) // → { all: [], locked: true }（{"version":2,"drafts":[…]} の形）
 */
function readAll(kv: KeyValue): { all: unknown[]; locked: boolean } {
  let v: unknown;
  try {
    v = JSON.parse(kv.get(KEY) ?? "[]");
  } catch {
    return { all: [], locked: false }; // 壊れた下書きは読まない
  }
  return Array.isArray(v) ? { all: v, locked: false } : { all: [], locked: true };
}
