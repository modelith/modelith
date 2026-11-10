// IndexedDB が新しい版の形かの見分け（C-11、ADR-0023 §4。#241）。
import { describe, expect, it } from "vitest";
import { isNewerDb } from "./idb-handle-store";

describe("isNewerDb（#241）", () => {
  it("新しい版の形で開けなかった（VersionError）なら true（異常系）", () => {
    expect(isNewerDb(new DOMException("newer", "VersionError"))).toBe(true);
  });

  it.each([new DOMException("x", "UnknownError"), new Error("x"), null, undefined])("ほかの理由（%s）なら false", (err) => {
    expect(isNewerDb(err)).toBe(false);
  });
});
