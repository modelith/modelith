// 画面の骨組みの文言を辞書から埋める（ADR-0027）。
import { describe, expect, it } from "vitest";
import { escapeHtml, fillHtml, hardcodedHtmlText } from "./l10n-html";

const DICT: Record<string, string> = { save: "保存", hint: "元に戻す（Ctrl+Z）", risky: '<b>"a" & b</b>' };
const t = (key: string): string => DICT[key] ?? key;

describe("escapeHtml", () => {
  it("& < > \" を文字参照にする", () => {
    expect(escapeHtml('a < b & "c" > d')).toBe("a &lt; b &amp; &quot;c&quot; &gt; d");
  });

  it("ほかの文字はそのまま", () => {
    expect(escapeHtml("保存（Ctrl+S）")).toBe("保存（Ctrl+S）");
  });
});

describe("fillHtml", () => {
  it("data-l10n を書いた空の要素の中身を、辞書の文にする。キーは残す", () => {
    expect(fillHtml('<button id="b" data-l10n="save"></button>', t)).toBe('<button id="b" data-l10n="save">保存</button>');
  });

  it("data-l10n-title・aria-label・placeholder を、属性にする", () => {
    const html = '<button data-l10n-title="hint" data-l10n-aria-label="save"></button><input data-l10n-placeholder="save">';

    expect(fillHtml(html, t)).toBe(
      '<button data-l10n-title="hint" title="元に戻す（Ctrl+Z）" data-l10n-aria-label="save" aria-label="保存"></button><input data-l10n-placeholder="save" placeholder="保存">',
    );
  });

  it("同じ要素の中身と属性を、両方埋める", () => {
    expect(fillHtml('<button data-l10n="save" data-l10n-title="hint"></button>', t)).toBe('<button data-l10n="save" data-l10n-title="hint" title="元に戻す（Ctrl+Z）">保存</button>');
  });

  it("文に書かれたタグと引用符は、文字として入れる（中身と属性のどちらも）", () => {
    const out = fillHtml('<b data-l10n="risky" data-l10n-title="risky"></b>', t);

    expect(out).toBe('<b data-l10n="risky" data-l10n-title="risky" title="&lt;b&gt;&quot;a&quot; &amp; b&lt;/b&gt;">&lt;b&gt;&quot;a&quot; &amp; b&lt;/b&gt;</b>');
  });

  it("キーを書いていない要素は変えない", () => {
    const html = '<div id="a"><span class="kbd">Ctrl+S</span></div>';

    expect(fillHtml(html, t)).toBe(html);
  });

  it("data-l10n を書いた要素の中身が空でなければ、例外にする", () => {
    expect(() => fillHtml('<button data-l10n="save">保存</button>', t)).toThrow("1 個");
    expect(() => fillHtml('<button data-l10n="save"><span></span></button>', t)).toThrow("1 個");
  });
});

describe("hardcodedHtmlText", () => {
  it("要素の中身と属性に書いた日本語の行を返す", () => {
    expect(hardcodedHtmlText('<b>保存</b>\n<i title="元に戻す"></i>\n<b data-l10n="a"></b>').map((f) => f.line)).toEqual([1, 2]);
  });

  it("コメントの日本語は返さない（複数行のコメントも）", () => {
    expect(hardcodedHtmlText("<!-- 説明 -->\n<!--\n  二行の説明\n-->\n<b></b>")).toEqual([]);
  });

  it("日本語が無ければ、何も返さない", () => {
    expect(hardcodedHtmlText('<a href="https://example.com">Modelith</a>')).toEqual([]);
  });
});
