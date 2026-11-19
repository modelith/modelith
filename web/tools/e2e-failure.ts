// 失敗した e2e のテストを、文字の要約にする（CI のログで読むためのもの。docs/development/testing.md の「失敗したときの要約」）。
// 入力は Playwright の操作の記録（trace.zip の中の JSON Lines）と error-context.md。ファイルを読むのは e2e-failure-cli.ts。
// 記録の形は Playwright の版で変わりうる（確かめた版は web/package.json の @playwright/test）。知らない形の記録は飛ばす。

/** 1 つのテストの trace.zip から取り出した中身（どれも JSON Lines のテキスト）。 */
export type TraceTexts = {
  /** `test.trace`：テストから見た操作（題・時間・エラー）。無ければ空文字 */
  test: string;
  /** `<番号>-trace.trace`：ブラウザ側の記録（コンソール・ページの例外・操作の時刻） */
  library: string[];
  /** `<番号>-trace.network`：通信の記録 */
  network: string[];
};

/** 要約に出す 1 つの操作。 */
export type Action = {
  /** 記録の中の順番（1 始まり。絞り込む前の番号） */
  index: number;
  /** 入れ子の深さ（`test.step` などの中なら 1 以上） */
  depth: number;
  /** 操作の名前と対象（例：`Click locator('#btnExport')`） */
  title: string;
  /** 始まった時刻（最初の記録からのミリ秒） */
  startMs: number;
  /** かかった時間（ミリ秒）。終わりの記録が無ければ null */
  durationMs: number | null;
  /** 呼び出した場所（`e2e/x.spec.ts:12`）。分からなければ空文字 */
  location: string;
  /** 失敗したか（中の操作の失敗も含む） */
  failed: boolean;
  /** この操作で起きたエラーの文（色の制御文字は除く）。中の操作に同じエラーがあるときは、中の操作だけに持たせる */
  error: string | null;
};

/** ブラウザで起きたこと（コンソールの error・warning、ページの例外、失敗した通信）。 */
export type BrowserEvent = {
  /** 種類 */
  kind: "console.error" | "console.warning" | "pageerror" | "request";
  /** 中身 */
  text: string;
  /** そのとき始まっていた最後の操作の名前。分からなければ空文字 */
  during: string;
};

/** 要約の長さの上限。 */
export type Limits = {
  /** 操作の一覧に出す件数（最後からこの件数） */
  actions: number;
  /** 1 つのエラーの行数 */
  errorLines: number;
  /** ブラウザのエラーの件数（最後からこの件数） */
  events: number;
  /** ブラウザのエラー 1 件の文字数 */
  eventChars: number;
  /** error-context.md の文字数 */
  contextChars: number;
};

/** 既定の上限。失敗の直前が読め、ログが長くなりすぎない大きさ。 */
export const DEFAULT_LIMITS: Limits = { actions: 40, errorLines: 40, events: 50, eventChars: 500, contextChars: 24_000 };

/** 要約の始まりと終わりの区切り（ログから探すときの目印）。 */
export const BEGIN_MARK = "=====BEGIN E2E FAILURE: ";
export const END_MARK = "=====END E2E FAILURE=====";

type Json = Record<string, unknown>;

/**
 * 値がオブジェクト（配列でない）かを確かめる。
 *
 * @param value 調べる値
 * @returns オブジェクトなら true
 * @example
 * isObject({ a: 1 }) // → true
 * isObject([1])      // → false
 * isObject(null)     // → false
 */
function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 文字列ならそのまま、そうでなければ空文字を返す。
 *
 * @param value 調べる値
 * @returns 文字列。文字列でなければ ""
 * @example
 * text("a") // → "a"
 * text(1)   // → ""
 */
function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * JSON Lines を読む。JSON として読めない行と、オブジェクトでない行は飛ばす。
 *
 * @param lines 1 行に 1 つの JSON が入ったテキスト
 * @returns 読めたオブジェクト（元の順）
 * @example
 * parseJsonLines('{"a":1}\n壊れた行\n[1]\n{"b":2}') // → [{ a: 1 }, { b: 2 }]
 * parseJsonLines("")                               // → []
 */
export function parseJsonLines(lines: string): Json[] {
  const records: Json[] = [];
  for (const line of lines.split("\n")) {
    if (!line.trim()) continue;
    try {
      const value: unknown = JSON.parse(line);
      if (isObject(value)) records.push(value);
    } catch {
      // 知らない形・途中で切れた行は飛ばす（要約は、読めた分だけで作る）
    }
  }
  return records;
}

/**
 * 端末の色の制御文字（ANSI のエスケープ）を除く。
 *
 * @param value 元の文字列
 * @returns 制御文字を除いた文字列
 * @example
 * stripAnsi("\u001b[31m赤\u001b[39m") // → "赤"
 * stripAnsi("そのまま")               // → "そのまま"
 */
export function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*[A-Za-z]/g, "");
}

/**
 * 長い文字列を上限で切り、切ったことを末尾に示す。
 *
 * @param value 元の文字列
 * @param max 残す文字数（UTF-16 の単位）
 * @returns 上限以内ならそのまま。超えるなら、先頭 max 文字と「…（残り N 文字を省略）」
 * @example
 * clip("abcdef", 3) // → "abc…（残り 3 文字を省略）"
 * clip("abc", 3)    // → "abc"
 */
export function clip(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}…（残り ${value.length - max} 文字を省略）`;
}

/**
 * 操作の記録から、呼び出した場所を作る。
 *
 * @param stack 記録の `stack`（`{ file, line }` の配列。先頭が操作を呼んだ場所）
 * @param root 取り除くパスの先頭（e2e を動かしたディレクトリ。末尾の `/` は付けない）
 * @returns `ファイル:行`。分からなければ ""
 * @example
 * locationOf([{ file: "/repo/web/e2e/a.spec.ts", line: 12 }], "/repo/web") // → "e2e/a.spec.ts:12"
 * locationOf([], "/repo/web")                                              // → ""
 */
function locationOf(stack: unknown, root: string): string {
  const frame: unknown = Array.isArray(stack) ? stack[0] : undefined;
  if (!isObject(frame) || typeof frame["file"] !== "string" || typeof frame["line"] !== "number") return "";
  const file = frame["file"].startsWith(`${root}/`) ? frame["file"].slice(root.length + 1) : frame["file"];
  return `${file}:${frame["line"]}`;
}

/**
 * 操作の名前を作る（題・対象・主な引数）。
 *
 * @param before 操作の始まりの記録（`title`・`subtitle`・`params`）
 * @returns 名前。題が無ければ `method`、それも無ければ "(名前の無い操作)"
 * @example
 * titleOf({ title: "Click", subtitle: "locator('#a')", params: { locator: "locator('#a')" } }) // → "Click locator('#a')"
 * titleOf({ title: "Fill", params: { value: "x" } })                                          // → 'Fill value="x"'
 * titleOf({})                                                                                 // → "(名前の無い操作)"
 */
function titleOf(before: Json): string {
  const parts = [text(before["title"]) || text(before["method"]) || "(名前の無い操作)"];
  const subtitle = text(before["subtitle"]);
  if (subtitle) parts.push(subtitle);
  const params = isObject(before["params"]) ? before["params"] : {};
  for (const [key, value] of Object.entries(params)) {
    // 対象（subtitle と同じもの）は繰り返さない。値は、文字列・数・真偽だけを出す
    if (!["string", "number", "boolean"].includes(typeof value) || value === subtitle) continue;
    parts.push(`${key}=${clip(JSON.stringify(value), 80)}`);
  }
  return parts.join(" ");
}

/** 操作として一覧に出さない種類（準備と後始末の枠。中でエラーが起きたときだけ出す）。 */
const FRAME_METHODS = new Set(["hook", "fixture", "test.attach"]);

/**
 * テスト側の記録（test.trace）から、操作の一覧を作る。
 * フック・フィクスチャの枠と、設定を読むだけの記録は、その中でしかエラーが起きていないときを除いて省く。
 *
 * @param testTrace test.trace の中身（JSON Lines）
 * @param root 場所から取り除くパスの先頭（e2e を動かしたディレクトリ）
 * @returns 操作（始まった順）。記録が無ければ空
 * @example
 * readActions('{"type":"before","callId":"a@1","startTime":10,"method":"pw:api","title":"Click","stack":[]}\n{"type":"after","callId":"a@1","endTime":25}', "")
 * // → [{ index: 1, depth: 0, title: "Click", startMs: 0, durationMs: 15, location: "", failed: false, error: null }]
 * readActions("") // → []
 */
export function readActions(testTrace: string, root: string): Action[] {
  const records = parseJsonLines(testTrace);
  const befores = records.filter((r) => r["type"] === "before" && typeof r["callId"] === "string" && typeof r["startTime"] === "number");
  const afters = new Map(records.filter((r) => r["type"] === "after").map((r) => [text(r["callId"]), r]));
  const origin = Math.min(...befores.map((r) => r["startTime"] as number));
  const errorOf = (callId: string): string | null => {
    const error = afters.get(callId)?.["error"];
    return isObject(error) ? stripAnsi(text(error["message"])) || "(エラーの文が無い)" : null;
  };
  const failedIds = new Set(befores.map((r) => text(r["callId"])).filter((id) => errorOf(id) !== null));
  const parentsWithFailedChild = new Set(befores.filter((r) => failedIds.has(text(r["callId"]))).map((r) => text(r["parentId"])));

  const kept = new Map<string, number>(); // callId → 深さ
  const actions: Action[] = [];
  befores.forEach((before, i) => {
    const callId = text(before["callId"]);
    const ownsError = failedIds.has(callId) && !parentsWithFailedChild.has(callId);
    const isFrame = FRAME_METHODS.has(text(before["method"])) || before["group"] === "configuration";
    if (isFrame && !ownsError) return;
    const parentDepth = kept.get(text(before["parentId"]));
    const depth = parentDepth === undefined ? 0 : parentDepth + 1;
    kept.set(callId, depth);
    const endTime = afters.get(callId)?.["endTime"];
    const startTime = before["startTime"] as number;
    actions.push({
      index: i + 1,
      depth,
      title: titleOf(before),
      startMs: Math.round(startTime - origin),
      durationMs: typeof endTime === "number" ? Math.round(endTime - startTime) : null,
      location: locationOf(before["stack"], root),
      failed: failedIds.has(callId),
      error: ownsError ? errorOf(callId) : null,
    });
  });
  return actions;
}

/**
 * テスト側の記録から、操作の ID と名前の対応を作る（ブラウザのエラーが、どの操作のときに起きたかを示すため）。
 *
 * @param testTrace test.trace の中身（JSON Lines）
 * @returns 操作の ID（callId）→ 名前
 * @example
 * actionTitles('{"type":"before","callId":"a@1","title":"Click","subtitle":"locator(\'#a\')"}') // → Map { "a@1" → "Click locator('#a')" }
 * actionTitles("")                                                                              // → 空の Map
 */
export function actionTitles(testTrace: string): Map<string, string> {
  const befores = parseJsonLines(testTrace).filter((r) => r["type"] === "before" && typeof r["callId"] === "string");
  return new Map(befores.map((r) => [r["callId"] as string, titleOf(r)]));
}

/**
 * ブラウザ側の記録 1 件を、要約に出す形にする。
 *
 * @param record ブラウザ側の記録（`console`・`event`）か通信の記録（`resource-snapshot`）
 * @returns 種類・中身・起きた時刻（ブラウザ側の時計のミリ秒。無ければ null）。要約に出さない記録は null
 * @example
 * toBrowserEvent({ type: "console", messageType: "error", text: "だめ", time: 5 }) // → { kind: "console.error", text: "だめ", time: 5 }
 * toBrowserEvent({ type: "console", messageType: "log", text: "情報" })            // → null
 */
function toBrowserEvent(record: Json): { kind: BrowserEvent["kind"]; text: string; time: number | null } | null {
  const time = typeof record["time"] === "number" ? record["time"] : null;
  if (record["type"] === "console") {
    const level = record["messageType"];
    if (level !== "error" && level !== "warning") return null;
    const location = isObject(record["location"]) ? record["location"] : {};
    const url = text(location["url"]);
    return { kind: `console.${level}`, text: text(record["text"]) + (url ? ` (${url}:${String(location["lineNumber"] ?? "")})` : ""), time };
  }
  if (record["type"] === "event" && record["method"] === "pageError") {
    const params = isObject(record["params"]) ? record["params"] : {};
    const outer = isObject(params["error"]) ? params["error"] : {};
    const error = isObject(outer["error"]) ? outer["error"] : {};
    return { kind: "pageerror", text: text(error["stack"]) || text(error["message"]) || text(outer["value"]) || "(中身が無い)", time };
  }
  if (record["type"] === "resource-snapshot" && isObject(record["snapshot"])) {
    const snapshot = record["snapshot"];
    const request = isObject(snapshot["request"]) ? snapshot["request"] : {};
    const response = isObject(snapshot["response"]) ? snapshot["response"] : {};
    const failure = text(response["_failureText"]);
    const status = typeof response["status"] === "number" ? response["status"] : 0;
    if (!failure && status < 400) return null;
    const result = failure || `${status} ${text(response["statusText"])}`.trim();
    const startedAt = typeof snapshot["_monotonicTime"] === "number" ? snapshot["_monotonicTime"] : null;
    return { kind: "request", text: `${text(request["method"])} ${text(request["url"])} → ${result}`, time: startedAt };
  }
  return null;
}

/**
 * ブラウザ側の記録から、コンソールの error・warning、ページの例外、失敗した通信（状態が 400 以上か、つながらなかったもの）を集める。
 * それぞれに、起きたときに始まっていた最後の操作の名前を付ける（ブラウザ側の時計で比べる）。
 *
 * @param library `<番号>-trace.trace` の中身（JSON Lines）
 * @param network `<番号>-trace.network` の中身（JSON Lines）
 * @param titles 操作の ID → 名前（actionTitles の結果）
 * @returns ブラウザで起きたこと（起きた順。時刻の無いものは最後）
 * @example
 * readBrowserEvents(['{"type":"console","messageType":"error","text":"だめ","time":5}'], [], new Map())
 * // → [{ kind: "console.error", text: "だめ", during: "" }]
 * readBrowserEvents([], [], new Map()) // → []
 */
export function readBrowserEvents(library: string[], network: string[], titles: Map<string, string>): BrowserEvent[] {
  const libraryRecords = library.flatMap(parseJsonLines);
  const starts = libraryRecords
    .filter((r) => r["type"] === "before" && typeof r["startTime"] === "number" && titles.has(text(r["callId"])))
    .map((r) => ({ time: r["startTime"] as number, title: titles.get(text(r["callId"])) ?? "" }))
    .sort((a, b) => a.time - b.time);
  const found = [...libraryRecords, ...network.flatMap(parseJsonLines)].flatMap((r) => toBrowserEvent(r) ?? []);
  return found
    .sort((a, b) => (a.time ?? Infinity) - (b.time ?? Infinity))
    .map(({ kind, text: body, time }) => ({
      kind,
      text: body,
      during: time === null ? "" : (starts.filter((s) => s.time <= time).at(-1)?.title ?? ""),
    }));
}

/**
 * ブラウザ側の記録から、テストの名前を取り出す。
 *
 * @param library `<番号>-trace.trace` の中身（JSON Lines）
 * @returns 最初に見つかった名前（`a.spec.ts:4 › テスト名`）。無ければ ""
 * @example
 * readTestTitle(['{"type":"context-options","title":"a.spec.ts:4 › 開ける"}']) // → "a.spec.ts:4 › 開ける"
 * readTestTitle([])                                                           // → ""
 */
export function readTestTitle(library: string[]): string {
  for (const record of library.flatMap(parseJsonLines)) {
    if (record["type"] === "context-options" && text(record["title"])) return text(record["title"]);
  }
  return "";
}

/**
 * error-context.md から、ログに出す部分を選ぶ。
 * AI への指示（Instructions）と、テストのソース（Test source。リポジトリにある）の節は除き、上限で切る。
 *
 * @param markdown error-context.md の中身
 * @param maxChars 残す文字数
 * @returns テストの情報・エラー・ページのスナップショットの節。切ったときは末尾にそのことを示す
 * @example
 * pickErrorContext("# Instructions\n\n- 直して\n\n# Test info\n\n- Name: a\n\n# Test source\n\n```ts\n1 | x\n```", 100)
 * // → "# Test info\n\n- Name: a"
 * pickErrorContext("", 100) // → ""
 */
export function pickErrorContext(markdown: string, maxChars: number): string {
  const dropped = new Set(["# Instructions", "# Test source"]);
  const kept: string[] = [];
  let keep = true;
  let inFence = false;
  for (const line of markdown.split("\n")) {
    // 節の見出しは、コードの囲みの外にあるものだけ（スナップショットやソースの中の「# …」は見出しでない）
    if (line.startsWith("```")) inFence = !inFence;
    else if (!inFence && /^# /.test(line)) keep = !dropped.has(line.trim());
    if (keep) kept.push(line);
  }
  return clip(kept.join("\n").trim(), maxChars);
}

/**
 * ミリ秒を、桁をそろえた秒にする。
 *
 * @param ms ミリ秒
 * @returns 小数 3 桁の秒
 * @example
 * seconds(1234) // → "1.234s"
 * seconds(0)    // → "0.000s"
 */
function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(3)}s`;
}

/**
 * 操作の一覧を行にする。長いときは最後の数件に絞り、省いた件数を先頭に示す。
 *
 * @param actions 操作（始まった順）
 * @param limits 上限（`actions`・`errorLines` を使う）
 * @returns 行。失敗した操作は先頭に ✗ を付け、エラーの文を下に字下げして続ける。操作が無ければ、そのことを示す 1 行
 * @example
 * formatActions([{ index: 3, depth: 0, title: "Click", startMs: 1200, durationMs: 80, location: "e2e/a.spec.ts:9", failed: false, error: null }], DEFAULT_LIMITS)
 * // → ["    #3  +1.200s     80ms  Click  (e2e/a.spec.ts:9)"]
 * formatActions([], DEFAULT_LIMITS) // → ["  (操作の記録が無い)"]
 */
export function formatActions(actions: Action[], limits: Limits): string[] {
  if (actions.length === 0) return ["  (操作の記録が無い)"];
  const omitted = Math.max(0, actions.length - limits.actions);
  const lines = omitted > 0 ? [`  （前の ${omitted} 件を省略。最後の ${limits.actions} 件）`] : [];
  for (const action of actions.slice(omitted)) {
    const took = action.durationMs === null ? "終わらず" : `${action.durationMs}ms`;
    const where = action.location ? `  (${action.location})` : "";
    const indent = "  ".repeat(action.depth);
    lines.push(`${action.failed ? "✗" : " "} ${`#${action.index}`.padStart(4)}  +${seconds(action.startMs)}  ${took.padStart(7)}  ${indent}${action.title}${where}`);
    if (action.error === null) continue;
    const errorLines = action.error.trimEnd().split("\n");
    for (const line of errorLines.slice(0, limits.errorLines)) lines.push(`        | ${line}`);
    if (errorLines.length > limits.errorLines) lines.push(`        | …（残り ${errorLines.length - limits.errorLines} 行を省略）`);
  }
  return lines;
}

/**
 * ブラウザで起きたことを行にする。多いときは最後の数件に絞り、省いた件数を先頭に示す。
 *
 * @param events ブラウザで起きたこと（起きた順）
 * @param limits 上限（`events`・`eventChars` を使う）
 * @returns 行。1 つも無ければ、そのことを示す 1 行
 * @example
 * formatBrowserEvents([{ kind: "pageerror", text: "Error: x", during: "Click" }], DEFAULT_LIMITS) // → ["  [pageerror] Error: x  ← 「Click」のとき"]
 * formatBrowserEvents([], DEFAULT_LIMITS)                                                          // → ["  (無し)"]
 */
export function formatBrowserEvents(events: BrowserEvent[], limits: Limits): string[] {
  if (events.length === 0) return ["  (無し)"];
  const omitted = Math.max(0, events.length - limits.events);
  const lines = omitted > 0 ? [`  （前の ${omitted} 件を省略。最後の ${limits.events} 件）`] : [];
  for (const event of events.slice(omitted)) {
    const body = clip(event.text, limits.eventChars).replaceAll("\n", "\n      ");
    lines.push(`  [${event.kind}] ${body}${event.during ? `  ← 「${event.during}」のとき` : ""}`);
  }
  return lines;
}

/** 1 つの失敗したテストについて、集めたもの。 */
export type Failure = {
  /** テストの結果のフォルダの名前（`test-results/` の下。プロジェクトの名前を含む） */
  directory: string;
  /** trace.zip の中身。trace が無い・読めないときは null */
  trace: TraceTexts | null;
  /** error-context.md の中身。無ければ null */
  errorContext: string | null;
  /** 読めなかったものの説明（「trace.zip を展開できない: …」など） */
  notes: string[];
};

/**
 * 1 つの失敗したテストの要約を作る。
 *
 * @param failure 集めたもの（trace の中身・error-context.md・読めなかったものの説明）
 * @param root 場所から取り除くパスの先頭（e2e を動かしたディレクトリ）
 * @param limits 長さの上限
 * @returns 区切り（BEGIN_MARK 〜 END_MARK）で囲んだ要約。末尾に改行は付けない
 * @example
 * summarizeFailure({ directory: "a-chromium", trace: null, errorContext: null, notes: [] }, "/repo/web", DEFAULT_LIMITS)
 * // → "=====BEGIN E2E FAILURE: a-chromium=====\n結果のフォルダ: test-results/a-chromium\n\n--- 操作の一覧 …\n=====END E2E FAILURE====="
 */
export function summarizeFailure(failure: Failure, root: string, limits: Limits): string {
  const { directory, trace, errorContext, notes } = failure;
  // 名前は trace から。無ければ error-context.md の「- Name:」、それも無ければフォルダの名前
  const title = (trace ? readTestTitle(trace.library) : "") || (/^- Name: (.+)$/m.exec(errorContext ?? "")?.[1] ?? "");
  const lines = [`${BEGIN_MARK}${title || directory}=====`, `結果のフォルダ: test-results/${directory}`];
  for (const note of notes) lines.push(`注意: ${note}`);

  lines.push("", "--- 操作の一覧（番号  始まり  かかった時間  操作  (場所)。✗ は失敗） ---");
  if (trace) lines.push(...formatActions(readActions(trace.test, root), limits));
  else lines.push("  (trace.zip が無いので、操作は分からない)");

  lines.push("", "--- ブラウザのエラー（コンソールの error・warning、ページの例外、失敗した通信） ---");
  if (trace) lines.push(...formatBrowserEvents(readBrowserEvents(trace.library, trace.network, actionTitles(trace.test)), limits));
  else lines.push("  (trace.zip が無いので、分からない)");

  lines.push("", "--- 失敗したときの画面（error-context.md） ---");
  lines.push(errorContext === null ? "  (error-context.md が無い)" : pickErrorContext(errorContext, limits.contextChars));
  lines.push(END_MARK);
  return lines.join("\n");
}
