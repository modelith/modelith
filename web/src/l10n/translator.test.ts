// 辞書から文を作る（ADR-0027 の 2）。
import { describe, expect, it } from "vitest";
import { createTranslator } from "./translator";

const JA = { locale: "ja", source: "saved = 「{ $name }」を保存しました\nplain = 保存しました\nbraces = 本体は {\"{\"} … {\"}\"} で囲みます\n" };
const EN = {
  locale: "en",
  source: "saved = Saved \"{ $name }\"\nonly-en = English only\nopened = { $count ->\n    [one] Opened { $shown } file\n   *[other] Opened { $shown } files\n}\n",
};

describe("createTranslator", () => {
  it("キーの文を返す", () => {
    const t = createTranslator([JA]);

    expect(t("plain")).toBe("保存しました");
  });

  it("値を差し込み、前後に見えない記号（U+2068・U+2069）を入れない", () => {
    const t = createTranslator([JA]);

    const text = t("saved", { name: "a.sysml" });

    expect(text).toBe("「a.sysml」を保存しました");
    expect(text).not.toMatch(/[⁨⁩]/);
  });

  it("値に書かれたタグや波かっこを、そのままの文字として入れる", () => {
    const t = createTranslator([JA]);

    expect(t("saved", { name: "<b>{ $x }</b>" })).toBe("「<b>{ $x }</b>」を保存しました");
  });

  it("文に書いた波かっこ（{\"{\"}）を、文字として出す", () => {
    const t = createTranslator([JA]);

    expect(t("braces")).toBe("本体は { … } で囲みます");
  });

  it("先の辞書にキーが無ければ、次の辞書の文を返す", () => {
    const t = createTranslator([JA, EN]);

    expect(t("saved", { name: "a" })).toBe("「a」を保存しました");
    expect(t("only-en")).toBe("English only");
  });

  it("数で複数形を選び分ける（1 と、それ以外）", () => {
    const t = createTranslator([EN]);

    expect(t("opened", { count: 1, shown: "1" })).toBe("Opened 1 file");
    expect(t("opened", { count: 2, shown: "2" })).toBe("Opened 2 files");
    expect(t("opened", { count: 0, shown: "0" })).toBe("Opened 0 files");
  });

  it("どの辞書にもキーが無ければ、キーを返して知らせる", () => {
    const problems: string[] = [];
    const t = createTranslator([JA], (p) => problems.push(p));

    expect(t("nothing")).toBe("nothing");
    expect(problems).toEqual(["nothing: not in the dictionary"]);
  });

  it("値が足りなければ知らせる", () => {
    const problems: string[] = [];
    const t = createTranslator([JA], (p) => problems.push(p));

    t("saved");

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("saved: ");
  });

  it("同じキーを 2 回書いた辞書を知らせる", () => {
    const problems: string[] = [];

    createTranslator([{ locale: "ja", source: "a = 1\na = 2\n" }], (p) => problems.push(p));

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("ja: ");
  });

  it("辞書が空でも動く", () => {
    const t = createTranslator([]);

    expect(t("x")).toBe("x");
  });
});
