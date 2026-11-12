// HTML・SVG・XML に埋め込む文字のエスケープ。
import { describe, expect, it } from "vitest";
import { esc } from "./escape";

describe("esc（埋め込む文字のエスケープ）", () => {
  it("& < > \" の 4 文字を文字参照にする（正常系）", () => {
    // Act
    const s = esc('<a href="x">&</a>');
    // Assert
    expect(s).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
  });

  it("単引用符はそのまま残す（4 文字に入らない文字の代表）", () => {
    // Act
    const s = esc("it's");
    // Assert
    expect(s).toBe("it's");
  });

  it("空の文字列は空のまま（境界）", () => {
    // Act
    const s = esc("");
    // Assert
    expect(s).toBe("");
  });

  it("文字列でない値は文字列にする", () => {
    // Act
    const s = esc(42);
    // Assert
    expect(s).toBe("42");
  });
});
