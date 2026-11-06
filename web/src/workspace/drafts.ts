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

/**
 * 保存先から読んだ値が下書きの形か（name と text が文字列か）。
 *
 * @param v JSON から読んだ値
 * @returns 下書きの形なら true（型を Draft に絞る）
 * @example
 * isDraft({ name: "無題.sysml", text: "package P;" }) // → true
 * isDraft({ name: "x" })                              // → false（text が無い）
 * isDraft(null)                                       // → false
 */
const isDraft = (v: unknown): v is Draft =>
  !!v && typeof v === "object" && typeof (v as Draft).name === "string" && typeof (v as Draft).text === "string";

/**
 * キーと値の保存先（ブラウザでは localStorage）に下書きを置く DraftStore を作る（F-FILE-11・F-FILE-14）。
 * 下書きはまとめて 1 つのキー（modelith-drafts-v1）に JSON で置き、すべて閉じて終えたかは別のキー（modelith-closed-all）に置く。
 *
 * @param kv キーと値の保存先
 * @returns 下書きの読み書き
 * @example
 * kvDraftStore(kv).load()                              // → { drafts: [], closedAll: false }（まだ何も置いていない）
 * kvDraftStore({ get: () => "{not json", set }).load() // → { drafts: [], closedAll: false }（壊れた下書きは読まない）
 */
export function kvDraftStore(kv: KeyValue): DraftStore {
  // 下書きの一覧にあった、この版の知らない形の記録（新しい版が書いたものなど）。使わないが、置き直すときに消さない（ADR-0023 §4）
  let unknown: unknown[] = [];
  return {
    /**
     * 置いてある下書きと、すべて閉じて終えたかを読む。
     *
     * @returns 下書きの一覧（無い・JSON が壊れている・配列でないときは空。下書きの形でない項目は除く）と、すべて閉じて終えたか
     * @example
     * load() // → { drafts: [{ name: "無題.sysml", text: "package P;" }], closedAll: false }
     * load() // → { drafts: [], closedAll: true }（すべて閉じて終えた）
     * load() // → { drafts: [], closedAll: false }（JSON が壊れている）
     */
    load() {
      const all = readAll(kv);
      unknown = all.filter((v) => !isDraft(v) && !!v && typeof v === "object");
      return { drafts: all.filter(isDraft), closedAll: kv.get(CLOSED_ALL_KEY) === "1" };
    },
    /**
     * 下書きの一覧と、すべて閉じて終えたかを、まとめて置き換える。読んだときにあった知らない形の記録は、後ろに残す。
     *
     * @param state 置く下書きの一覧（空なら空の一覧を置く）と、すべて閉じて終えたか
     * @returns 下書きを置けたら true。保存先に書けなかった（保存領域がいっぱい）なら false
     * @example
     * save({ drafts: [{ name: "無題.sysml", text: "package P;" }], closedAll: false }) // → true
     * save({ drafts: [huge], closedAll: false })                                       // → false（保存領域がいっぱい）
     */
    save(state) {
      const saved = kv.set(KEY, JSON.stringify([...state.drafts, ...unknown]));
      kv.set(CLOSED_ALL_KEY, state.closedAll ? "1" : "0");
      return saved;
    },
  };
}

/**
 * 保存先から、下書きの一覧の記録をそのまま読む（形はまだ確かめない）。
 *
 * @param kv キーと値の保存先
 * @returns 記録の配列。無い・JSON が壊れている・配列でないときは空
 * @example
 * readAll(kv) // → [{ name: "無題.sysml", text: "package P;" }, { title: "新しい版の形" }]
 * readAll(kv) // → []（JSON が壊れている）
 */
function readAll(kv: KeyValue): unknown[] {
  try {
    const v: unknown = JSON.parse(kv.get(KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return []; // 壊れた下書きは読まない
  }
}
