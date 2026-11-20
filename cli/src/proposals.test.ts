// 提案を覚えておく口の単体テスト。
import { expect, it } from "vitest";
import { memoryProposals } from "./proposals.ts";

/** 1、2、3… と ID を作る。 */
function counter(): () => string {
  let n = 0;
  return () => String(++n);
}

it("覚えた提案を ID で取り出せ、1 回取り出したら忘れる（正常系）", () => {
  // Arrange
  const store = memoryProposals(20, counter());
  const proposal = { files: [{ path: "a.sysml", baseVersion: "v1", text: "package P;" }] };
  // Act
  const id = store.add(proposal);
  const first = store.take(id);
  const second = store.take(id);
  // Assert
  expect(id).toBe("1");
  expect(first).toEqual(proposal);
  expect(second).toBeUndefined();
});

it("知らない ID は undefined（異常系）", () => {
  // Act
  const got = memoryProposals().take("nope");
  // Assert
  expect(got).toBeUndefined();
});

it("覚えておく数を超えたら、古いものから忘れる（境界値：ちょうど・1 つ超え）", () => {
  // Arrange
  const store = memoryProposals(2, counter());
  // Act
  store.add({ files: [] });
  store.add({ files: [] });
  const stillThere = memoryProposals(2, counter());
  stillThere.add({ files: [] });
  stillThere.add({ files: [] });
  store.add({ files: [] });
  // Assert
  expect([store.take("1"), store.take("2"), store.take("3")]).toEqual([undefined, { files: [] }, { files: [] }]);
  expect(stillThere.take("1")).toEqual({ files: [] });
});

it("既定の ID は、提案ごとに違う（正常系）", () => {
  // Arrange
  const store = memoryProposals();
  // Act
  const ids = [store.add({ files: [] }), store.add({ files: [] })];
  // Assert
  expect(ids[0]).not.toBe(ids[1]);
});
