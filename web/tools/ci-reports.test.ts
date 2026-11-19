// 失敗した CI のテスト結果のページを置き場所に並べるための判断（置く成果物・大きさ・掃除・一覧の HTML・PR へのコメント）。
import { describe, expect, it } from "vitest";
import {
  buildMeta,
  checkReport,
  COMMENT_MARKER,
  DEFAULT_LIMITS,
  escapeHtml,
  findComment,
  newestFirst,
  parseMeta,
  pickArtifact,
  pickPullRequest,
  readRun,
  renderComment,
  renderIndex,
  runKey,
  selectRunsToRemove,
  type Limits,
  type RunEntry,
  type RunMeta,
  type WorkflowRun,
} from "./ci-reports";

const SHA = "0123456789abcdef0123456789abcdef01234567";
const OTHER_SHA = "fedcba9876543210fedcba9876543210fedcba98";

/**
 * メタデータを作る（指定しない項目は、正しい形の既定の値）。
 *
 * @param runId 実行の ID
 * @param rest 変える項目
 * @returns メタデータ
 */
const meta = (runId: number, rest: Partial<RunMeta> = {}): RunMeta => {
  const attempt = rest.attempt ?? 1;
  return {
    key: runKey(runId, attempt),
    runId,
    attempt,
    repository: "modelith/modelith",
    branch: "fix/a",
    sha: SHA,
    pr: null,
    event: "pull_request",
    startedAt: "2026-11-19T01:02:03Z",
    publishedAt: "2026-11-19T02:00:00Z",
    bytes: 100,
    pages: ["e2e/index.html"],
    ...rest,
  };
};

/**
 * GitHub の API の「ワークフローの実行」の答えを作る。
 *
 * @param rest 変える項目
 * @returns API の答えの形
 */
const apiRun = (rest: object = {}): object => ({
  id: 5,
  run_attempt: 2,
  head_branch: "fix/a",
  head_sha: SHA,
  event: "pull_request",
  run_started_at: "2026-11-19T01:02:03Z",
  repository: { full_name: "modelith/modelith" },
  pull_requests: [],
  ...rest,
});

/**
 * 取り出した実行を作る。
 *
 * @param rest 変える項目
 * @returns 実行
 */
const workflowRun = (rest: Partial<WorkflowRun> = {}): WorkflowRun => ({
  runId: 5,
  attempt: 2,
  repository: "modelith/modelith",
  branch: "fix/a",
  sha: SHA,
  event: "pull_request",
  startedAt: "2026-11-19T01:02:03Z",
  pullRequests: [],
  ...rest,
});

/**
 * コミットに結び付いた PR（API の答えの 1 つ）を作る。
 *
 * @param number PR の番号
 * @param rest 変える項目
 * @returns API の答えの形
 */
const associatedPull = (number: number, rest: object = {}): object => ({
  number,
  state: "open",
  head: { sha: SHA },
  base: { repo: { full_name: "modelith/modelith" } },
  ...rest,
});

/**
 * 成果物の一覧（API の答え）を作る。
 *
 * @param artifacts 成果物
 * @returns API の答えの形
 */
const artifactList = (...artifacts: object[]): object => ({ total_count: artifacts.length, artifacts });

/**
 * 成果物 test-reports を作る。
 *
 * @param id 成果物の ID
 * @param rest 変える項目
 * @returns API の答えの 1 つ
 */
const reports = (id: number, rest: object = {}): object => ({
  id,
  name: "test-reports",
  expired: false,
  size_in_bytes: 1000,
  created_at: "2026-11-19T01:30:00Z",
  ...rest,
});

/** check ジョブが失敗した実行のジョブの一覧。 */
const FAILED_JOBS = { jobs: [{ name: "conventions", conclusion: "success" }, { name: "check", conclusion: "failure" }] };

/**
 * 上限を作る（指定しない項目は既定）。
 *
 * @param rest 変える項目
 * @returns 上限
 */
const limits = (rest: Partial<Limits>): Limits => ({ ...DEFAULT_LIMITS, ...rest });

/**
 * フォルダの一覧を作る（フォルダの名前はメタデータの key）。
 *
 * @param metas メタデータ
 * @returns フォルダの一覧
 */
const entries = (...metas: RunMeta[]): RunEntry[] => metas.map((m) => ({ directory: m.key, meta: m }));

describe("escapeHtml（HTML のエスケープ）", () => {
  it("特別な文字が無ければ、そのまま返す（正常系）", () => {
    // Arrange
    const text = "feat/kerml-parser";
    // Act
    const escaped = escapeHtml(text);
    // Assert
    expect(escaped).toBe("feat/kerml-parser");
  });

  it("空文字は空文字（境界値）", () => {
    // Arrange
    const text = "";
    // Act
    const escaped = escapeHtml(text);
    // Assert
    expect(escaped).toBe("");
  });

  it("タグ・属性を作る 5 つの文字を、すべて文字参照にする（異常系：タグを入れようとする文字列）", () => {
    // Arrange
    const text = `<img src=x onerror="a&b('c')">`;
    // Act
    const escaped = escapeHtml(text);
    // Assert
    expect(escaped).toBe("&lt;img src=x onerror=&quot;a&amp;b(&#39;c&#39;)&quot;&gt;");
  });

  it("すでに文字参照の形でも、もう一度エスケープする（& を先に変える）", () => {
    // Arrange
    const text = "&lt;";
    // Act
    const escaped = escapeHtml(text);
    // Assert
    expect(escaped).toBe("&amp;lt;");
  });
});

describe("readRun（API の実行から、使う項目を取り出す）", () => {
  it("正しい形なら、項目を取り出す（正常系）", () => {
    // Arrange
    const value = apiRun();
    // Act
    const run = readRun(value);
    // Assert
    expect(run).toEqual(workflowRun());
  });

  it("結び付いた PR は、head の SHA が実行と同じものだけを取る", () => {
    // Arrange
    const value = apiRun({ pull_requests: [{ number: 3, head: { sha: OTHER_SHA } }, { number: 12, head: { sha: SHA } }, { number: "x", head: { sha: SHA } }] });
    // Act
    const run = readRun(value);
    // Assert
    expect(run?.pullRequests).toEqual([12]);
  });

  it("ブランチ名が null（タグの実行など）なら、空文字にする（境界値）", () => {
    // Arrange
    const value = apiRun({ head_branch: null });
    // Act
    const run = readRun(value);
    // Assert
    expect(run?.branch).toBe("");
  });

  it("長すぎるブランチ名は、255 文字で切る（境界値）", () => {
    // Arrange
    const value = apiRun({ head_branch: "a".repeat(256) });
    // Act
    const run = readRun(value);
    // Assert
    expect(run?.branch).toBe("a".repeat(255));
  });

  it.each([
    ["オブジェクトでない", null],
    ["ID が数でない", apiRun({ id: "5" })],
    ["ID が 0", apiRun({ id: 0 })],
    ["やり直しの回数が無い", apiRun({ run_attempt: undefined })],
    ["SHA が 39 桁", apiRun({ head_sha: SHA.slice(1) })],
    ["SHA に大文字がある", apiRun({ head_sha: SHA.toUpperCase() })],
    ["リポジトリの名前にパスの区切りが多い", apiRun({ repository: { full_name: "a/b/c" } })],
    ["きっかけに記号がある", apiRun({ event: "push<" })],
    ["時刻の形が違う", apiRun({ run_started_at: "2026-11-19 01:02:03" })],
  ])("%s なら null（異常系）", (_name, value) => {
    // Arrange（value）
    // Act
    const run = readRun(value);
    // Assert
    expect(run).toBeNull();
  });
});

describe("pickPullRequest（実行がどの PR のものか）", () => {
  it("実行に結び付いた PR があれば、それを選ぶ（正常系）", () => {
    // Arrange
    const run = workflowRun({ pullRequests: [12, 13] });
    // Act
    const pr = pickPullRequest(run, [associatedPull(34)]);
    // Assert
    expect(pr).toBe(12);
  });

  it("結び付いた PR が無ければ（フォークの PR）、コミットから探した開いている PR を選ぶ", () => {
    // Arrange
    const run = workflowRun();
    // Act
    const pr = pickPullRequest(run, [associatedPull(34)]);
    // Assert
    expect(pr).toBe(34);
  });

  it.each([
    ["閉じている", associatedPull(34, { state: "closed" })],
    ["head の SHA が違う", associatedPull(34, { head: { sha: OTHER_SHA } })],
    ["向け先がほかのリポジトリ", associatedPull(34, { base: { repo: { full_name: "someone/modelith" } } })],
    ["番号が数でない", associatedPull(34, { number: "34" })],
    ["オブジェクトでない", "34"],
  ])("コミットから探した PR が %s なら、選ばない（異常系）", (_name, pull) => {
    // Arrange
    const run = workflowRun();
    // Act
    const pr = pickPullRequest(run, [pull]);
    // Assert
    expect(pr).toBeNull();
  });

  it("どちらにも無ければ null（境界値：空）", () => {
    // Arrange
    const run = workflowRun();
    // Act
    const pr = pickPullRequest(run, []);
    // Assert
    expect(pr).toBeNull();
  });

  it("コミットから探した一覧が配列でなければ null（異常系：API のエラーの答え）", () => {
    // Arrange
    const run = workflowRun();
    // Act
    const pr = pickPullRequest(run, { message: "Not Found" });
    // Assert
    expect(pr).toBeNull();
  });

  it("push の実行は、PR が結び付いていても PR のものとしない", () => {
    // Arrange
    const run = workflowRun({ event: "push", pullRequests: [12] });
    // Act
    const pr = pickPullRequest(run, [associatedPull(34)]);
    // Assert
    expect(pr).toBeNull();
  });
});

describe("pickArtifact（置く成果物を選ぶ）", () => {
  it("check ジョブが失敗していて、成果物があれば、その ID（正常系）", () => {
    // Arrange
    const artifacts = artifactList({ id: 8, name: "other" }, reports(9));
    // Act
    const picked = pickArtifact(artifacts, FAILED_JOBS, DEFAULT_LIMITS);
    // Assert
    expect(picked).toEqual({ id: 9 });
  });

  it("同じ名前が複数あれば（やり直し）、最も新しいもの", () => {
    // Arrange
    const artifacts = artifactList(reports(9, { created_at: "2026-11-19T01:30:00Z" }), reports(10, { created_at: "2026-11-19T03:00:00Z" }));
    // Act
    const picked = pickArtifact(artifacts, FAILED_JOBS, DEFAULT_LIMITS);
    // Assert
    expect(picked).toEqual({ id: 10 });
  });

  it("成果物が無ければ、置かない（e2e まで進まずに落ちた実行）", () => {
    // Arrange
    const artifacts = artifactList();
    // Act
    const picked = pickArtifact(artifacts, FAILED_JOBS, DEFAULT_LIMITS);
    // Assert
    expect(picked).toEqual({ skip: expect.stringContaining("成果物 test-reports が無い") });
  });

  it("期限が切れた成果物は、無いものとする", () => {
    // Arrange
    const artifacts = artifactList(reports(9, { expired: true }));
    // Act
    const picked = pickArtifact(artifacts, FAILED_JOBS, DEFAULT_LIMITS);
    // Assert
    expect(picked).toEqual({ skip: expect.stringContaining("が無い") });
  });

  it.each([
    ["check が成功（落ちたのは別のジョブ）", { jobs: [{ name: "conventions", conclusion: "failure" }, { name: "check", conclusion: "success" }] }],
    ["check が取り消し", { jobs: [{ name: "check", conclusion: "cancelled" }] }],
    ["ジョブが無い", { jobs: [] }],
    ["答えの形が違う", { message: "Not Found" }],
  ])("%s なら、成果物があっても置かない", (_name, jobs) => {
    // Arrange
    const artifacts = artifactList(reports(9));
    // Act
    const picked = pickArtifact(artifacts, jobs, DEFAULT_LIMITS);
    // Assert
    expect(picked).toEqual({ skip: expect.stringContaining("check が失敗していない") });
  });

  it("圧縮した大きさが上限ちょうどなら、置く（境界値）", () => {
    // Arrange
    const artifacts = artifactList(reports(9, { size_in_bytes: 1000 }));
    // Act
    const picked = pickArtifact(artifacts, FAILED_JOBS, limits({ maxRunBytes: 1000 }));
    // Assert
    expect(picked).toEqual({ id: 9 });
  });

  it("圧縮した大きさが上限を 1 バイト超えたら、置かない（境界値）", () => {
    // Arrange
    const artifacts = artifactList(reports(9, { size_in_bytes: 1001 }));
    // Act
    const picked = pickArtifact(artifacts, FAILED_JOBS, limits({ maxRunBytes: 1000 }));
    // Assert
    expect(picked).toEqual({ skip: expect.stringContaining("大きすぎる") });
  });
});

describe("checkReport（取り出した成果物を置いてよいか）", () => {
  it("上限の中で、入口のページがあれば、置く（正常系）", () => {
    // Arrange
    const stats = { bytes: 60_000_000, largestFileBytes: 5_000_000, pages: ["e2e/index.html"] };
    // Act
    const reason = checkReport(stats, DEFAULT_LIMITS);
    // Assert
    expect(reason).toBeNull();
  });

  it("合計も、最も大きいファイルも、上限ちょうどなら置く（境界値）", () => {
    // Arrange
    const stats = { bytes: 1000, largestFileBytes: 100, pages: ["requirements.html"] };
    // Act
    const reason = checkReport(stats, limits({ maxRunBytes: 1000, maxFileBytes: 100 }));
    // Assert
    expect(reason).toBeNull();
  });

  it("合計が上限を 1 バイト超えたら、置かない（境界値）", () => {
    // Arrange
    const stats = { bytes: 1001, largestFileBytes: 100, pages: ["e2e/index.html"] };
    // Act
    const reason = checkReport(stats, limits({ maxRunBytes: 1000, maxFileBytes: 100 }));
    // Assert
    expect(reason).toContain("成果物が大きすぎる（1001 バイト");
  });

  it("1 つのファイルが上限を 1 バイト超えたら、置かない（境界値）", () => {
    // Arrange
    const stats = { bytes: 1000, largestFileBytes: 101, pages: ["e2e/index.html"] };
    // Act
    const reason = checkReport(stats, limits({ maxRunBytes: 1000, maxFileBytes: 100 }));
    // Assert
    expect(reason).toContain("大きすぎるファイルがある（101 バイト");
  });

  it("入口のページが 1 つも無ければ、置かない（異常系）", () => {
    // Arrange
    const stats = { bytes: 10, largestFileBytes: 10, pages: [] };
    // Act
    const reason = checkReport(stats, DEFAULT_LIMITS);
    // Assert
    expect(reason).toContain("見るページが無い");
  });
});

describe("buildMeta・parseMeta（メタデータを作る・読む）", () => {
  it("作ったメタデータは、JSON にして読み戻せる（正常系）", () => {
    // Arrange
    const built = buildMeta(workflowRun(), 12, { bytes: 100, largestFileBytes: 60, pages: ["e2e/index.html"] }, "2026-11-19T02:00:00Z");
    // Act
    const parsed = parseMeta(JSON.stringify(built));
    // Assert
    expect(parsed).toEqual(meta(5, { attempt: 2, pr: 12 }));
  });

  it("入口のページは、知っているものだけを、決まった順で残す", () => {
    // Arrange
    const text = JSON.stringify(meta(5, { pages: ["requirements.html", "javascript:alert(1)", "e2e/index.html"] }));
    // Act
    const parsed = parseMeta(text);
    // Assert
    expect(parsed?.pages).toEqual(["e2e/index.html", "requirements.html"]);
  });

  it("大きさ 0・ページなし・PR なしでも読める（境界値）", () => {
    // Arrange
    const text = JSON.stringify(meta(1, { bytes: 0, pages: [], pr: null }));
    // Act
    const parsed = parseMeta(text);
    // Assert
    expect(parsed).toEqual(meta(1, { bytes: 0, pages: [], pr: null }));
  });

  it.each([
    ["JSON でない", "{"],
    ["配列", "[]"],
    ["key がフォルダの外を指す", JSON.stringify({ ...meta(5), key: "../5-1" })],
    ["key が実行の ID・回数と合わない", JSON.stringify({ ...meta(5), key: "6-1" })],
    ["やり直しの回数が 0", JSON.stringify({ ...meta(5), attempt: 0, key: "5-0" })],
    ["SHA が 16 進でない", JSON.stringify(meta(5, { sha: "z".repeat(40) }))],
    ["リポジトリの名前に URL が入っている", JSON.stringify(meta(5, { repository: "evil.example/a/b" }))],
    ["PR の番号が文字列", JSON.stringify({ ...meta(5), pr: "12" })],
    ["PR の番号が負", JSON.stringify(meta(5, { pr: -1 }))],
    ["ブランチ名が文字列でない", JSON.stringify({ ...meta(5), branch: 1 })],
    ["ブランチ名が 256 文字", JSON.stringify(meta(5, { branch: "a".repeat(256) }))],
    ["置いた時刻に秒の小数がある", JSON.stringify(meta(5, { publishedAt: "2026-11-19T02:00:00.123Z" }))],
    ["大きさが負", JSON.stringify(meta(5, { bytes: -1 }))],
    ["ページが配列でない", JSON.stringify({ ...meta(5), pages: "e2e/index.html" })],
  ])("%s なら null（異常系）", (_name, text) => {
    // Arrange（text）
    // Act
    const parsed = parseMeta(text);
    // Assert
    expect(parsed).toBeNull();
  });
});

describe("newestFirst（新しく置いた順）", () => {
  it("置いた時刻の新しいものが先。実行の ID の大小には左右されない（古い実行をあとから置いた場合）", () => {
    // Arrange
    const runs = [meta(9, { publishedAt: "2026-11-01T00:00:00Z" }), meta(1, { publishedAt: "2026-11-03T00:00:00Z" }), meta(5, { publishedAt: "2026-11-02T00:00:00Z" })];
    // Act
    const sorted = newestFirst(runs);
    // Assert
    expect(sorted.map((run) => run.key)).toEqual(["1-1", "5-1", "9-1"]);
  });

  it("置いた時刻が同じなら、実行の ID、次にやり直しの回数の大きいものが先（数として比べる）", () => {
    // Arrange
    const runs = [meta(9), meta(10), meta(10, { attempt: 2 }), meta(10, { attempt: 11 })];
    // Act
    const sorted = newestFirst(runs);
    // Assert
    expect(sorted.map((run) => run.key)).toEqual(["10-11", "10-2", "10-1", "9-1"]);
  });
});

describe("selectRunsToRemove（消す実行）", () => {
  /**
   * 置いた日が 1 日ずつ新しくなる実行を作る（実行 1 が最も古い）。
   *
   * @param count 数
   * @param bytes 1 回分の大きさ
   * @returns フォルダの一覧
   */
  const daily = (count: number, bytes = 100): RunEntry[] =>
    entries(...Array.from({ length: count }, (_, i) => meta(i + 1, { bytes, publishedAt: `2026-11-${String(i + 1).padStart(2, "0")}T00:00:00Z` })));

  it("何も無ければ、何も消さない（境界値：空）", () => {
    // Arrange
    const list: RunEntry[] = [];
    // Act
    const remove = selectRunsToRemove(list, DEFAULT_LIMITS);
    // Assert
    expect(remove).toEqual([]);
  });

  it("残す数ちょうど（10 回分）なら、何も消さない（境界値）", () => {
    // Arrange
    const list = daily(10);
    // Act
    const remove = selectRunsToRemove(list, DEFAULT_LIMITS);
    // Assert
    expect(remove).toEqual([]);
  });

  it("残す数より 1 つ多ければ（11 回分）、最も古い 1 つを消す（境界値）", () => {
    // Arrange
    const list = daily(11);
    // Act
    const remove = selectRunsToRemove(list, DEFAULT_LIMITS);
    // Assert
    expect(remove).toEqual(["1-1"]);
  });

  it("多ければ、新しく置いたものから 10 回分を残し、ほかをすべて消す（正常系）", () => {
    // Arrange
    const list = daily(13);
    // Act
    const remove = selectRunsToRemove(list, DEFAULT_LIMITS);
    // Assert
    expect(remove).toEqual(["1-1", "2-1", "3-1"]);
  });

  it("古い実行をあとから置いたものは、新しいものとして残す", () => {
    // Arrange（実行 1 を、最後に置いた）
    const list = [...daily(11).slice(1), ...entries(meta(1, { publishedAt: "2026-11-30T00:00:00Z" }))];
    // Act
    const remove = selectRunsToRemove(list, DEFAULT_LIMITS);
    // Assert
    expect(remove).toEqual(["2-1"]);
  });

  it("合計が全体の上限ちょうどなら、消さない（境界値）", () => {
    // Arrange
    const list = daily(3, 100);
    // Act
    const remove = selectRunsToRemove(list, limits({ maxTotalBytes: 300 }));
    // Assert
    expect(remove).toEqual([]);
  });

  it("合計が全体の上限を超えたら、超える分を古いものから消す（境界値：1 バイト超）", () => {
    // Arrange
    const list = daily(3, 100);
    // Act
    const remove = selectRunsToRemove(list, limits({ maxTotalBytes: 299 }));
    // Assert
    expect(remove).toEqual(["1-1"]);
  });

  it("一度あふれたら、それより古いものは、小さくても残さない", () => {
    // Arrange（新しい順に 100・500・1 バイト。上限は 200）
    const list = entries(
      meta(1, { bytes: 1, publishedAt: "2026-11-01T00:00:00Z" }),
      meta(2, { bytes: 500, publishedAt: "2026-11-02T00:00:00Z" }),
      meta(3, { bytes: 100, publishedAt: "2026-11-03T00:00:00Z" }),
    );
    // Act
    const remove = selectRunsToRemove(list, limits({ maxTotalBytes: 200 }));
    // Assert
    expect(remove).toEqual(["1-1", "2-1"]);
  });

  it("最も新しい 1 回分は、それだけで全体の上限を超えていても残す", () => {
    // Arrange
    const list = daily(1, 1000);
    // Act
    const remove = selectRunsToRemove(list, limits({ maxTotalBytes: 10 }));
    // Assert
    expect(remove).toEqual([]);
  });

  it("メタデータが無い・フォルダの名前と合わないものは、数に入れずに消す（異常系）", () => {
    // Arrange
    const list: RunEntry[] = [...daily(10), { directory: "tmp", meta: null }, { directory: "99-1", meta: meta(98) }];
    // Act
    const remove = selectRunsToRemove(list, DEFAULT_LIMITS);
    // Assert
    expect(remove).toEqual(["99-1", "tmp"]);
  });
});

describe("renderIndex（一覧のページ）", () => {
  it("置いてある実行を、新しく置いた順に、日付・ブランチ・PR・コミット・結果へのリンクで並べる（正常系）", () => {
    // Arrange
    const runs = [
      meta(5, { pr: 12, pages: ["e2e/index.html", "requirements.html"], publishedAt: "2026-11-01T00:00:00Z" }),
      meta(7, { attempt: 2, branch: "dev", event: "push", publishedAt: "2026-11-02T00:00:00Z" }),
    ];
    // Act
    const html = renderIndex(runs, DEFAULT_LIMITS);
    // Assert
    const rows = html.split("\n").filter((line) => line.startsWith("<tr><td>"));
    expect(rows).toEqual([
      '<tr><td>2026-11-19 01:02 UTC</td><td><code>dev</code></td><td>—</td><td><a href="https://github.com/modelith/modelith/commit/' +
        SHA +
        '"><code>0123456</code></a></td><td><a href="https://github.com/modelith/modelith/actions/runs/7/attempts/2">7 (attempt 2)</a></td>' +
        '<td><a href="runs/7-2/report/e2e/index.html">Playwright report</a></td></tr>',
      '<tr><td>2026-11-19 01:02 UTC</td><td><code>fix/a</code></td><td><a href="https://github.com/modelith/modelith/pull/12">#12</a></td><td><a href="https://github.com/modelith/modelith/commit/' +
        SHA +
        '"><code>0123456</code></a></td><td><a href="https://github.com/modelith/modelith/actions/runs/5/attempts/1">5 (attempt 1)</a></td>' +
        '<td><a href="runs/5-1/report/e2e/index.html">Playwright report</a> · <a href="runs/5-1/report/requirements.html">Requirements table</a></td></tr>',
    ]);
  });

  it("ブランチ名にタグや引用符があっても、HTML としてエスケープする（異常系：信頼できない文字列）", () => {
    // Arrange
    const runs = [meta(5, { branch: `"><script>alert('x')</script>&` })];
    // Act
    const html = renderIndex(runs, DEFAULT_LIMITS);
    // Assert
    expect(html).toContain("<code>&quot;&gt;&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;&amp;</code>");
    expect(html).not.toContain("<script");
  });

  it("何も置いていなければ、表の代わりにその旨を出す（境界値：空）", () => {
    // Arrange
    const runs: RunMeta[] = [];
    // Act
    const html = renderIndex(runs, DEFAULT_LIMITS);
    // Assert
    expect(html).toContain("<p>No test results are stored right now.</p>");
    expect(html).not.toContain("<table>");
  });

  it("ここが何の場所か（アプリでもマニュアルでもない・古いものは消える・ソースとライセンス・商標）を書く", () => {
    // Arrange
    const runs: RunMeta[] = [];
    // Act
    const html = renderIndex(runs, limits({ keepRuns: 7 }));
    // Assert
    expect(html).toContain("not the Modelith app and not its manual");
    expect(html).toContain("Only the latest 7 runs are kept");
    expect(html).toContain('<a href="https://github.com/modelith/modelith">modelith/modelith</a>');
    expect(html).toContain("It is not affiliated with or endorsed by OMG.");
  });

  it("スクリプトも、外部からの読み込みも使わない", () => {
    // Arrange
    const runs = [meta(5)];
    // Act
    const html = renderIndex(runs, DEFAULT_LIMITS);
    // Assert
    expect(html).not.toMatch(/<script|<link|<img|<iframe|\son[a-z]+=|src=/i);
  });
});

describe("renderComment（PR へのコメント）", () => {
  it("先頭に目印を置き、結果のページへのリンクと、ワークフローが付けたことを書く（正常系）", () => {
    // Arrange
    const run = meta(5, { attempt: 2, pr: 12, pages: ["e2e/index.html", "requirements.html"] });
    // Act
    const body = renderComment(run, "https://modelith-dev.github.io", DEFAULT_LIMITS);
    // Assert
    expect(body.startsWith(`${COMMENT_MARKER}\n`)).toBe(true);
    expect(body).toContain("- [Playwright のレポート（手順・画面・操作の記録）](https://modelith-dev.github.io/runs/5-2/report/e2e/index.html)");
    expect(body).toContain("- [要求別の表](https://modelith-dev.github.io/runs/5-2/report/requirements.html)");
    expect(body).toContain("コミット `0123456` の [実行 5（2 回目）](https://github.com/modelith/modelith/actions/runs/5/attempts/2)");
    expect(body).toContain("新しいものから 10 回分だけ");
    expect(body.trimEnd().endsWith("_このコメントは CI のワークフロー（CI reports）が自動で付けました。同じ PR では、このコメントを書き換えます。_")).toBe(true);
  });

  it("サイトの URL の末尾の / は、あってもなくても同じ（境界値）", () => {
    // Arrange
    const run = meta(5);
    // Act
    const withSlash = renderComment(run, "https://modelith-dev.github.io/", DEFAULT_LIMITS);
    // Assert
    expect(withSlash).toBe(renderComment(run, "https://modelith-dev.github.io", DEFAULT_LIMITS));
  });

  it("ブランチ名（信頼できない文字列）は、本文に入れない", () => {
    // Arrange
    const run = meta(5, { branch: "@someone [x](https://evil.example)" });
    // Act
    const body = renderComment(run, "https://modelith-dev.github.io", DEFAULT_LIMITS);
    // Assert
    expect(body).not.toContain("evil.example");
    expect(body).not.toContain("@someone");
  });

  it("人やエージェントの発言の決まり文句（Generated by Claude Code）は付けない", () => {
    // Arrange
    const run = meta(5);
    // Act
    const body = renderComment(run, "https://modelith-dev.github.io", DEFAULT_LIMITS);
    // Assert
    expect(body).not.toContain("Claude Code");
  });
});

describe("findComment（前に付けたコメントを探す）", () => {
  it("ワークフローのアカウントが付けた、目印で始まるコメントの ID を返す（正常系）", () => {
    // Arrange
    const comments = [
      { id: 1, login: "someone", body: "LGTM" },
      { id: 7, login: "github-actions[bot]", body: `${COMMENT_MARKER}\n### CI のテストが失敗しました` },
      { id: 9, login: "github-actions[bot]", body: `${COMMENT_MARKER}\n2 つ目` },
    ];
    // Act
    const id = findComment(comments);
    // Assert
    expect(id).toBe(7);
  });

  it("コメントが無ければ null（境界値：空）", () => {
    // Arrange
    const comments: unknown[] = [];
    // Act
    const id = findComment(comments);
    // Assert
    expect(id).toBeNull();
  });

  it.each([
    ["ほかの人が目印を書いたコメント", { id: 8, login: "someone", body: COMMENT_MARKER }],
    ["ワークフローの、目印の無いコメント", { id: 8, login: "github-actions[bot]", body: "ほかのお知らせ" }],
    ["目印が先頭に無いコメント（引用など）", { id: 8, login: "github-actions[bot]", body: `> ${COMMENT_MARKER}` }],
    ["ID が数でないもの", { id: "8", login: "github-actions[bot]", body: COMMENT_MARKER }],
    ["オブジェクトでないもの", null],
  ])("%s は選ばない（異常系）", (_name, comment) => {
    // Arrange
    const comments = [comment];
    // Act
    const id = findComment(comments);
    // Assert
    expect(id).toBeNull();
  });
});
