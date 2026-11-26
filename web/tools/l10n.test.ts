// 文言の辞書の検査（ADR-0027 の 6）。
import { describe, expect, it } from "vitest";
import { checkDictionaries, checkDictionary, hardcodedText, keyUsage, stripTsComments } from "./l10n";

describe("stripTsComments", () => {
  it("行のコメントとブロックのコメントを、同じ長さの空白にする", () => {
    const source = 'const a = 1; // 説明\n/* 二行の\n説明 */ const b = 2;';

    const out = stripTsComments(source);

    expect(out).toBe(`const a = 1; ${" ".repeat(5)}\n${" ".repeat(6)}\n${" ".repeat(5)} const b = 2;`);
    expect(out.length).toBe(source.length);
  });

  it("文字列の中の // と /* は、コメントにしない", () => {
    const source = 'const u = "http://a/*b"; const v = \'//c\';';

    expect(stripTsComments(source)).toBe(source);
  });

  it("テンプレートの中の //、${ } の中の文字列とコメントを見分ける", () => {
    const source = "const s = `a//b ${f(\"//c\") /* 説明 */} d`; // 終わり";

    expect(stripTsComments(source)).toBe(`const s = \`a//b \${f("//c") ${" ".repeat(8)}} d\`; ${" ".repeat(6)}`);
  });

  it("入れ子のテンプレートを読み、外のテンプレートの後のコメントを消す", () => {
    const source = "const s = `${a ? `x${b}` : `y`}//`; // 説明";

    expect(stripTsComments(source)).toBe(`const s = \`\${a ? \`x\${b}\` : \`y\`}//\`; ${" ".repeat(5)}`);
  });

  it("正規表現の中の // と引用符を、コメントや文字列の始まりにしない", () => {
    const source = "const r = /[/\"]\\//; const q = s.replace(/'/g, \"\"); // 説明";

    expect(stripTsComments(source)).toBe(`const r = /[/"]\\//; const q = s.replace(/'/g, ""); ${" ".repeat(5)}`);
  });

  it("割り算の / は、正規表現の始まりにしない", () => {
    const source = "const h = (a + b) / 2; const w = x / y; // 半分";

    expect(stripTsComments(source)).toBe(`const h = (a + b) / 2; const w = x / y; ${" ".repeat(5)}`);
  });

  it("エスケープした引用符で、文字列を終わらせない", () => {
    const source = 'const s = "a\\"//b"; // 説明';

    expect(stripTsComments(source)).toBe(`const s = "a\\"//b"; ${" ".repeat(5)}`);
  });

  it("空のソースは空のまま", () => {
    expect(stripTsComments("")).toBe("");
  });
});

describe("hardcodedText", () => {
  it("文字列に書いた日本語の行を返す", () => {
    const found = hardcodedText('const a = 1;\ntoast("保存しました");\n');

    expect(found).toEqual([{ line: 2, message: 'toast("保存しました");' }]);
  });

  it("テンプレートに書いた日本語と、日本語の記号だけの文も返す", () => {
    const found = hardcodedText("a(`「${n}」`);\nb(`${n} 件`);");

    expect(found.map((f) => f.line)).toEqual([1, 2]);
  });

  it("コメントの日本語は返さない", () => {
    expect(hardcodedText('// 説明\n/** 説明 */\nconst a = t("saved"); // 知らせる\n')).toEqual([]);
  });

  it("l10n-ignore と書いた行と、その次の行は返さない", () => {
    const source = 'const a = /[ぁ-ん]/; // l10n-ignore: 文字の種類\n// l10n-ignore: 文字の種類\nconst b = /[ァ-ヶ]/;\nconst c = "次の次";';

    expect(hardcodedText(source).map((f) => f.line)).toEqual([4]);
  });

  it("英字だけの文字列は返さない", () => {
    expect(hardcodedText('const a = "saved"; const b = `x-${y}`;')).toEqual([]);
  });
});

describe("checkDictionary", () => {
  it("キーを書いた順に返す。コメント・空の行・続きの行は数えない", () => {
    const ftl = "# 説明\n\n## 節\nsaved = 「{ $name }」を保存しました\nopened = { $count ->\n    [one] 1 file\n   *[other] files\n}\n";

    expect(checkDictionary(ftl)).toEqual({ keys: ["saved", "opened"], problems: [] });
  });

  it("小文字の英字・数字・- でないキーを知らせる", () => {
    const { keys, problems } = checkDictionary("Saved = a\nfile_name = b\n1st = c\nok-2 = d\n");

    expect(keys).toEqual(["ok-2"]);
    expect(problems.map((p) => p.line)).toEqual([1, 2, 3]);
  });

  it("2 回書いたキーを知らせる", () => {
    const { keys, problems } = checkDictionary("a = 1\na = 2\n");

    expect(keys).toEqual(["a"]);
    expect(problems).toEqual([{ line: 2, message: "キー「a」が 2 回書かれています" }]);
  });

  it("英字と数字でない値の名前を知らせる", () => {
    const { problems } = checkDictionary("a = { $file_name } と { $n1 } と {$名前}\n");

    expect(problems.map((p) => p.message)).toEqual(["値の名前「file_name」は、英字と数字だけにしてください", "値の名前「名前」は、英字と数字だけにしてください"]);
  });

  it("「キー = 文」の形でない行を知らせる", () => {
    const { problems } = checkDictionary("これは文だけ\n");

    expect(problems).toHaveLength(1);
    expect(problems[0]?.line).toBe(1);
  });

  it("空の辞書は、キーも誤りも無い", () => {
    expect(checkDictionary("")).toEqual({ keys: [], problems: [] });
  });
});

describe("checkDictionaries", () => {
  it("ファイルの名前で始まるキーを、すべて返す", () => {
    const checked = checkDictionaries([
      { name: "files", source: "files-a = 1\nfiles-b = 2\n" },
      { name: "core", source: "core-a = 3\n" },
    ]);

    expect(checked).toEqual({ keys: ["files-a", "files-b", "core-a"], problems: [] });
  });

  it("ファイルの名前で始まらないキーを知らせる（名前の一部が同じだけのものも）", () => {
    const { problems } = checkDictionaries([{ name: "files", source: "# 説明\ncore-a = 1\nfilesystem-b = 2\n" }]);

    expect(problems).toEqual([
      { file: "files", line: 2, message: "キー「core-a」は、ファイルの名前に合わせて「files-」で始めてください" },
      { file: "files", line: 3, message: "キー「filesystem-b」は、ファイルの名前に合わせて「files-」で始めてください" },
    ]);
  });

  it("ファイルごとの誤り（キーの形）を、ファイルの名前を付けて返す", () => {
    const { problems } = checkDictionaries([{ name: "files", source: "Files-A = 1\n" }]);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ file: "files", line: 1 });
  });

  it("辞書が無ければ、キーも誤りも無い", () => {
    expect(checkDictionaries([])).toEqual({ keys: [], problems: [] });
  });
});

describe("keyUsage", () => {
  it("辞書に無いキーと、使われていないキーを返す", () => {
    const usage = keyUsage(["saved", "old"], [{ file: "a.ts", source: 'x();\nt("saved"); t("gone");' }]);

    expect(usage).toEqual({ unknown: [{ file: "a.ts", line: 2, key: "gone" }], unused: ["old"] });
  });

  it("表に文字列として書いたキーは、使っているとみなす", () => {
    const usage = keyUsage(["kind-part", "kind-port"], [{ file: "a.ts", source: 'const LABEL = { part: "kind-part", port: "kind-port" };' }]);

    expect(usage).toEqual({ unknown: [], unused: [] });
  });

  it("コメントに書いたキーは、使っているとみなさない", () => {
    const usage = keyUsage(["saved"], [{ file: "a.ts", source: '// t("saved") を使う' }]);

    expect(usage.unused).toEqual(["saved"]);
  });

  it("t で終わる別の関数（toast・obj.t）の引数は、キーとして確かめない", () => {
    const usage = keyUsage([], [{ file: "a.ts", source: 'toast("x"); split("y"); obj.t("z");' }]);

    expect(usage.unknown).toEqual([]);
  });

  it("キーもコードも無ければ、何も返さない", () => {
    expect(keyUsage([], [])).toEqual({ unknown: [], unused: [] });
  });
});
