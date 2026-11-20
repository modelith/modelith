// 書き込みを待っている提案を、このサーバが動いている間だけ覚えておく（core.ts の ProposalStore）。
// 提案の中身を AI のクライアントに持ち回らせない：書き込むのは、提案したときに作って利用者に見せた中身そのものにする。

import { randomUUID } from "node:crypto";
import type { PendingProposal, ProposalStore } from "./core.ts";

/** 覚えておく提案の数の既定（古いものから忘れる）。 */
export const DEFAULT_CAPACITY = 20;

/**
 * 提案をメモリに覚えておく口を作る。
 *
 * @param capacity 覚えておく数（超えたら、古いものから忘れる）
 * @param newId ID を作る関数（テストで差し替える。既定は乱数の UUID）
 * @returns 提案を覚えておく口
 * @example
 * const store = memoryProposals();
 * const id = store.add({ files: [] });
 * store.take(id) // → { files: [] }
 * store.take(id) // → undefined（1 回取り出したら忘れる）
 */
export function memoryProposals(capacity = DEFAULT_CAPACITY, newId: () => string = randomUUID): ProposalStore {
  const pending = new Map<string, PendingProposal>();
  return {
    /**
     * 提案を覚え、ID を返す。数を超えたら、古いものから忘れる。
     *
     * @param proposal 書き込みを待つ提案
     * @returns あとで指すための ID
     * @example
     * store.add({ files: [] }) // → "89aa7e79-…"
     */
    add(proposal) {
      const id = newId();
      pending.set(id, proposal);
      // Map は入れた順に並ぶので、先頭が一番古い
      for (const old of pending.keys()) {
        if (pending.size <= capacity) break;
        pending.delete(old);
      }
      return id;
    },
    /**
     * ID の提案を取り出して忘れる。
     *
     * @param id add が返した ID
     * @returns 提案。無い（知らない ID・既に取り出した・古くて忘れた）なら undefined
     * @example
     * store.take("89aa7e79-…") // → { files: [] }。もう一度呼ぶと undefined
     */
    take(id) {
      const found = pending.get(id);
      pending.delete(id);
      return found;
    },
  };
}
