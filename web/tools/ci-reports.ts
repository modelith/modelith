// 失敗した CI のテスト結果のページを、別のオリジンの置き場所に並べるための判断（docs/development/testing.md の「失敗した CI のテスト結果のページ」）。
// 判断だけを置く：どの成果物を置くか、置いてよい大きさか、どの実行を消すか、一覧の HTML、PR へのコメント。
// ファイルを読み書きするのは ci-reports-cli.ts、GitHub とのやり取りと git は scripts/ci-reports.sh。
// ここへ来る文字列（ブランチ名・成果物の中身・GitHub の API の答え）は信頼しない。形を確かめ、HTML にするときは必ずエスケープする。

/** 置き場所に置く成果物の名前（.github/workflows/ci.yml の `Upload test reports` と同じ）。 */
export const ARTIFACT_NAME = "test-reports";
/** テストを動かすジョブの名前（.github/workflows/ci.yml）。このジョブが失敗した実行だけを置く。 */
export const CHECK_JOB = "check";
/** PR へのコメントの目印。本文の先頭に置き、同じ PR では前のコメントを探して書き換える。 */
export const COMMENT_MARKER = "<!-- ci-reports -->";
/** コメントを付けるアカウント（ワークフローの `GITHUB_TOKEN`）。ほかの人が同じ目印を書いたコメントは書き換えない。 */
export const COMMENT_AUTHOR = "github-actions[bot]";

/** 成果物の中で、入口として案内するページ（成果物の中の相対パスと、一覧・コメントでの呼び名）。 */
export const REPORT_PAGES = [
  { path: "e2e/index.html", label: "Playwright report", labelJa: "Playwright のレポート（手順・画面・操作の記録）" },
  { path: "requirements.html", label: "Requirements table", labelJa: "要求別の表" },
] as const;

/** 置き場所の大きさの上限。 */
export type Limits = {
  /** 残す実行の数（新しく置いたものから） */
  keepRuns: number;
  /** 1 回分の上限（バイト）。超えたら置かない */
  maxRunBytes: number;
  /** 1 つのファイルの上限（バイト）。超えるファイルがあれば置かない */
  maxFileBytes: number;
  /** 置き場所全体の上限（バイト）。超える分は古いものから消す */
  maxTotalBytes: number;
};

/**
 * 既定の上限。
 * 1 回分は約 60 MB（2026-11）。1 つのファイルは GitHub が push を断る 100 MB より小さく、全体は GitHub Pages のサイトの上限（1 GB）より小さくする。
 */
export const DEFAULT_LIMITS: Limits = {
  keepRuns: 10,
  maxRunBytes: 200 * 1024 * 1024,
  maxFileBytes: 95 * 1024 * 1024,
  maxTotalBytes: 900 * 1024 * 1024,
};

/** 置いた実行 1 回分のメタデータ（`runs/<key>/meta.json`）。一覧とコメントはここから作る。 */
export type RunMeta = {
  /** フォルダの名前（`<実行の ID>-<やり直しの回数>`） */
  key: string;
  /** 実行の ID（Actions の URL の `runs/<ID>`） */
  runId: number;
  /** やり直しの回数（1 始まり） */
  attempt: number;
  /** 実行したリポジトリ（`owner/name`） */
  repository: string;
  /** ブランチ名（信頼できない文字列） */
  branch: string;
  /** コミットの SHA（16 進 40 桁） */
  sha: string;
  /** PR の番号。PR の実行でない・見つからないときは null */
  pr: number | null;
  /** きっかけ（`pull_request`・`push` など） */
  event: string;
  /** 実行が始まった時刻（`2026-11-19T01:02:03Z` の形） */
  startedAt: string;
  /** ここに置いた時刻（同じ形）。新しさの順はこれで決める */
  publishedAt: string;
  /** 置いたファイルの大きさの合計（バイト） */
  bytes: number;
  /** 成果物にあった入口のページ（`REPORT_PAGES` の `path`） */
  pages: string[];
};

/** GitHub の API の「ワークフローの実行」から、使う項目だけを確かめて取り出したもの。 */
export type WorkflowRun = {
  runId: number;
  attempt: number;
  repository: string;
  branch: string;
  sha: string;
  event: string;
  startedAt: string;
  /** 実行に結び付いた PR のうち、head の SHA がこの実行と同じものの番号（フォークの PR では空） */
  pullRequests: number[];
};

type Json = Record<string, unknown>;

const KEY_PATTERN = /^[1-9]\d*-[1-9]\d*$/;
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const EVENT_PATTERN = /^[a-z_]+$/;
/** ブランチ名の長さの上限（Git の参照の名前はこれより短い。壊れた入力で一覧を埋めないため）。 */
const MAX_BRANCH_LENGTH = 255;

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
 * 値が 1 以上の整数（安全に表せる範囲）かを確かめる。
 *
 * @param value 調べる値
 * @returns 1 以上の整数なら true
 * @example
 * isPositiveInteger(1)   // → true
 * isPositiveInteger(0)   // → false
 * isPositiveInteger("1") // → false
 */
function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

/**
 * 値が、決まった形の文字列かを確かめる。
 *
 * @param value 調べる値
 * @param pattern 形（文字列の全体に当てはまる正規表現）
 * @returns 文字列で、形に合えば true
 * @example
 * matches("push", /^[a-z_]+$/) // → true
 * matches("Push", /^[a-z_]+$/) // → false
 * matches(1, /^[a-z_]+$/)      // → false
 */
function matches(value: unknown, pattern: RegExp): value is string {
  return typeof value === "string" && pattern.test(value);
}

/**
 * 文字列を、HTML の本文と属性（二重引用符・一重引用符のどちらで囲んでも）に置ける形にエスケープする。
 *
 * @param text 元の文字列（信頼できないものでよい）
 * @returns `&`・`<`・`>`・`"`・`'` を文字参照にした文字列
 * @example
 * escapeHtml("feat/a")                    // → "feat/a"
 * escapeHtml(`<img src=x onerror="a&b">`) // → "&lt;img src=x onerror=&quot;a&amp;b&quot;&gt;"
 * escapeHtml("it's")                      // → "it&#39;s"
 */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * 実行 1 回分のフォルダの名前を作る。
 *
 * @param runId 実行の ID（1 以上の整数）
 * @param attempt やり直しの回数（1 始まり）
 * @returns `<実行の ID>-<やり直しの回数>`
 * @example
 * runKey(44583978203, 1) // → "44583978203-1"
 * runKey(7, 12)          // → "7-12"
 */
export function runKey(runId: number, attempt: number): string {
  return `${runId}-${attempt}`;
}

/**
 * GitHub の API の「ワークフローの実行」（`GET /repos/{owner}/{repo}/actions/runs/{run_id}` の答え）から、使う項目を確かめて取り出す。
 *
 * @param value API の答え（JSON を読んだもの）
 * @returns 取り出した実行。要る項目が無い・形が違うときは null
 * @example
 * readRun({ id: 5, run_attempt: 1, head_branch: "fix/a", head_sha: "0123…（40 桁）", event: "pull_request",
 *           run_started_at: "2026-11-19T01:02:03Z", repository: { full_name: "modelith/modelith" }, pull_requests: [] })
 * // → { runId: 5, attempt: 1, repository: "modelith/modelith", branch: "fix/a", sha: "0123…", event: "pull_request", startedAt: "2026-11-19T01:02:03Z", pullRequests: [] }
 * readRun({ id: "5" }) // → null（ID が数でない）
 */
export function readRun(value: unknown): WorkflowRun | null {
  if (!isObject(value)) return null;
  const repository = isObject(value.repository) ? value.repository.full_name : undefined;
  const { id, run_attempt: attempt, head_branch: branch, head_sha: sha, event, run_started_at: startedAt } = value;
  if (!isPositiveInteger(id) || !isPositiveInteger(attempt)) return null;
  if (!matches(repository, REPOSITORY_PATTERN) || !matches(sha, SHA_PATTERN) || !matches(event, EVENT_PATTERN) || !matches(startedAt, TIME_PATTERN)) return null;
  // head_branch は、タグの実行などで null になることがある
  const branchText = typeof branch === "string" ? branch.slice(0, MAX_BRANCH_LENGTH) : "";
  const pulls = Array.isArray(value.pull_requests) ? value.pull_requests : [];
  const pullRequests = pulls
    .filter((pull): pull is Json => isObject(pull) && isObject(pull.head) && pull.head.sha === sha)
    .map((pull) => pull.number)
    .filter(isPositiveInteger);
  return { runId: id, attempt, repository, branch: branchText, sha, event, startedAt, pullRequests };
}

/**
 * 実行がどの PR のものかを決める。実行に結び付いた PR があればそれ、無ければ（フォークの PR など）コミットから探した PR。
 *
 * @param run 実行
 * @param associated コミットに結び付いた PR の一覧（`GET /repos/{owner}/{repo}/commits/{sha}/pulls` の答え。取れなければ `[]`）
 * @returns PR の番号。PR の実行でない・見つからないときは null。
 *   コミットから探すときは、開いていて、head の SHA が実行と同じで、向け先がこのリポジトリのものだけを選ぶ
 * @example
 * pickPullRequest({ …, pullRequests: [12] }, [])                                                    // → 12
 * pickPullRequest({ …, sha: "aaa…", pullRequests: [] }, [{ number: 34, state: "open", head: { sha: "aaa…" }, base: { repo: { full_name: "modelith/modelith" } } }]) // → 34
 * pickPullRequest({ …, event: "push", pullRequests: [12] }, [])                                     // → null（push の実行）
 */
export function pickPullRequest(run: WorkflowRun, associated: unknown): number | null {
  // push の実行（dev・main）は、マージ済みの PR のコミットでも、PR のものとは扱わない
  if (run.event !== "pull_request") return null;
  const direct = run.pullRequests[0];
  if (direct !== undefined) return direct;
  if (!Array.isArray(associated)) return null;
  for (const pull of associated) {
    if (!isObject(pull) || pull.state !== "open" || !isPositiveInteger(pull.number)) continue;
    const headSha = isObject(pull.head) ? pull.head.sha : undefined;
    const base = isObject(pull.base) && isObject(pull.base.repo) ? pull.base.repo.full_name : undefined;
    if (headSha === run.sha && base === run.repository) return pull.number;
  }
  return null;
}

/**
 * 実行の成果物の一覧とジョブの一覧から、置く成果物を選ぶ。
 *
 * @param artifacts 成果物の一覧（`GET …/actions/runs/{run_id}/artifacts` の答え）
 * @param jobs ジョブの一覧（`GET …/actions/runs/{run_id}/attempts/{attempt}/jobs` の答え）
 * @param limits 大きさの上限
 * @returns 置くなら `{ id }`（成果物の ID。同じ名前が複数あれば最も新しいもの）。置かないなら `{ skip }`（理由）
 * @example
 * pickArtifact({ artifacts: [{ id: 9, name: "test-reports", expired: false, size_in_bytes: 100, created_at: "2026-11-19T01:00:00Z" }] },
 *              { jobs: [{ name: "check", conclusion: "failure" }] }, DEFAULT_LIMITS) // → { id: 9 }
 * pickArtifact({ artifacts: [] }, { jobs: [{ name: "check", conclusion: "failure" }] }, DEFAULT_LIMITS)
 * // → { skip: "成果物 test-reports が無い（e2e まで進まずに終わった実行）" }
 */
export function pickArtifact(artifacts: unknown, jobs: unknown, limits: Limits): { id: number } | { skip: string } {
  const jobList = isObject(jobs) && Array.isArray(jobs.jobs) ? jobs.jobs : [];
  const failed = jobList.some((job) => isObject(job) && job.name === CHECK_JOB && job.conclusion === "failure");
  if (!failed) return { skip: `ジョブ ${CHECK_JOB} が失敗していない（テストの失敗ではない）` };
  const list = isObject(artifacts) && Array.isArray(artifacts.artifacts) ? artifacts.artifacts : [];
  const candidates = list
    .filter((artifact): artifact is Json => isObject(artifact) && artifact.name === ARTIFACT_NAME && artifact.expired !== true && isPositiveInteger(artifact.id))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const newest = candidates[0];
  if (newest === undefined) return { skip: `成果物 ${ARTIFACT_NAME} が無い（e2e まで進まずに終わった実行）` };
  const size = newest.size_in_bytes;
  // 圧縮した大きさが上限を超えていれば、取り出すまでもない
  if (typeof size === "number" && size > limits.maxRunBytes) return { skip: `成果物が大きすぎる（圧縮して ${size} バイト。上限は ${limits.maxRunBytes} バイト）` };
  return { id: newest.id as number };
}

/** 取り出した成果物を調べた結果。 */
export type ReportStats = {
  /** ファイルの大きさの合計（バイト） */
  bytes: number;
  /** 最も大きいファイルの大きさ（バイト）。ファイルが無ければ 0 */
  largestFileBytes: number;
  /** あった入口のページ（`REPORT_PAGES` の `path`） */
  pages: string[];
};

/**
 * 取り出した成果物を、置いてよいかを決める。
 *
 * @param stats 成果物を調べた結果
 * @param limits 大きさの上限
 * @returns 置いてよければ null。置かないなら理由
 * @example
 * checkReport({ bytes: 60_000_000, largestFileBytes: 5_000_000, pages: ["e2e/index.html"] }, DEFAULT_LIMITS) // → null
 * checkReport({ bytes: 300_000_000, largestFileBytes: 5_000_000, pages: ["e2e/index.html"] }, DEFAULT_LIMITS)
 * // → "成果物が大きすぎる（300000000 バイト。上限は 209715200 バイト）"
 */
export function checkReport(stats: ReportStats, limits: Limits): string | null {
  if (stats.pages.length === 0) return `見るページが無い（${REPORT_PAGES.map((page) => page.path).join("・")} のどれも無い）`;
  if (stats.bytes > limits.maxRunBytes) return `成果物が大きすぎる（${stats.bytes} バイト。上限は ${limits.maxRunBytes} バイト）`;
  if (stats.largestFileBytes > limits.maxFileBytes) return `大きすぎるファイルがある（${stats.largestFileBytes} バイト。上限は ${limits.maxFileBytes} バイト）`;
  return null;
}

/**
 * 実行と、置いたものの情報から、メタデータを作る。
 *
 * @param run 実行
 * @param pr PR の番号（無ければ null）
 * @param stats 置く成果物を調べた結果
 * @param publishedAt 置く時刻（`2026-11-19T01:02:03Z` の形）
 * @returns メタデータ
 * @example
 * buildMeta({ runId: 5, attempt: 2, … }, 12, { bytes: 100, largestFileBytes: 60, pages: ["e2e/index.html"] }, "2026-11-19T02:00:00Z")
 * // → { key: "5-2", runId: 5, attempt: 2, …, pr: 12, publishedAt: "2026-11-19T02:00:00Z", bytes: 100, pages: ["e2e/index.html"] }
 */
export function buildMeta(run: WorkflowRun, pr: number | null, stats: ReportStats, publishedAt: string): RunMeta {
  return {
    key: runKey(run.runId, run.attempt),
    runId: run.runId,
    attempt: run.attempt,
    repository: run.repository,
    branch: run.branch,
    sha: run.sha,
    pr,
    event: run.event,
    startedAt: run.startedAt,
    publishedAt,
    bytes: stats.bytes,
    pages: stats.pages,
  };
}

/**
 * `meta.json` の中身を読み、形を確かめる。置き場所のファイルも、そのまま信じない（壊れていれば、その実行は一覧に出さず、掃除で消す）。
 *
 * @param text `meta.json` の中身
 * @returns メタデータ。JSON でない・要る項目が無い・形が違うときは null。入口のページは、知っているものだけを残す
 * @example
 * parseMeta('{"key":"5-2","runId":5,"attempt":2,"repository":"modelith/modelith","branch":"fix/a","sha":"0123…（40 桁）","pr":null,"event":"push","startedAt":"2026-11-19T01:02:03Z","publishedAt":"2026-11-19T02:00:00Z","bytes":100,"pages":["e2e/index.html"]}')
 * // → { key: "5-2", runId: 5, … }
 * parseMeta("{")              // → null
 * parseMeta('{"key":"../x"}') // → null
 */
export function parseMeta(text: string): RunMeta | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObject(value)) return null;
  const { key, runId, attempt, repository, branch, sha, pr, event, startedAt, publishedAt, bytes, pages } = value;
  if (!isPositiveInteger(runId) || !isPositiveInteger(attempt) || !matches(key, KEY_PATTERN) || key !== runKey(runId, attempt)) return null;
  if (!matches(repository, REPOSITORY_PATTERN) || !matches(sha, SHA_PATTERN) || !matches(event, EVENT_PATTERN)) return null;
  if (!matches(startedAt, TIME_PATTERN) || !matches(publishedAt, TIME_PATTERN)) return null;
  if (typeof branch !== "string" || branch.length > MAX_BRANCH_LENGTH) return null;
  if (pr !== null && !isPositiveInteger(pr)) return null;
  if (typeof bytes !== "number" || !Number.isSafeInteger(bytes) || bytes < 0 || !Array.isArray(pages)) return null;
  const known = REPORT_PAGES.map((page) => page.path as string).filter((path) => pages.includes(path));
  return { key, runId, attempt, repository, branch, sha, pr, event, startedAt, publishedAt, bytes, pages: known };
}

/**
 * 実行を、新しく置いた順に並べる（置いた時刻が同じなら、実行の ID・やり直しの回数が大きいほうを先に）。
 *
 * @param runs 実行（元の配列は変えない）
 * @returns 並べ直した配列
 * @example
 * newestFirst([{ key: "1-1", publishedAt: "2026-11-01T00:00:00Z", … }, { key: "2-1", publishedAt: "2026-11-02T00:00:00Z", … }]).map((run) => run.key)
 * // → ["2-1", "1-1"]
 */
export function newestFirst(runs: RunMeta[]): RunMeta[] {
  return [...runs].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.runId - a.runId || b.attempt - a.attempt);
}

/** 置き場所の `runs/` の下の 1 つのフォルダ。 */
export type RunEntry = {
  /** フォルダの名前 */
  directory: string;
  /** その `meta.json` を読んだもの。無い・壊れているときは null */
  meta: RunMeta | null;
};

/**
 * 消すフォルダを決める。新しく置いたものから `keepRuns` 回分を残し、合計が `maxTotalBytes` を超える分も古いものから消す。
 *
 * @param entries `runs/` の下のフォルダ
 * @param limits 大きさの上限
 * @returns 消すフォルダの名前（名前の順）。メタデータが無い・壊れている・フォルダの名前と合わないものも消す。
 *   最も新しい 1 回分は、大きさによらず残す
 * @example
 * selectRunsToRemove([{ directory: "1-1", meta: 古い }, { directory: "2-1", meta: 新しい }], { ...DEFAULT_LIMITS, keepRuns: 1 }) // → ["1-1"]
 * selectRunsToRemove([{ directory: "tmp", meta: null }], DEFAULT_LIMITS)                                                        // → ["tmp"]
 * selectRunsToRemove([], DEFAULT_LIMITS)                                                                                        // → []
 */
export function selectRunsToRemove(entries: RunEntry[], limits: Limits): string[] {
  const valid: RunMeta[] = [];
  const remove: string[] = [];
  for (const entry of entries) {
    if (entry.meta !== null && entry.meta.key === entry.directory) valid.push(entry.meta);
    else remove.push(entry.directory);
  }
  let total = 0;
  let full = false;
  newestFirst(valid).forEach((meta, index) => {
    total += meta.bytes;
    // 一度あふれたら、それより古いものは小さくても残さない（一覧に穴を開けない）
    if (index >= limits.keepRuns || (index > 0 && total > limits.maxTotalBytes)) full = true;
    if (full) remove.push(meta.key);
  });
  return remove.sort();
}

/**
 * 一覧の 1 行（1 回分の実行）の HTML を作る。
 *
 * @param meta メタデータ（文字列はここでエスケープする）
 * @returns `<tr>…</tr>`
 * @example
 * renderRow({ key: "5-2", branch: "<b>", pr: 12, sha: "0123456…", pages: ["e2e/index.html"], … })
 * // → '<tr><td>2026-11-19 01:02 UTC</td><td>&lt;b&gt;</td><td><a href="https://github.com/modelith/modelith/pull/12">#12</a></td>…</tr>'
 */
function renderRow(meta: RunMeta): string {
  const github = `https://github.com/${meta.repository}`;
  const when = `${meta.startedAt.slice(0, 10)} ${meta.startedAt.slice(11, 16)} UTC`;
  const pull = meta.pr === null ? "—" : `<a href="${escapeHtml(`${github}/pull/${meta.pr}`)}">#${meta.pr}</a>`;
  const commit = `<a href="${escapeHtml(`${github}/commit/${meta.sha}`)}"><code>${escapeHtml(meta.sha.slice(0, 7))}</code></a>`;
  const run = `<a href="${escapeHtml(`${github}/actions/runs/${meta.runId}/attempts/${meta.attempt}`)}">${meta.runId} (attempt ${meta.attempt})</a>`;
  const pages = REPORT_PAGES.filter((page) => meta.pages.includes(page.path))
    .map((page) => `<a href="${escapeHtml(`runs/${meta.key}/report/${page.path}`)}">${escapeHtml(page.label)}</a>`)
    .join(" · ");
  const cells = [escapeHtml(when), `<code>${escapeHtml(meta.branch)}</code>`, pull, commit, run, pages];
  return `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`;
}

/**
 * 置き場所の一覧のページ（ルートの `index.html`）を作る。スクリプトも外部の読み込みも使わない。
 *
 * @param runs 置いてある実行（順は問わない。新しく置いた順に並べて出す）
 * @param limits 大きさの上限（残す数を説明に書く）
 * @returns HTML の全体。メタデータの文字列（ブランチ名など）はエスケープしてある
 * @example
 * renderIndex([], DEFAULT_LIMITS)                       // → "<!doctype html>…<p>No test results are stored right now.</p>…"
 * renderIndex([{ branch: "<script>", … }], DEFAULT_LIMITS) // → "…<code>&lt;script&gt;</code>…"
 */
export function renderIndex(runs: RunMeta[], limits: Limits): string {
  const rows = newestFirst(runs).map(renderRow);
  const table =
    rows.length === 0
      ? "<p>No test results are stored right now.</p>"
      : `<table>
<thead><tr><th>Started</th><th>Branch</th><th>PR</th><th>Commit</th><th>CI run</th><th>Results</th></tr></thead>
<tbody>
${rows.join("\n")}
</tbody>
</table>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="referrer" content="no-referrer">
<title>Modelith CI test results</title>
<style>
:root { color-scheme: light dark; }
body { font-family: system-ui, sans-serif; line-height: 1.6; margin: 2rem auto; max-width: 64rem; padding: 0 1rem; }
table { border-collapse: collapse; width: 100%; }
th, td { border-bottom: 1px solid color-mix(in srgb, currentColor 25%, transparent); padding: 0.4rem 0.6rem; text-align: left; vertical-align: top; }
td code { overflow-wrap: anywhere; }
footer { font-size: 0.875rem; margin-top: 3rem; opacity: 0.8; }
</style>
</head>
<body>
<h1>Modelith CI test results</h1>
<p>This site stores the test result pages (Playwright HTML reports and traces) of <strong>failed CI runs</strong> of
<a href="https://github.com/modelith/modelith">Modelith</a>, so that contributors can look at screenshots and replay what the tests did.
It is <strong>not the Modelith app and not its manual</strong>. The app is at <a href="https://modelith.github.io/modelith/">modelith.github.io/modelith</a>
and the manual is at <a href="https://modelith.github.io/">modelith.github.io</a>.</p>
<p>The pages under <code>runs/</code> are generated from the contents of pull requests, including ones from forks. Treat them as untrusted:
they are kept on this separate site so that they cannot reach anything you have stored in the app. Do not enter personal or confidential information on them.</p>
<p>Only the latest ${limits.keepRuns} runs are kept. Older ones are deleted automatically, so links to them stop working.</p>
<h2>Stored runs</h2>
${table}
<footer>
<p>This site is written by a CI workflow of <a href="https://github.com/modelith/modelith">modelith/modelith</a>. See that repository for the source code and its license.</p>
<p>SysML® and OMG® are registered trademarks, and KerML™ is a trademark, of Object Management Group, Inc.
Modelith is an independent project. It is not affiliated with or endorsed by OMG.</p>
</footer>
</body>
</html>
`;
}

/**
 * PR に付けるコメントの本文を作る（Markdown）。
 *
 * @param meta 置いた実行のメタデータ
 * @param siteUrl 置き場所のサイトの URL（例：`https://modelith-dev.github.io`。末尾の `/` はあってもなくてもよい）
 * @param limits 大きさの上限（残す数を説明に書く）
 * @returns コメントの本文。先頭に目印（`COMMENT_MARKER`）を置く。ブランチ名などの信頼できない文字列は入れない
 * @example
 * renderComment({ key: "5-2", runId: 5, attempt: 2, sha: "0123456…", pages: ["e2e/index.html"], … }, "https://modelith-dev.github.io/", DEFAULT_LIMITS)
 * // → "<!-- ci-reports -->\n### CI のテストが失敗しました\n\n- [Playwright のレポート（…）](https://modelith-dev.github.io/runs/5-2/report/e2e/index.html)\n…"
 */
export function renderComment(meta: RunMeta, siteUrl: string, limits: Limits): string {
  const site = siteUrl.replace(/\/+$/, "");
  const links = REPORT_PAGES.filter((page) => meta.pages.includes(page.path)).map((page) => `- [${page.labelJa}](${site}/runs/${meta.key}/report/${page.path})`);
  const run = `https://github.com/${meta.repository}/actions/runs/${meta.runId}/attempts/${meta.attempt}`;
  return [
    COMMENT_MARKER,
    "### CI のテストが失敗しました",
    "",
    "テスト結果のページ（画面・操作の記録）を、次の場所に置きました。",
    "",
    ...links,
    "",
    `対象: コミット \`${meta.sha.slice(0, 7)}\` の [実行 ${meta.runId}（${meta.attempt} 回目）](${run})。文字の要約は、この実行の \`${CHECK_JOB}\` ジョブのログにあります。`,
    "",
    `置き場所（[${site}/](${site}/)）はアプリとは別のサイトで、新しいものから ${limits.keepRuns} 回分だけを残します。古いものは消えるので、リンクは切れることがあります。`,
    "",
    "---",
    "_このコメントは CI のワークフロー（CI reports）が自動で付けました。同じ PR では、このコメントを書き換えます。_",
    "",
  ].join("\n");
}

/**
 * PR のコメントの一覧から、前にこのワークフローが付けたコメントを探す。
 *
 * @param comments コメントの一覧（1 つは `{ id, login, body }`。形が違うものは飛ばす）
 * @returns 書き換えるコメントの ID（複数あれば最初のもの）。無ければ null
 * @example
 * findComment([{ id: 7, login: "github-actions[bot]", body: "<!-- ci-reports -->\n…" }]) // → 7
 * findComment([{ id: 8, login: "someone", body: "<!-- ci-reports -->" }])                // → null（ほかの人のコメントは書き換えない）
 * findComment([])                                                                        // → null
 */
export function findComment(comments: unknown[]): number | null {
  for (const comment of comments) {
    if (!isObject(comment) || !isPositiveInteger(comment.id)) continue;
    if (comment.login === COMMENT_AUTHOR && typeof comment.body === "string" && comment.body.startsWith(COMMENT_MARKER)) return comment.id;
  }
  return null;
}
