// 失敗した e2e のテストの要約（操作の一覧・ブラウザのエラー・失敗時の画面）。
// 記録の形は、Playwright 1.64.1 の実際の trace（version 10）から、要る項目だけを写したもの。
import { describe, expect, it } from "vitest";
import {
  BEGIN_MARK,
  clip,
  DEFAULT_LIMITS,
  END_MARK,
  formatActions,
  formatBrowserEvents,
  parseJsonLines,
  pickErrorContext,
  readActions,
  readBrowserEvents,
  readTestTitle,
  stripAnsi,
  summarizeFailure,
  actionTitles,
  type Action,
  type BrowserEvent,
} from "./e2e-failure";

/**
 * 記録を JSON Lines にする。
 *
 * @param records 記録
 * @returns 1 行に 1 つの JSON
 */
const jsonl = (...records: object[]): string => records.map((r) => JSON.stringify(r)).join("\n");

/**
 * 操作の始まりの記録（test.trace の形）。
 *
 * @param callId 操作の ID
 * @param startTime 始まった時刻
 * @param rest ほかの項目（題・親・場所など）
 * @returns 記録
 */
const before = (callId: string, startTime: number, rest: object = {}): object => ({
  type: "before",
  callId,
  startTime,
  class: "Test",
  method: "pw:api",
  title: "Click",
  params: {},
  stack: [],
  ...rest,
});

/**
 * 操作の終わりの記録。
 *
 * @param callId 操作の ID
 * @param endTime 終わった時刻
 * @param message エラーの文（失敗したときだけ）
 * @returns 記録
 */
const after = (callId: string, endTime: number, message?: string): object => ({
  type: "after",
  callId,
  endTime,
  ...(message === undefined ? {} : { error: { name: "", message } }),
});

/**
 * 要約に出す操作を作る。
 *
 * @param index 番号
 * @param rest 変える項目
 * @returns 操作
 */
const action = (index: number, rest: Partial<Action> = {}): Action => ({
  index,
  depth: 0,
  title: `操作${index}`,
  startMs: index * 100,
  durationMs: 10,
  location: "",
  failed: false,
  error: null,
  ...rest,
});

describe("parseJsonLines（JSON Lines を読む）", () => {
  it("1 行ずつオブジェクトとして読む（正常系）", () => {
    // Act / Assert
    expect(parseJsonLines('{"a":1}\n{"b":2}\n')).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("壊れた行・オブジェクトでない行は飛ばし、読めた行だけを返す（異常系）", () => {
    // Act / Assert
    expect(parseJsonLines('{"a":1}\n{"途中で切れた\n[1,2]\n"文字列"\nnull\n{"b":2}')).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("空のテキストは空（境界値）", () => {
    // Act / Assert
    expect(parseJsonLines("")).toEqual([]);
  });
});

describe("stripAnsi・clip（文字列の整え）", () => {
  it("色の制御文字を除く", () => {
    // Act / Assert
    expect(stripAnsi("\u001b[2mexpect(\u001b[22m\u001b[31mlocator\u001b[39m)")).toBe("expect(locator)");
  });

  it("上限ちょうどは切らず、1 文字超えたら切って残りの文字数を示す（境界値）", () => {
    // Act / Assert
    expect(clip("abc", 3)).toBe("abc");
    expect(clip("abcd", 3)).toBe("abc…（残り 1 文字を省略）");
  });
});

describe("readActions（操作の一覧）", () => {
  it("題・対象・引数・始まり・かかった時間・場所を読む（正常系）", () => {
    // Arrange
    const trace = jsonl(
      { version: 10, type: "context-options", origin: "testRunner" },
      before("a@1", 1000, { title: "Navigate", subtitle: "./", params: { url: "./" }, stack: [{ file: "/repo/web/e2e/fixtures.ts", line: 85, column: 14 }] }),
      after("a@1", 1400.4),
      before("a@2", 1500, { method: "expect", title: 'Expect "toHaveText"', subtitle: "locator('#toast')", params: { locator: "locator('#toast')", expected: "保存しました" } }),
      after("a@2", 1520),
    );
    // Act
    const actions = readActions(trace, "/repo/web");
    // Assert
    expect(actions).toEqual([
      { index: 1, depth: 0, title: "Navigate ./", startMs: 0, durationMs: 400, location: "e2e/fixtures.ts:85", failed: false, error: null },
      { index: 2, depth: 0, title: `Expect "toHaveText" locator('#toast') expected="保存しました"`, startMs: 500, durationMs: 20, location: "", failed: false, error: null },
    ]);
  });

  it("失敗した操作は、色を除いたエラーの文を持つ", () => {
    // Arrange
    const trace = jsonl(before("a@1", 0), after("a@1", 5000, "Error: \u001b[31mlocator.click\u001b[39m: Timeout"));
    // Act
    const [first] = readActions(trace, "");
    // Assert
    expect(first).toMatchObject({ failed: true, error: "Error: locator.click: Timeout" });
  });

  it("終わりの記録が無い操作（時間切れで止まったもの）は、かかった時間が null（境界値）", () => {
    // Arrange
    const trace = jsonl(before("a@1", 0));
    // Act
    const [first] = readActions(trace, "");
    // Assert
    expect(first).toMatchObject({ durationMs: null, failed: false });
  });

  it("フック・フィクスチャの枠と設定の記録は省き、その中の操作は残す", () => {
    // Arrange
    const trace = jsonl(
      before("a@1", 0, { method: "hook", title: "Before Hooks" }),
      before("a@2", 1, { method: "fixture", title: 'Fixture "page"', parentId: "a@1" }),
      before("a@3", 2, { title: "Create page", parentId: "a@2" }),
      after("a@3", 3),
      before("a@4", 4, { title: "Add init script", parentId: "a@2", group: "configuration" }),
      after("a@4", 5),
      after("a@2", 6),
      after("a@1", 7),
      before("a@5", 8, { method: "test.attach", title: 'Attach "error-context"' }),
      after("a@5", 9),
    );
    // Act
    const actions = readActions(trace, "");
    // Assert
    expect(actions.map((a) => [a.index, a.depth, a.title])).toEqual([[3, 0, "Create page"]]);
  });

  it("test.step の中の操作は 1 段深くし、エラーの文は中の失敗した操作だけに持たせる", () => {
    // Arrange
    const trace = jsonl(
      before("a@1", 0, { method: "test.step", title: "ダイアログを開く" }),
      before("a@2", 1, { parentId: "a@1" }),
      after("a@2", 2, "Error: 押せない"),
      after("a@1", 3, "Error: 押せない"),
    );
    // Act
    const actions = readActions(trace, "");
    // Assert
    expect(actions.map((a) => [a.depth, a.failed, a.error])).toEqual([
      [0, true, null],
      [1, true, "Error: 押せない"],
    ]);
  });

  it("フィクスチャの枠だけで起きたエラーは、枠を一覧に残して示す", () => {
    // Arrange
    const trace = jsonl(before("a@1", 0, { method: "fixture", title: 'Fixture "page"' }), after("a@1", 1, "Error: 片付けに失敗"));
    // Act
    const actions = readActions(trace, "");
    // Assert
    expect(actions).toMatchObject([{ title: 'Fixture "page"', failed: true, error: "Error: 片付けに失敗" }]);
  });

  it("操作でない記録・ID や時刻の無い記録・壊れた行は飛ばす（異常系）", () => {
    // Arrange
    const trace = `${jsonl({ type: "before", startTime: 1 }, { type: "before", callId: "a@1" }, { type: "未知", callId: "a@9", startTime: 1 })}\n{壊れた行\n${jsonl(before("a@2", 5), after("a@2", 6))}`;
    // Act
    const actions = readActions(trace, "");
    // Assert
    expect(actions.map((a) => a.title)).toEqual(["Click"]);
  });

  it("空の記録は空（境界値）", () => {
    // Act / Assert
    expect(readActions("", "")).toEqual([]);
  });
});

describe("readBrowserEvents（ブラウザのエラー）", () => {
  const titles = actionTitles(jsonl(before("a@1", 0, { title: "Evaluate" }), before("a@2", 0, { title: "Click", subtitle: "locator('#btn')" })));
  // ブラウザ側の時計は、テスト側と違う（操作の ID で対応を取る）
  const libraryStarts = [
    { type: "before", callId: "a@1", startTime: 5000, class: "Frame", method: "evaluateExpression" },
    { type: "before", callId: "a@2", startTime: 6000, class: "Frame", method: "click" },
  ];

  it("コンソールの error・warning とページの例外を、起きたときの操作の名前を付けて読む（正常系）", () => {
    // Arrange
    const library = jsonl(
      ...libraryStarts,
      { type: "console", messageType: "error", text: "だめでした", location: { url: "http://localhost/a.js", lineNumber: 12 }, time: 5500 },
      { type: "console", messageType: "warning", text: "気をつけて", location: { url: "", lineNumber: 1 }, time: 6000 },
      { type: "event", method: "pageError", time: 6100, params: { error: { error: { message: "例外", stack: "Error: 例外\n    at f (a.js:1:1)", name: "Error" } } } },
    );
    // Act
    const events = readBrowserEvents([library], [], titles);
    // Assert
    expect(events).toEqual([
      { kind: "console.error", text: "だめでした (http://localhost/a.js:12)", during: "Evaluate" },
      { kind: "console.warning", text: "気をつけて", during: "Click locator('#btn')" },
      { kind: "pageerror", text: "Error: 例外\n    at f (a.js:1:1)", during: "Click locator('#btn')" },
    ]);
  });

  it("コンソールの log・info と、ほかの種類の記録・イベントは出さない", () => {
    // Arrange
    const library = jsonl(
      { type: "console", messageType: "log", text: "情報", time: 1 },
      { type: "console", messageType: "info", text: "情報", time: 2 },
      { type: "event", method: "page", params: {}, time: 3 },
      { type: "frame-snapshot", snapshot: {} },
    );
    // Act / Assert
    expect(readBrowserEvents([library], [], titles)).toEqual([]);
  });

  it("通信は、つながらなかったものと状態が 400 以上のものだけを出す（境界値：399 と 400）", () => {
    // Arrange
    const request = (url: string, response: object, time: number): object => ({
      type: "resource-snapshot",
      snapshot: { _monotonicTime: time, request: { method: "GET", url }, response },
    });
    const network = jsonl(
      request("http://localhost/ok.js", { status: 200, statusText: "OK" }, 5100),
      request("http://localhost/399", { status: 399, statusText: "" }, 5200),
      request("http://localhost/400", { status: 400, statusText: "Bad Request" }, 5300),
      request("http://localhost/aborted", { status: -1, statusText: "", _failureText: "net::ERR_FAILED" }, 6500),
    );
    // Act
    const events = readBrowserEvents([jsonl(...libraryStarts)], [network], titles);
    // Assert
    expect(events).toEqual([
      { kind: "request", text: "GET http://localhost/400 → 400 Bad Request", during: "Evaluate" },
      { kind: "request", text: "GET http://localhost/aborted → net::ERR_FAILED", during: "Click locator('#btn')" },
    ]);
  });

  it("最初の操作より前・時刻の無いものは、操作の名前を付けない（境界値）", () => {
    // Arrange
    const library = jsonl(...libraryStarts, { type: "console", messageType: "error", text: "早い", time: 4999 }, { type: "console", messageType: "error", text: "時刻なし" });
    // Act
    const events = readBrowserEvents([library], [], titles);
    // Assert
    expect(events).toEqual([
      { kind: "console.error", text: "早い", during: "" },
      { kind: "console.error", text: "時刻なし", during: "" },
    ]);
  });

  it("形の違う記録（中身の欠けた例外・通信）でも落ちない（異常系）", () => {
    // Arrange
    const library = jsonl({ type: "event", method: "pageError", params: "文字列" }, { type: "console", messageType: "error" });
    const network = jsonl({ type: "resource-snapshot", snapshot: "文字列" }, { type: "resource-snapshot", snapshot: { response: { status: 500 } } });
    // Act
    const events = readBrowserEvents([library], [network], new Map());
    // Assert
    expect(events.map((e) => [e.kind, e.text])).toEqual([
      ["pageerror", "(中身が無い)"],
      ["console.error", ""],
      ["request", "  → 500"],
    ]);
  });
});

describe("readTestTitle（テストの名前）", () => {
  it("名前のある最初の context-options から読む", () => {
    // Arrange：1 つ目（ブラウザへの接続）にも名前があることがあるが、同じ名前
    const library = [jsonl({ type: "context-options", origin: "library" }), jsonl({ type: "context-options", title: "a.spec.ts:4 › F-1: 開ける" })];
    // Act / Assert
    expect(readTestTitle(library)).toBe("a.spec.ts:4 › F-1: 開ける");
  });

  it("名前が無ければ空（境界値）", () => {
    // Act / Assert
    expect(readTestTitle([])).toBe("");
  });
});

describe("pickErrorContext（error-context.md から出す部分）", () => {
  const markdown = [
    "# Instructions",
    "",
    "- Explain why",
    "",
    "# Test info",
    "",
    "- Name: a.spec.ts >> 開ける",
    "",
    "# Page snapshot",
    "",
    "```yaml",
    "- button \"保存\"",
    "# これは見出しでない",
    "```",
    "",
    "# Test source",
    "",
    "```ts",
    "  1 | // # Test info と書いたソース",
    "# Test info",
    "```",
  ].join("\n");

  it("AI への指示とテストのソースの節を除き、ほかの節を残す（囲みの中の # は見出しにしない）", () => {
    // Act
    const picked = pickErrorContext(markdown, 10_000);
    // Assert
    expect(picked).toBe(["# Test info", "", "- Name: a.spec.ts >> 開ける", "", "# Page snapshot", "", "```yaml", '- button "保存"', "# これは見出しでない", "```"].join("\n"));
  });

  it("上限を超えたら切り、切ったことを示す", () => {
    // Act
    const picked = pickErrorContext(markdown, 11);
    // Assert
    expect(picked).toMatch(/^# Test info…（残り \d+ 文字を省略）$/);
  });

  it("空の文書は空（境界値）", () => {
    // Act / Assert
    expect(pickErrorContext("", 100)).toBe("");
  });
});

describe("formatActions（操作の一覧の行）", () => {
  it("番号・始まり・かかった時間・字下げ・場所を並べ、失敗した操作に ✗ とエラーの文を付ける", () => {
    // Arrange
    const actions = [
      action(3, { title: "ダイアログを開く", startMs: 1200, durationMs: 80, location: "e2e/a.spec.ts:9" }),
      action(4, { depth: 1, title: "Click", startMs: 1300, durationMs: null, failed: true, error: "Error: 押せない\n  - waiting\n" }),
    ];
    // Act
    const lines = formatActions(actions, DEFAULT_LIMITS);
    // Assert
    expect(lines).toEqual([
      "    #3  +1.200s     80ms  ダイアログを開く  (e2e/a.spec.ts:9)",
      "✗   #4  +1.300s     終わらず    Click",
      "        | Error: 押せない",
      "        |   - waiting",
    ]);
  });

  it("上限ちょうどは省かず、1 件超えたら最初の 1 件を省いて件数を示す（境界値）", () => {
    // Arrange
    const limits = { ...DEFAULT_LIMITS, actions: 2 };
    // Act
    const exact = formatActions([action(1), action(2)], limits);
    const over = formatActions([action(1), action(2), action(3)], limits);
    // Assert
    expect(exact).toHaveLength(2);
    expect(over[0]).toBe("  （前の 1 件を省略。最後の 2 件）");
    expect(over.slice(1).map((line) => /#(\d+)/.exec(line)?.[1])).toEqual(["2", "3"]);
  });

  it("長いエラーは上限の行で切り、残りの行数を示す", () => {
    // Arrange
    const limits = { ...DEFAULT_LIMITS, errorLines: 2 };
    // Act
    const lines = formatActions([action(1, { failed: true, error: "1\n2\n3\n4" })], limits);
    // Assert
    expect(lines.slice(1)).toEqual(["        | 1", "        | 2", "        | …（残り 2 行を省略）"]);
  });

  it("操作が無ければ、そのことを示す（境界値）", () => {
    // Act / Assert
    expect(formatActions([], DEFAULT_LIMITS)).toEqual(["  (操作の記録が無い)"]);
  });
});

describe("formatBrowserEvents（ブラウザのエラーの行）", () => {
  const event = (text: string, during = ""): BrowserEvent => ({ kind: "console.error", text, during });

  it("種類・中身・起きたときの操作を並べ、複数行の中身は字下げする", () => {
    // Act
    const lines = formatBrowserEvents([event("Error: x\n    at f", "Click"), event("y")], DEFAULT_LIMITS);
    // Assert
    expect(lines).toEqual(["  [console.error] Error: x\n          at f  ← 「Click」のとき", "  [console.error] y"]);
  });

  it("件数と 1 件の長さを上限で切り、省いたことを示す（境界値）", () => {
    // Arrange
    const limits = { ...DEFAULT_LIMITS, events: 1, eventChars: 3 };
    // Act
    const lines = formatBrowserEvents([event("古い"), event("abcdef")], limits);
    // Assert
    expect(lines).toEqual(["  （前の 1 件を省略。最後の 1 件）", "  [console.error] abc…（残り 3 文字を省略）"]);
  });

  it("1 つも無ければ「無し」（境界値）", () => {
    // Act / Assert
    expect(formatBrowserEvents([], DEFAULT_LIMITS)).toEqual(["  (無し)"]);
  });
});

describe("summarizeFailure（1 つのテストの要約）", () => {
  it("決まった区切りで囲み、テストの名前・操作の一覧・ブラウザのエラー・失敗時の画面を出す（正常系）", () => {
    // Arrange
    const trace = {
      test: jsonl(before("a@1", 0, { subtitle: "locator('#btn')" }), after("a@1", 30, "Error: 押せない")),
      library: [jsonl({ type: "context-options", title: "a.spec.ts:4 › F-1: 押せる" }, { type: "before", callId: "a@1", startTime: 900 }, { type: "console", messageType: "error", text: "だめ", time: 901 })],
      network: [""],
    };
    // Act
    const summary = summarizeFailure({ directory: "a-F-1-chromium", trace, errorContext: "# Instructions\n\n- x\n\n# Page snapshot\n\n```yaml\n- button\n```", notes: [] }, "/repo/web", DEFAULT_LIMITS);
    // Assert
    expect(summary.split("\n")).toEqual([
      `${BEGIN_MARK}a.spec.ts:4 › F-1: 押せる=====`,
      "結果のフォルダ: test-results/a-F-1-chromium",
      "",
      "--- 操作の一覧（番号  始まり  かかった時間  操作  (場所)。✗ は失敗） ---",
      "✗   #1  +0.000s     30ms  Click locator('#btn')",
      "        | Error: 押せない",
      "",
      "--- ブラウザのエラー（コンソールの error・warning、ページの例外、失敗した通信） ---",
      "  [console.error] だめ  ← 「Click locator('#btn')」のとき",
      "",
      "--- 失敗したときの画面（error-context.md） ---",
      "# Page snapshot",
      "",
      "```yaml",
      "- button",
      "```",
      END_MARK,
    ]);
  });

  it("trace も error-context.md も無いときは、フォルダの名前を題にし、無いことと注意を示す（異常系）", () => {
    // Act
    const summary = summarizeFailure({ directory: "a-chromium", trace: null, errorContext: null, notes: ["trace.zip を読めない: 壊れている"] }, "/repo/web", DEFAULT_LIMITS);
    // Assert
    expect(summary.split("\n")).toEqual([
      `${BEGIN_MARK}a-chromium=====`,
      "結果のフォルダ: test-results/a-chromium",
      "注意: trace.zip を読めない: 壊れている",
      "",
      "--- 操作の一覧（番号  始まり  かかった時間  操作  (場所)。✗ は失敗） ---",
      "  (trace.zip が無いので、操作は分からない)",
      "",
      "--- ブラウザのエラー（コンソールの error・warning、ページの例外、失敗した通信） ---",
      "  (trace.zip が無いので、分からない)",
      "",
      "--- 失敗したときの画面（error-context.md） ---",
      "  (error-context.md が無い)",
      END_MARK,
    ]);
  });

  it("trace が無く error-context.md があるときは、その中のテストの名前を題にする", () => {
    // Act
    const summary = summarizeFailure({ directory: "a-chromium", trace: null, errorContext: "# Test info\n\n- Name: a.spec.ts >> F-1: 押せる\n- Location: e2e/a.spec.ts:4:1", notes: [] }, "", DEFAULT_LIMITS);
    // Assert
    expect(summary.split("\n")[0]).toBe(`${BEGIN_MARK}a.spec.ts >> F-1: 押せる=====`);
  });

  it("中身が壊れた trace（JSON でない）でも、要約を作る（異常系）", () => {
    // Act
    const summary = summarizeFailure({ directory: "a-chromium", trace: { test: "壊れた\n中身", library: ["{"], network: [] }, errorContext: null, notes: [] }, "", DEFAULT_LIMITS);
    // Assert
    expect(summary).toContain("  (操作の記録が無い)");
    expect(summary).toContain("  (無し)");
  });
});
