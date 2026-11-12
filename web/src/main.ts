// Modelith の起動。各モジュールのイベントを登録し、前回の続き（無ければ公開サンプル）を読み込む。
import "@fontsource/ibm-plex-sans-jp/400.css";
import "@fontsource/ibm-plex-sans-jp/500.css";
import "@fontsource/ibm-plex-sans-jp/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./style.css";
import SAMPLE from "./samples/electric-kettle.sysml?raw";
import SAMPLE_LAYOUT from "./samples/electric-kettle.layout.json?raw";
import { initCanvas, fit } from "./app/canvas";
import { stageLabel } from "./app/stage";
import { initCtxMenu } from "./app/ctxmenu";
import { initDiagramList } from "./app/diagram-list";
import { $, isFormField, store } from "./app/dom";
import { FieldHistory, globalShortcut } from "./app/keyboard";
import { modalOpen } from "./app/modal";
import { initEditor } from "./app/editor";
import { initWordHelp } from "./app/word-help";
import { initTextMode } from "./app/text-mode";
import { initExportDialog, showExportDialog } from "./app/export-dialog";
import { initLevelsDialog, showLevelsDialog } from "./app/levels-dialog";
import { initFiles } from "./app/files";
import { closeMenus, initMenuBar } from "./app/menubar";
import { initHistory, redo, undo } from "./app/history";
import { initInspector, renderInspector } from "./app/inspector";
import { setSelection } from "./app/ops";
import { createDiagram } from "./app/view-ops";
import { applyPanes, DOC_TABS_KEY, initPanels, initTabs, loadUi, resumeTabs, saveUi, TABS_KEY, UI_KEY } from "./app/panels";
import { loadingView, watchLoading } from "./app/loading";
import { recoveryHtml, showStartupBox, startupErrorHtml } from "./app/recovery";
import { highlight, render, renderMinimap } from "./app/render";
import { S } from "./app/state";
import { DEFS } from "./render/svg";
import { attachCore, coreHooks, onAnalyzed, relayout, settled, toast } from "./app/sync";
import { installUnexpectedErrorHandlers } from "./app/unexpected";
import { CC } from "./app/views";
import { superviseCore } from "./core";
import CoreWorker from "./core/worker?worker";
import CORE_WASM from "./core/wasm/modelith_core_bg.wasm?url";

const EDGE_KEY = "modelith-edgestyle";

// 予期しない例外（捕まえていない例外・結果を待たない処理の失敗）の受け口は、ここに 1 つだけ置く（Q-7）。
// 黙って止まらずにトーストで知らせ、詳しい内容はコンソールに残す
installUnexpectedErrorHandlers(window, toast, (detail) => console.error("予期しない問題:", detail));

/**
 * 線の描き方を切り替え、図のツールバーのボタンの文言と、表示のメニューの「線の形」の ✓ を合わせ、
 * 選んだ描き方を覚える（次に開いたときも使う）。図の描き直しはしない。
 *
 * @param s 線の描き方（"ortho" は直角、"curve" は曲線）
 */
function setEdgeStyle(s: "ortho" | "curve"): void {
  S.edgeStyle = s;
  $("#btnEdge").textContent = s === "curve" ? "線：曲線" : "線：直角";
  $("#menuEdgeOrtho").setAttribute("aria-pressed", String(s === "ortho"));
  $("#menuEdgeCurve").setAttribute("aria-pressed", String(s === "curve"));
  store.set(EDGE_KEY, s);
}

/**
 * メニューを組み立てる。メニューバーの振る舞い（Q-9）をつなぎ、ファイルのメニューの「エクスポート…」をつなぎ、
 * 版・著作権・動いている版のソースとライセンスへのリンク（AGPL §13）を入れる。
 */
function initMenus(): void {
  initMenuBar();
  $("#btnExport").onclick = () => {
    closeMenus();
    showExportDialog();
  };
  $("#menuLevels").onclick = () => {
    closeMenus();
    showLevelsDialog();
  };
  $("#appVersion").textContent = __APP_VERSION__ + (__APP_COMMIT__ ? ` (${__APP_COMMIT__.slice(0, 7)})` : "");
  // 見出しの札と「ヘルプ」の開発段階は、版の名前（alpha・beta・rc）から決める。正式版では出さない
  const stage = stageLabel(__APP_VERSION__);
  const badge = $("#stageBadge");
  badge.hidden = !stage;
  if (stage) {
    badge.textContent = stage.badge;
    badge.title = `${stage.note}です。保存形式や操作は予告なく変わります`;
  }
  $("#stageNote").textContent = stage ? `（${stage.note}）` : "";
  $("#appCopyright").textContent = __APP_COPYRIGHT__;
  // AGPL §13：動いている版のソースを指す
  if (__APP_COMMIT__) $<HTMLAnchorElement>("#sourceLink").href = `https://github.com/modelith/modelith/tree/${__APP_COMMIT__}`;
  // ライセンスの中身（AGPL-3.0・プラグイン例外・無保証）は、動いている版の GitHub のライセンスの節で読んでもらう
  if (__APP_COMMIT__) $<HTMLAnchorElement>("#licenseLink").href = `https://github.com/modelith/modelith/blob/${__APP_COMMIT__}/README.md#license`;
}

/** 線の描き方を、直角と曲線で切り替えて描き直す（図のツールバーの「線：…」）。 */
function toggleEdgeStyle(): void {
  chooseEdgeStyle(S.edgeStyle === "curve" ? "ortho" : "curve");
}

/**
 * 線の描き方を選んで描き直す（表示のメニューの「線の形」の「直角」「曲線」）。
 *
 * @param s 線の描き方（"ortho" は直角、"curve" は曲線）
 */
function chooseEdgeStyle(s: "ortho" | "curve"): void {
  setEdgeStyle(s);
  render();
}

/** 表示中の図を自動で並べ直し、全体を表示する（図のツールバーと図のメニューの「整列」）。 */
function relayoutView(): void {
  relayout();
  fit();
  toast("このビューを並べ直しました");
}

/** 全体図（ミニマップ）の表示を切り替え、設定を保存する（図の右下の「全体図」と、表示のメニューの「全体図」）。 */
function toggleMinimap(): void {
  S.ui.mini = !S.ui.mini;
  saveUi();
  renderMinimap();
}

/** 表示中の図の要素をすべて選択する（Ctrl/⌘+A と、編集のメニューの「すべて選択」）。 */
function selectAll(): void {
  setSelection(CC().nodes.map((n) => n.key));
  render();
  highlight();
  renderInspector();
}

/**
 * ツールバーのボタン（ビューとして保存・線の描き方・並べ直し・ミニマップ）と、同じ操作のメニューの項目（編集・表示・図。線の形は表示）と、
 * キーボードの近道（Ctrl/⌘+A ですべて選ぶ、Ctrl/⌘+Z で元に戻す、Ctrl/⌘+Shift+Z・Ctrl/⌘+Y でやり直す）をつなぐ。
 */
function initToolbar(): void {
  $("#btnSaveView").onclick = $("#menuSaveView").onclick = () => void createDiagram();
  $("#btnEdge").onclick = toggleEdgeStyle;
  $("#menuEdgeOrtho").onclick = () => chooseEdgeStyle("ortho");
  $("#menuEdgeCurve").onclick = () => chooseEdgeStyle("curve");
  $("#btnLayout").onclick = $("#menuLayout").onclick = relayoutView;
  $("#menuSelectAll").onclick = selectAll;
  $("#miniHide").onclick = (ev) => {
    ev.stopPropagation();
    S.ui.mini = false;
    saveUi();
    renderMinimap();
  };
  $("#zMini").onclick = $("#menuMini").onclick = toggleMinimap;
  document.addEventListener("keydown", (ev) => {
    if (!(ev.ctrlKey || ev.metaKey) || ev.altKey) return;
    const k = ev.key.toLowerCase();
    // ダイアログの間と、入力欄の中の元に戻す・すべて選ぶは、画面全体の近道にしない（Q-8。#233・#234）。
    // テキスト欄（#ed）の元に戻す・やり直すは、モデルの履歴で行うので入力欄に数えない（F-EDIT-4）
    const editor = ev.target instanceof HTMLElement && ev.target.id === "ed";
    if (fieldUndo(ev, k, editor)) return;
    if (!globalShortcut(k, isFormField(ev.target) && !editor, modalOpen())) return;
    if (k === "a" && editor) return;
    if (k === "a") {
      ev.preventDefault();
      selectAll();
    } else if (k === "z") {
      ev.preventDefault();
      if (ev.shiftKey) redo();
      else undo();
    } else if (k === "y") {
      ev.preventDefault();
      redo();
    }
  });
}

/** 入力欄（テキスト欄を除く）ごとの、元に戻す・やり直すの記録（Q-8。#266）。 */
const fieldHistories = new WeakMap<HTMLInputElement | HTMLTextAreaElement, FieldHistory>();

/**
 * 記録を持つ入力欄か（文字を入れる input と textarea。テキスト欄 #ed はモデルの履歴で戻すので除く）。
 *
 * @param t イベントの対象
 * @returns 記録を持つ入力欄なら、その要素。そうでなければ null
 * @example
 * historyField(document.querySelector("#treeSearch")) // → その input
 * historyField(document.querySelector("#ed"))         // → null（テキスト欄）
 * historyField(document.body)                         // → null
 */
function historyField(t: EventTarget | null): HTMLInputElement | HTMLTextAreaElement | null {
  if (t instanceof HTMLTextAreaElement) return t.id === "ed" ? null : t;
  if (t instanceof HTMLInputElement && /^(text|search|url|email|tel|number|)$/.test(t.type)) return t;
  return null;
}

/**
 * 入力欄の中の Ctrl+Z・Ctrl+Shift+Z・Ctrl+Y を、その欄の記録で行う（ブラウザの取り消しに任せると、欄に戻すものが無いとき
 * テキスト欄の入力まで戻してしまうため。Q-8。#266）。戻すものが無ければ何もしない。
 *
 * @param ev キーの押下
 * @param k 押したキー（小文字）
 * @param editor 入力先がテキスト欄か
 * @returns 入力欄の中の取り消し・やり直しとして扱ったら true（画面全体の近道にはしない）
 * @example
 * fieldUndo(絞り込みの欄での Ctrl+Z, "z", false) // → true（欄の前の値に戻す。戻すものが無ければ何もしない）
 * fieldUndo(図の上での Ctrl+Z, "z", false)       // → false（画面全体の元に戻すにする）
 * fieldUndo(テキスト欄での Ctrl+Z, "z", true)    // → false
 */
function fieldUndo(ev: KeyboardEvent, k: string, editor: boolean): boolean {
  const f = editor ? null : historyField(ev.target);
  if (!f || (k !== "z" && k !== "y")) return false;
  ev.preventDefault();
  const h = fieldHistories.get(f);
  const v = !h ? null : k === "y" || ev.shiftKey ? h.redo() : h.undo();
  if (v !== null) {
    f.value = v;
    f.dispatchEvent(new Event("input", { bubbles: true }));
  }
  return true;
}

// 入力欄に入ったら記録を始め、入力のたびに値を記録する（取り消しで戻した値は、同じ値なので記録されない）
document.addEventListener("focusin", (ev) => {
  const f = historyField(ev.target);
  if (f && !fieldHistories.has(f)) fieldHistories.set(f, new FieldHistory(f.value));
});
document.addEventListener("input", (ev) => {
  const f = historyField(ev.target);
  if (f) fieldHistories.get(f)?.record(f.value);
}, true);

// 解析と図の操作に使う Rust のコア（wasm）を Worker で動かし、使える状態になってから画面を組み立てる（ADR-0015・ADR-0016）。
// コアが止まった・返事をしないときは作り直す（Q-7）。待つ間に読み込みの始まったフォントも待ち、図を画面に合わせる計算を毎回同じ文字の幅で行う。
// 待つ間は「読み込み中…」（index.html の #loading）を示し、時間がかかれば案内に切り替えて待ち続ける（Q-5）
const loaded = watchLoading(loadingView(document.querySelector<HTMLElement>("#loading")));
try {
  const [core] = await Promise.all([superviseCore(() => new CoreWorker(), new URL(CORE_WASM, location.href).href, onAnalyzed, coreHooks), document.fonts.ready]);
  loaded();
  attachCore(core);
} catch (e) {
  loaded();
  showStartupBox(startupErrorHtml(e));
  // 続きの組み立てはしない（解析できないまま画面を組み立てると、壊れた状態で操作できてしまう）
  await new Promise<never>(() => {});
}

/**
 * 保存した設定（パネルの配置・図のタブ）を消して、ページを読み直す（Q-7）。下書き・前回の続き・プラグインの許可は消さない。
 */
function resetSettingsAndReload(): void {
  for (const key of [UI_KEY, TABS_KEY, DOC_TABS_KEY]) store.remove(key);
  location.reload();
}

// 画面の組み立て。途中で失敗したら、白い画面のままにせず、保存した設定を初期化して読み直す操作を示す（Q-7）
try {
  $("#defs").innerHTML = DEFS;
  loadUi();
  if (store.get(EDGE_KEY) === "curve") setEdgeStyle("curve");
  initInspector();
  initPanels();
  initCanvas();
  initCtxMenu();
  initDiagramList();
  initEditor();
  initWordHelp();
  initTextMode();
  initHistory();
  initExportDialog();
  initLevelsDialog();
  initMenus();
  initToolbar();
  await initFiles({ name: "electric-kettle.sysml", text: SAMPLE, layout: SAMPLE_LAYOUT }, { onResumed: resumeTabs });
  // タブの対象を選び、図を画面に合わせるのは、最初の解析結果が届いてから
  await settled();
  applyPanes();
  initTabs();
} catch (e) {
  console.error("起動に失敗:", e);
  const box = showStartupBox(recoveryHtml(e));
  box.querySelector<HTMLButtonElement>("#btnResetSettings")?.addEventListener("click", resetSettingsAndReload);
}
