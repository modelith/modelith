// 図の下に出るインスペクタ（選択中の要素・関係・接続点の情報と操作）。

import { type Entry, lineOf, type ModelEdge, type ModelNode, type PortDir } from "../core";
import { t } from "../l10n";
import { flowDetail, flowName } from "../render/action-flow";
import { eventName } from "../render/sequence";
import { isPseudoState, stateActionLines, stateName } from "../render/state-machine";
import { annotationsHtml, noteTitle } from "./annotations";
import { $, closest, esc } from "./dom";
import { hasShape, resetShape } from "./edge-shape";
import { openProjectFile, otherFileText } from "./other-file";
import { attrText, kindLabel } from "../render/labels";
import type { Pin } from "../render/geometry";
import { centerOn, placeMinimap, render, scrollEditorTo } from "./render";
import { OPS, MSGOPS, PHASEOPS, alignSel, deleteSel, selNodes, setPhaseSel, uniqueChild, type AlignMode } from "./ops";
import { openTab, renderTree, setTab } from "./panels";
import { DIR_LABEL, PINOPS, selPinInfo } from "./pins";
import { relOptions, type RelChoice, type RelKind } from "./relations";
import { activeGapKind, gapGuideHtml, stepGapGuide } from "./gap-guide";
import { gapGuide, gapRelOptions } from "./trace-gap";
import { cancelConnect, clearSel, S } from "./state";
import { commitLayout } from "./sync";
import { CC, curLayout, edgeById, nodeByKey, phaseLabel } from "./views";

const SELECT_STYLE = 'style="border:1px solid var(--rule);border-radius:6px;padding:6px;background:var(--panel2)"';
const DIRS: PortDir[] = ["in", "out", "inout"];
/**
 * 削除ボタンの HTML を作る。削除の確認中（S.confirmDel）は、危険の色で「もう一度押して削除」にする（2 回押しで削除）。
 *
 * @param act ボタンの操作の名前（`data-act` の値。`del`・`delEdge`・`delPort`・`delMulti`）
 * @param label 確認中でないときのボタンの文言
 * @returns `<button …>` の HTML
 * @example
 * // S.confirmDel が false のとき
 * delBtn("del", "削除") // → '<button data-act="del" class="">削除</button>'
 * // S.confirmDel が true のとき
 * delBtn("del", "削除") // → '<button data-act="del" class="danger">もう一度押して削除</button>'
 */
const delBtn = (act: string, label: string): string =>
  `<button data-act="${act}" class="${S.confirmDel ? "danger" : ""}">${esc(S.confirmDel ? t("app-inspect-delete-confirm") : label)}</button>`;
/**
 * 接続点の ID がポートなら、「.ポート名」の形にする（接続の案内で「部品.ポート」と見せるため）。
 *
 * @param pin 接続点の ID（`port:名前`・`a1` など。無ければ null・undefined）
 * @returns `.名前`。ポートでない・無いときは空文字列
 * @example
 * portName("port:p") // → ".p"
 * portName("a1")     // → ""
 * portName(null)     // → ""
 */
const portName = (pin: string | null | undefined): string => (pin?.startsWith("port:") ? `.${pin.slice(5)}` : "");

/**
 * インスペクタを描き直し（何も選んでいなければ隠す）、入力欄があればフォーカスし、ツリーの選択とミニマップの位置も合わせる。
 */
export function renderInspector(): void {
  const box = $("#insp");
  const html = inspectorHtml();
  // 説明の編集中に描き直しても、打ちかけの文を残す（F-EDIT-12）
  const typing = document.querySelector<HTMLTextAreaElement>("#docIn")?.value;
  box.hidden = html === null;
  if (html !== null) box.innerHTML = html;
  const area = document.querySelector<HTMLTextAreaElement>("#docIn");
  if (area && typing !== undefined) area.value = typing;
  focusInput();
  renderTree();
  placeMinimap();
}

/**
 * 入力欄を出したときは、中身を選択してフォーカスし、Enter で確定（名前の変更・メッセージ・ポートの作成・属性）、
 * 名前の変更中と属性の編集中は Escape でやめられるようにする。入力欄が無ければ何もしない。
 */
function focusInput(): void {
  const inp = document.querySelector<HTMLInputElement>("#insp input");
  if (!inp) return;
  setTimeout(() => {
    inp.focus();
    inp.select();
  }, 0);
  const attr = inp.id.startsWith("attr");
  const okAct = inp.id === "renameIn" ? "renameOk" : inp.id === "msgName" ? "msgOk" : attr ? "attrOk" : "portOk";
  // 属性の欄は 3 つあるので、どの欄でも Enter で保存・Escape でやめる
  const fields = attr ? [...document.querySelectorAll<HTMLInputElement>("#insp .attrform input")] : [inp];
  for (const f of fields) {
    f.onkeydown = (ev) => {
      if (ev.key === "Enter") act(okAct);
      if (ev.key === "Escape" && inp.id === "renameIn") act("renameCancel");
      if (ev.key === "Escape" && attr) act("attrCancel");
    };
  }
}

/**
 * インスペクタに表示する HTML を、今の状態から選ぶ。接続モード → 複数選択 → 接続点 → 要素 → 関係の順に調べる。
 *
 * @returns 表示する HTML。何も選んでいない・選んだものが見つからなければ null（インスペクタを隠す）
 * @example
 * // part def A だけを選んでいるとき
 * inspectorHtml() // → '<div class="what"><small>«part def» テキスト 1 行目・縁の＋から線を引けます</small><b>A</b></div>…'
 * // 何も選んでいないとき
 * inspectorHtml() // → null
 */
function inspectorHtml(): string | null {
  if (S.mode === "connect") return connectHtml();
  if (S.selSet.size > 1) return multiHtml();
  const pi = selPinInfo();
  if (pi) return pinHtml(pi.n, pi.pin);
  if (S.sel) {
    const n = nodeByKey(S.sel);
    return n ? nodeHtml(n) : null;
  }
  if (S.selEdge) {
    const ed = edgeById(S.selEdge);
    return ed ? edgeHtml(ed) : null;
  }
  return null;
}

/**
 * 接続モードの案内の HTML を作る。接続先がまだなら接続先を選ぶよう案内し、決まっていれば追加できる関係（relOptions）のボタンを並べる。
 * 線と逆向きの関係（要求 → 検証の線での «verify» など）のボタンには data-reverse を付ける。
 * トレースの抜けの案内から始めた接続（S.connectGap）では、抜けを解消する相手を案内し、その相手なら抜けを解消する関係（gapRelOptions）を並べる。
 *
 * @returns 案内の HTML。接続元が見つからなければ null
 * @example
 * // A から線を引き始め、接続先が未定のとき
 * connectHtml() // → '<div class="what"><small>A から線を引きます</small><b>接続先の要素をタップしてください</b></div>…'
 * // 追加できる関係が無い組み合わせのとき
 * connectHtml() // → '…この組み合わせで追加できる関係はありません…'
 * // 検証の抜けの案内から始め、接続先が未定のとき
 * connectHtml() // → '<div class="what"><small>R から線を引きます</small><b>検証の要素をタップしてください</b></div>…'
 * // 接続元が見つからないとき
 * connectHtml() // → null
 */
function connectHtml(): string | null {
  const a = nodeByKey(S.connectFrom);
  if (!a) return null;
  const fromTxt = portName(S.wire?.from.pin);
  const b = nodeByKey(S.connectTo);
  const target = S.connectGap ? gapGuide(S.connectGap, "").target : null;
  if (!b) {
    return `<div class="what"><small>${esc(t("app-inspect-connect-from", { name: a.name + fromTxt }))}</small><b>${esc(t("app-inspect-connect-tap", { target: target ?? t("app-inspect-connect-target") }))}</b></div><div class="acts"><button data-act="cancel">${esc(t("app-inspect-cancel"))}</button></div>`;
  }
  const fix = S.connectGap ? gapRelOptions(S.connectGap, a, b) : [];
  const opts: RelChoice[] = fix.length ? fix : relOptions(a, b);
  const toTxt = portName(S.wire?.to?.pin);
  const nm = (n: ModelNode): string => (n.flow ? flowName(n) : n.state ? stateName(n) : n.name);
  const why =
    a.flow && b.flow && (!a.name || !b.name)
      ? t("app-inspect-connect-unnamed-flow")
      : a.state && b.state && ((!isPseudoState(a) && !a.name) || (!isPseudoState(b) && !b.name))
        ? t("app-inspect-connect-unnamed-state")
        : t("app-inspect-connect-no-relation");
  return (
    `<div class="what"><small>${esc(t("app-inspect-connect-choose"))}</small><b>${esc(nm(a) + fromTxt)} → ${esc(nm(b) + toTxt)}</b></div><div class="acts">` +
    (opts.length
      ? opts.map((o) => `<button class="primary" data-rel="${o.rel}"${o.reverse ? ' data-reverse="1"' : ""}>${esc(o.label)}</button>`).join("")
      : `<span style="font-size:12px;color:var(--ink2)">${esc(why)}</span>`) +
    `<button data-act="cancel">${esc(t("app-inspect-cancel"))}</button></div>`
  );
}

/**
 * 複数選択のときの HTML を作る。選んだ数と先頭 3 個の名前、整列のボタン、（フェーズの定義があれば）フェーズをまとめて設定する欄、まとめて削除のボタンを出す。
 *
 * @returns 複数選択の HTML
 * @example
 * // A・B・C・D を選んでいるとき
 * multiHtml() // → '<div class="what"><small>4 個を選択中（…）</small><b>A、B、C ほか1個</b></div><div class="acts">…'
 */
function multiHtml(): string {
  const ns = selNodes();
  const phases = S.M.phases;
  const names = ns.slice(0, 3).map((n) => n.name).join(t("app-inspect-list-separator"));
  return (
    `<div class="what"><small>${esc(t("app-inspect-multi-count", { count: String(ns.length) }))}</small><b>${esc(ns.length > 3 ? t("app-inspect-multi-names-more", { names, count: String(ns.length - 3) }) : names)}</b></div><div class="acts">` +
    `<button data-act="alLeft">${esc(t("app-inspect-align-left"))}</button><button data-act="alTop">${esc(t("app-inspect-align-top"))}</button><button data-act="alH">${esc(t("app-inspect-align-hspace"))}</button><button data-act="alV">${esc(t("app-inspect-align-vspace"))}</button>` +
    (phases
      ? `<select id="phaseSelMulti" aria-label="${esc(t("app-inspect-phase-multi-label"))}" ${SELECT_STYLE}><option value="">${esc(t("app-inspect-phase-multi-placeholder"))}</option>${phases.map((p) => `<option value="${esc(p)}">${esc(phaseLabel(p))}</option>`).join("")}</select>`
      : "") +
    delBtn("delMulti", t("app-inspect-delete-multi")) +
    `</div>`
  );
}

/**
 * 選んだ接続点の HTML を作る。ポートなら向きのボタンと削除（アクティビティ図のパラメータなら名前と向きだけ）、ポートにする途中なら名前・型・向きの入力欄、
 * 自由な接続点ならつながる線の数と「ポートにする」「接続点を外す」を出す。
 * ポートにする途中で向きが未定（S.portForm が true）なら、縁の向きから推測した向き（右は出力・左は入力・上下は双方向）を S.portForm に入れる。
 *
 * @param n 接続点を持つ要素
 * @param pin 選んだ接続点
 * @returns 接続点の HTML
 * @example
 * // A の自由な接続点 a1 に線が 1 本つながっているとき
 * pinHtml(A, a1) // → '<div class="what"><small>接続点（A）・線 1 本・ドラッグで移動</small><b>ここからさらに線を引けます</b></div>…'
 * // ポート p（in）のとき
 * pinHtml(A, p)  // → '<div class="what"><small>ポート（A）・ドラッグで縁に沿って移動</small><b>p</b></div>…（入力のボタンが押された状態）'
 * // アクティビティ図のアクション boil のパラメータ w（in）のとき
 * pinHtml(boil, w) // → '<div class="what"><small>パラメータ（boil）・入力</small><b>w : Water</b></div>'
 */
function pinHtml(n: ModelNode, pin: Pin): string {
  const p = pin.port;
  // アクティビティ図のパラメータは、向きや宣言をテキストで書き換える（図からは変えない）
  if (p && n.flow) {
    return `<div class="what"><small>${esc(t("app-inspect-param-where", { owner: n.name, dir: DIR_LABEL[p.dir] }))}</small><b>${esc(p.name)}${p.type ? " : " + esc(p.type) : ""}</b></div>`;
  }
  if (p) {
    return (
      `<div class="what"><small>${esc(t("app-inspect-port-where", { owner: n.name }))}</small><b>${esc(p.name)}${p.type ? " : " + (p.conj ? "~" : "") + esc(p.type) : ""}</b></div><div class="acts">` +
      DIRS.map((d) => `<button data-dir="${d}" aria-pressed="${p.dir === d}" class="${p.dir === d ? "primary" : ""}">${esc(DIR_LABEL[d])}</button>`).join("") +
      delBtn("delPort", t("app-inspect-delete-port")) +
      `</div>`
    );
  }
  if (S.portForm) {
    const pdefs = S.M.nodes.filter((x) => x.kind === "port def").map((x) => x.name);
    const guess: PortDir = pin.side === "r" ? "out" : pin.side === "l" ? "in" : "inout";
    if (S.portForm === true) S.portForm = { dir: guess };
    const f = S.portForm;
    return (
      `<div class="what"><small>${esc(t("app-inspect-port-form-title", { owner: n.name }))}</small></div>` +
      `<input id="portName" value="${esc(f.name || uniqueChild(n.portHost ?? n.entry, "p"))}" aria-label="${esc(t("app-inspect-port-name-label"))}">` +
      `<select id="portType" aria-label="${esc(t("app-inspect-port-type-label"))}" ${SELECT_STYLE}><option value="">${esc(t("app-inspect-type-none"))}</option>${pdefs.map((pd) => `<option ${f.type === pd ? "selected" : ""}>${esc(pd)}</option>`).join("")}</select>` +
      `<div class="acts">${DIRS.map((d) => `<button data-fdir="${d}" aria-pressed="${f.dir === d}" class="${f.dir === d ? "primary" : ""}">${esc(DIR_LABEL[d])}</button>`).join("")}` +
      `<button class="primary" data-act="portOk">${esc(t("app-inspect-create"))}</button><button data-act="portCancel">${esc(t("app-inspect-cancel"))}</button></div>`
    );
  }
  const used = Object.entries(curLayout().ends).filter(([k, v]) => {
    const [, f, to] = k.split("|");
    return (f === n.key && v[0] === pin.id) || (to === n.key && v[1] === pin.id);
  }).length;
  return (
    `<div class="what"><small>${esc(t("app-inspect-anchor-where", { owner: n.name, count: String(used) }))}</small><b>${esc(t("app-inspect-anchor-hint"))}</b></div><div class="acts">` +
    `<button data-act="makePort" class="primary">${esc(t("app-inspect-make-port"))}</button><button data-act="rmAnchor">${esc(t("app-inspect-remove-anchor"))}</button></div>`
  );
}

/**
 * ほかのファイルの要素（ADR-0021）のインスペクタの HTML。図からは書き換えられないので、どのファイルにあるかと、そのファイルを開くボタンだけを出す。
 *
 * @param n 選んだ要素（`file` を持つ）
 * @param path 要素のあるファイル（フォルダからのパス）
 * @returns インスペクタの HTML
 * @example
 * otherFileHtml(Car, "parts.sysml") // → '<div class="what"><small>«part def» parts.sysml の要素</small><b>Car</b></div>…そのファイルを開く…'
 */
function otherFileHtml(n: ModelNode, path: string): string {
  return (
    `<div class="what"><small>${esc(t("app-inspect-other-file-where", { kind: n.kind, path }))}</small><b>${esc(n.name || t("app-inspect-unnamed"))}</b></div><div class="acts">` +
    `<button class="primary" data-act="openFile">${esc(t("app-inspect-open-file"))}</button></div>` +
    `<div class="notes"><div class="note"><p>${esc(otherFileText(path))}</p></div></div>`
  );
}

/**
 * 選んだ要素の HTML を作る。名前の変更中なら入力欄を、n 項の接続の点なら接続の名前と「接続を削除」を、メモなら注釈する相手・本文と「メモを削除」を、
 * 使用・ライフラインなら型と「型の定義へ」を、
 * 定義なら種類・テキストの行・（フェーズの定義があれば）フェーズの選択欄と、名前の変更・関係の追加・削除のボタンを出す。
 * トレースの抜けを案内している定義なら、その案内（gapGuideHtml）を先頭に出す。
 * 使用と定義では、要素に付けたメモと別の言語での表し方（comment・rep）も下に並べる。
 *
 * @param n 選んだ要素
 * @returns 要素の HTML
 * @example
 * // S.text が "part def A;" で A を選んでいるとき
 * nodeHtml(A) // → '<div class="what"><small>«part def» テキスト 1 行目・縁の＋から線を引けます</small><b>A</b></div><div class="acts">…'
 * // 名前の変更中のとき
 * nodeHtml(A) // → '<div class="what"><small>新しい名前（日本語も使えます。参照もまとめて変更されます）</small></div><input id="renameIn" value="A" …>…'
 */
function nodeHtml(n: ModelNode): string {
  if (S.renaming) {
    return `<div class="what"><small>${esc(t("app-inspect-rename-hint"))}</small></div><input id="renameIn" value="${esc(n.name)}" aria-label="${esc(t("app-inspect-rename-label"))}"><div class="acts"><button class="primary" data-act="renameOk">${esc(t("app-inspect-rename-ok"))}</button><button data-act="renameCancel">${esc(t("app-inspect-cancel"))}</button></div>`;
  }
  const e = n.entry;
  if (n.file) return otherFileHtml(n, n.file);
  const line = lineOf(S.text, e.start);
  if (n.junction) {
    // n 項の接続の点（8.2.3.13 の n-ary-connection-dot）。削除すると接続ごと消える
    return (
      `<div class="what"><small>${esc(t("app-inspect-junction-where", { line: String(line) }))}</small><b>${esc(n.name || t("app-inspect-unnamed"))}${e.type ? " : " + esc(e.type) : ""}</b></div><div class="acts">` +
      `<button data-act="goto">${esc(t("app-inspect-show-in-text"))}</button>` +
      delBtn("del", t("app-inspect-delete-connection")) +
      `</div>`
    );
  }
  if (n.note && n.kind === "rep") {
    // 別の言語での表し方（8.2.3.4 の textual-representation）。持ち主の要素の中に書くので、ここでは消さない
    return (
      `<div class="what"><small>${esc(t("app-inspect-rep-where", { line: String(line) }))}</small><b>${esc(n.name || t("app-inspect-unnamed"))}</b></div><div class="acts">` +
      `<button data-act="goto">${esc(t("app-inspect-show-in-text"))}</button>` +
      `</div><div class="notes"><div class="note"><small>${esc(t("app-inspect-rep-language-label"))}</small><p>${esc(e.type)}</p></div><div class="note"><small>${esc(t("app-inspect-body-label"))}</small><pre>${esc(e.body ?? "")}</pre></div></div>`
    );
  }
  if (n.note) {
    // メモ（8.2.3.4 の comment）。注釈する要素と本文を見せ、削除するとコメントごと消える
    const about = (e.about ?? []).map((a) => a.name || t("app-inspect-unnamed")).join(t("app-inspect-list-separator"));
    return (
      `<div class="what"><small>${esc(t("app-inspect-note-where", { line: String(line) }))}</small><b>${esc(n.name || t("app-inspect-unnamed"))}</b></div><div class="acts">` +
      `<button data-act="goto">${esc(t("app-inspect-show-in-text"))}</button>` +
      delBtn("del", t("app-inspect-delete-note")) +
      `</div><div class="notes"><div class="note"><small>${esc(t("app-inspect-note-about-label"))}</small><p>${esc(about)}</p></div><div class="note"><small>${esc(t("app-inspect-body-label"))}</small><p>${esc(e.body ?? "")}</p></div></div>`
    );
  }
  if (n.flow) return flowNodeHtml(n, line);
  if (n.state) return stateNodeHtml(n, line);
  if (n.usage || n.lifeline) {
    return (
      `<div class="what"><small>${esc(n.usage ? t("app-inspect-node-where", { kind: n.kind, line: String(line) }) : t("app-inspect-lifeline-where", { kind: n.kind, line: String(line) }))}</small><b>${esc(n.name)}${e.type ? " : " + esc(e.type) : ""}</b></div><div class="acts">` +
      `<button data-act="goto">${esc(t("app-inspect-show-in-text"))}</button>` +
      (e.type && S.M.byName.has(e.type) ? `<button data-act="openType">${esc(t("app-inspect-open-type"))}</button>` : "") +
      delBtn("del", t("app-inspect-delete")) +
      `</div>` +
      annotationsHtml(e, S.P.entries)
    );
  }
  const phases = S.M.phases;
  const phSel =
    phases && n.isDef
      ? `<select id="phaseSel" aria-label="${esc(t("app-inspect-phase-label"))}" ${SELECT_STYLE}><option value="">${esc(t("app-inspect-phase-none"))}</option>${phases.map((p) => `<option value="${esc(p)}" ${n.phase === p ? "selected" : ""}>${esc(n.phase === p && !n.phaseOwn ? t("render-phase-inherited", { phase: phaseLabel(p) }) : phaseLabel(p))}</option>`).join("")}</select>`
      : "";
  // トレースの抜けを案内しているときは、「テキストで見る」「関係を追加」を案内の中に置く（F-TRACE-2）
  const guide = gapGuideHtml(n);
  return (
    (guide ?? "") +
    `<div class="what"><small>${esc(t("app-inspect-node-where", { kind: n.kind, line: String(line) }))}</small><b>${esc(n.name)}</b></div>${phSel}<div class="acts">` +
    (guide ? `<button data-act="rename">${esc(t("app-inspect-rename"))}</button>` : `<button data-act="goto">${esc(t("app-inspect-show-in-text"))}</button><button data-act="rename">${esc(t("app-inspect-rename"))}</button><button data-act="connect">${esc(t("app-inspect-add-relation"))}</button>`) +
    delBtn("del", t("app-inspect-delete")) +
    `</div>` +
    docHtml(n) +
    // トレースの抜けを案内しているときは、案内と図が狭い画面でも見えるよう、属性の欄を出さない
    (guide ? "" : attrsHtml(n)) +
    annotationsHtml(e, S.P.entries)
  );
}

/**
 * 定義の説明（要求なら「要求の文章」。テキストの `doc /* … *\/`）を見せる欄の HTML を作る（F-EDIT-12）。
 * 編集中なら入力欄と「保存」「やめる」を、そうでなければ今の文と「編集」のボタンを出す。
 *
 * @param n 定義の図の要素
 * @returns 欄の HTML（文字は esc で逃がす）
 * @example
 * // 要求 R（doc /* 3 分で沸かす *\/）を選んでいるとき
 * docHtml(R) // → '<div class="docbox doc"><div class="note"><small>要求の文章</small><p>3 分で沸かす</p></div><div class="acts"><button data-act="docEdit">要求の文章を編集</button></div></div>'
 * // 説明の無い部品定義 A を編集しているとき
 * docHtml(A) // → '<div class="docbox doc"><div class="note"><small>説明</small></div><textarea id="docIn" …></textarea><div class="acts"><button class="primary" data-act="docOk">保存</button>…'
 */
function docHtml(n: ModelNode): string {
  const label = docLabel(n);
  const doc = n.entry.docText ?? n.entry.doc ?? "";
  if (S.docEdit) {
    return (
      `<div class="docbox doc"><div class="note"><small>${esc(t("app-inspect-doc-edit-hint", { label }))}</small></div>` +
      `<textarea id="docIn" rows="4" aria-label="${esc(label)}">${esc(doc)}</textarea>` +
      `<div class="acts"><button class="primary" data-act="docOk">${esc(t("app-inspect-save"))}</button><button data-act="docCancel">${esc(t("app-inspect-cancel"))}</button></div></div>`
    );
  }
  return (
    `<div class="docbox doc"><div class="note"><small>${esc(label)}</small>${doc ? `<p>${esc(doc)}</p>` : `<p class="muted">${esc(t("app-inspect-none-yet"))}</p>`}</div>` +
    `<div class="acts"><button data-act="docEdit">${esc(t("app-inspect-doc-edit", { label }))}</button></div></div>`
  );
}

/**
 * 定義の属性の欄の HTML を作る（F-EDIT-12）。属性を 1 行ずつ「編集」「削除」のボタンと並べ、末尾に「属性を追加」を置く。
 * 編集中の属性（または追加中）は、名前・型・値の入力欄と「保存」「やめる」にする。
 *
 * @param n 定義の図の要素
 * @returns 欄の HTML（文字は esc で逃がす）
 * @example
 * // part def A { attribute mass : Real = 1500; } を選んでいるとき
 * attrsHtml(A) // → '<div class="docbox attrs"><div class="note"><small>属性</small></div><div class="attr"><span>mass : Real = 1500</span><button data-act="attrEdit" data-attr="mass">編集</button>…'
 */
function attrsHtml(n: ModelNode): string {
  const attrs = n.entry.children.filter((c) => c.kind === "attribute");
  const form = (a: Entry | null): string =>
    `<div class="attrform">` +
    `<input id="attrName" value="${esc(a?.name ?? "")}" placeholder="${esc(t("app-inspect-attr-name-placeholder"))}" aria-label="${esc(t("app-inspect-attr-name-label"))}">` +
    `<input id="attrType" value="${esc(a?.type ?? "")}" placeholder="${esc(t("app-inspect-attr-type-placeholder"))}" aria-label="${esc(t("app-inspect-attr-type-label"))}">` +
    `<input id="attrValue" value="${esc(a?.value ?? "")}" placeholder="${esc(t("app-inspect-attr-value-placeholder"))}" aria-label="${esc(t("app-inspect-attr-value-label"))}">` +
    `<div class="acts"><button class="primary" data-act="attrOk">${esc(t("app-inspect-save"))}</button><button data-act="attrCancel">${esc(t("app-inspect-cancel"))}</button></div></div>`;
  const rows = attrs.map((a) =>
    S.attrEdit === a.name
      ? form(a)
      : `<div class="attr"><span>${esc(attrText(a))}</span><button data-act="attrEdit" data-attr="${esc(a.name)}">${esc(t("app-inspect-edit"))}</button><button data-act="attrDel" data-attr="${esc(a.name)}">${esc(t("app-inspect-delete"))}</button></div>`,
  );
  return (
    `<div class="docbox attrs"><div class="note"><small>${esc(t("app-inspect-attrs-title"))}</small>${attrs.length ? "" : `<p class="muted">${esc(t("app-inspect-none-yet"))}</p>`}</div>` +
    rows.join("") +
    (S.attrEdit === "" ? form(null) : `<div class="acts"><button data-act="attrAdd">${esc(t("app-inspect-attr-add"))}</button></div>`) +
    `</div>`
  );
}

/**
 * 説明の欄の呼び方。要求は「要求の文章」、ほかは「説明」と呼ぶ（ADR-0014）。
 *
 * @param n 定義の図の要素
 * @returns 欄の呼び方
 * @example
 * docLabel({ fam: "req", … })  // → "要求の文章"
 * docLabel({ fam: "part", … }) // → "説明"
 */
export const docLabel = (n: Pick<ModelNode, "fam">): string => (n.fam === "req" ? t("app-inspect-doc-label-requirement") : t("app-inspect-doc-label"));

/**
 * アクションの流れの図の要素（8.2.3.17）の HTML を作る。種類の画面の言葉と中身、テキストで見る・名前の変更・順序の線の追加・削除のボタンを出す。
 * 開始・終了はテキストに宣言が無いので、順序の線の追加だけを出す。
 *
 * @param n アクションの流れの図の要素
 * @param line 宣言の行（1 から）
 * @returns 要素の HTML
 * @example
 * // action s send S() to b; を選んでいるとき
 * flowNodeHtml(s, 5) // → '<div class="what"><small>送信（send） テキスト 5 行目・縁の＋から順序の線を引けます</small><b>s</b><small>S() to b</small></div>…'
 * // 開始を選んでいるとき
 * flowNodeHtml(start, 1) // → '<div class="what"><small>開始（start）・順序の線から決まる記号です</small><b>開始</b></div><div class="acts"><button data-act="connect">順序の線を追加</button></div>'
 */
function flowNodeHtml(n: ModelNode, line: number): string {
  const implicit = n.kind === "start" || n.kind === "done";
  const detail = flowDetail(n);
  const where = implicit
    ? t("app-inspect-flow-implicit-where", { label: kindLabel(n.kind), kind: n.kind })
    : t("app-inspect-flow-where", { label: kindLabel(n.kind), kind: n.kind, line: String(line) });
  return (
    `<div class="what"><small>${esc(where)}</small><b>${esc(flowName(n))}</b>${detail && n.name && !implicit ? `<small>${esc(detail)}</small>` : ""}</div><div class="acts">` +
    (implicit ? "" : `<button data-act="goto">${esc(t("app-inspect-show-in-text"))}</button>`) +
    (n.name && !implicit ? `<button data-act="rename">${esc(t("app-inspect-rename"))}</button>` : "") +
    (n.kind === "done" ? "" : `<button data-act="connect">${esc(t("app-inspect-add-succession"))}</button>`) +
    (implicit ? "" : delBtn("del", t("app-inspect-delete"))) +
    `</div>`
  );
}

/**
 * 状態遷移の図の要素（8.2.3.18）の HTML を作る。種類の画面の言葉と名前、entry・do・exit の振る舞い、
 * テキストで見る・名前の変更・遷移の追加・削除のボタンを出す。開始・終了の記号はテキストに宣言が無いので、ボタンを出さない。
 *
 * @param n 状態遷移の図の要素
 * @param line 宣言の行（1 から）
 * @returns 要素の HTML
 * @example
 * // state on { entry action init; } を選んでいるとき
 * stateNodeHtml(on, 5) // → '<div class="what"><small>状態（state） テキスト 5 行目・縁の＋から遷移を引けます</small><b>on</b></div><div class="acts">…</div><div class="notes"><div class="note"><small>振る舞い</small><p>entry / init</p></div></div>'
 * // 開始の記号を選んでいるとき
 * stateNodeHtml(start, 1) // → '<div class="what"><small>開始（start）・最初の遷移から決まる記号です</small><b>開始</b></div><div class="acts"></div>'
 */
function stateNodeHtml(n: ModelNode, line: number): string {
  const pseudo = isPseudoState(n);
  const names = { label: kindLabel(n.kind), kind: n.kind };
  const what = n.parallel ? t("app-inspect-state-what-parallel", names) : t("app-inspect-state-what", names);
  const where = !pseudo
    ? t("app-inspect-state-where", { what, line: String(line) })
    : n.kind === "start"
      ? t("app-inspect-state-start-where", { what })
      : t("app-inspect-state-pseudo-where", { what });
  const actions = pseudo ? [] : stateActionLines(n.entry);
  return (
    `<div class="what"><small>${esc(where)}</small><b>${esc(stateName(n))}</b></div><div class="acts">` +
    (pseudo ? "" : `<button data-act="goto">${esc(t("app-inspect-show-in-text"))}</button>`) +
    (n.name && !pseudo ? `<button data-act="rename">${esc(t("app-inspect-rename"))}</button><button data-act="connect">${esc(t("app-inspect-add-transition"))}</button>` : "") +
    (pseudo ? "" : delBtn("del", t("app-inspect-delete"))) +
    `</div>` +
    (actions.length ? `<div class="notes"><div class="note"><small>${esc(t("app-inspect-state-actions-label"))}</small><p>${actions.map(esc).join("<br>")}</p></div></div>` : "")
  );
}

const EDGE_NAME: Record<string, string> = {
  comp: t("app-inspect-edge-comp"), satisfy: t("app-inspect-edge-satisfy"), verify: t("app-inspect-edge-verify"), frame: t("app-inspect-edge-frame"), flow: t("app-inspect-edge-flow"), defined: t("app-inspect-edge-defined"), derive: t("app-inspect-edge-derive"),
  specialize: t("app-inspect-edge-specialize"), subset: t("app-inspect-edge-subset"), redefine: t("app-inspect-edge-redefine"), reference: t("app-inspect-edge-reference"),
  dependency: t("app-inspect-edge-dependency"), allocate: t("app-inspect-edge-allocate"), bind: t("app-inspect-edge-bind"),
  connect: t("app-inspect-edge-connect"), annotate: t("app-inspect-edge-annotate"),
  succession: t("app-inspect-edge-succession"), successionFlow: t("app-inspect-edge-succession-flow"), transition: t("app-inspect-edge-transition"),
};

/**
 * 選んだ関係（線）の HTML を作る。シーケンス図のメッセージなら番号・送り手と受け手・順番の入れ替え・編集を、
 * ほかの関係なら種類の画面の言葉と両端の名前（開始・終了の記号は画面の言葉）、削除のボタンを出す（メモの線には削除のボタンを出さない）。
 * 遷移は、ラベル（きっかけ [条件] / 行うこと）も種類の後ろに書く。
 *
 * @param ed 選んだ関係
 * @returns 関係の HTML
 * @example
 * // A が要求 R を満たす関係を選んでいるとき
 * edgeHtml(e) // → '<div class="what"><small>要求を満たす «satisfy»</small><b>A → R</b></div>…'
 * // 名前の無いメッセージ（2 個中の 1 番目）のとき
 * edgeHtml(m) // → '<div class="what"><small>メッセージ 1／2：a → b</small><b>（名前なし）</b></div>…（「上へ」は押せない）'
 * // 開始から off への遷移
 * edgeHtml(t) // → '<div class="what"><small>遷移（transition）</small><b>開始 → off</b></div>…'
 * // シーケンス図のイベント a.e から b.r への順序
 * edgeHtml(s) // → '<div class="what"><small>順序（succession）</small><b>a.e → b.r</b></div>…'
 */
function edgeHtml(ed: ModelEdge): string {
  const c = CC();
  const endName = (k: string): string => {
    const n = nodeByKey(k);
    return !n ? (eventName(c.events ?? [], c.nodes, k) ?? "?") : n.state ? stateName(n) : n.flow ? flowName(n) : n.name;
  };
  if (ed.kind === "message") {
    const i = ed.idx ?? 0;
    const count = c.edges.filter((x) => x.kind === "message").length;
    if (S.msgEdit) {
      const items = S.M.nodes.filter((x) => x.kind === "item def").map((x) => x.name);
      return (
        `<div class="what"><small>${esc(t("app-inspect-message-edit-title", { index: String(i + 1) }))}</small></div><input id="msgName" value="${esc(ed.label || "")}" aria-label="${esc(t("app-inspect-message-name-label"))}">` +
        `<select id="msgType" aria-label="${esc(t("app-inspect-message-type-label"))}" ${SELECT_STYLE}><option value="">${esc(t("app-inspect-type-none"))}</option>${items.map((it) => `<option ${ed.type === it ? "selected" : ""}>${esc(it)}</option>`).join("")}</select>` +
        `<div class="acts"><button class="primary" data-act="msgOk">${esc(t("app-inspect-save"))}</button><button data-act="msgCancel">${esc(t("app-inspect-cancel"))}</button></div>`
      );
    }
    return (
      `<div class="what"><small>${esc(t("app-inspect-message-where", { index: String(i + 1), count: String(count), from: nodeByKey(ed.from)?.name ?? "?", to: nodeByKey(ed.to)?.name ?? "?" }))}</small><b>${esc(ed.label || t("app-inspect-unnamed"))}${ed.type ? " : " + esc(ed.type) : ""}</b></div><div class="acts">` +
      `<button data-act="msgUp" ${i === 0 ? "disabled" : ""}>${esc(t("app-inspect-message-up"))}</button><button data-act="msgDown" ${i === count - 1 ? "disabled" : ""}>${esc(t("app-inspect-message-down"))}</button>` +
      `<button data-act="msgEdit">${esc(t("app-inspect-message-edit"))}</button><button data-act="goto">${esc(t("app-inspect-show-in-text"))}</button>` +
      delBtn("delEdge", t("app-inspect-delete")) +
      `</div>`
    );
  }
  const name = EDGE_NAME[ed.kind] ?? ed.kind;
  const title = ed.label && (ed.kind === "comp" || ed.kind === "transition") ? t("app-inspect-edge-with-label", { name, label: ed.label }) : name;
  return (
    `<div class="what"><small>${esc(title)}</small><b>${esc(ed.kind === "annotate" ? noteTitle(nodeByKey(ed.from)?.name ?? "").trim() : endName(ed.from))} → ${esc(endName(ed.to))}</b></div><div class="acts">` +
    `<button data-act="goto">${esc(t("app-inspect-show-in-text"))}</button>` +
    // 調整した線の形を、自動の経路に戻す（F-VIEW-16）
    (hasShape(curLayout(), ed.id) ? `<button data-act="resetShape">${esc(t("app-inspect-reset-shape"))}</button>` : "") +
    // メモの線だけを削除する操作は無い（メモごと削除する）
    (ed.kind === "annotate" ? "" : delBtn("delEdge", t("app-inspect-delete-relation"))) +
    `</div>`
  );
}

/**
 * 選んだ要素の名前の変更を始める（インスペクタに入力欄を出してフォーカスする）。
 */
export function startRename(): void {
  S.renaming = true;
  renderInspector();
}

const ALIGN_ACTS: Record<string, AlignMode> = { alLeft: "left", alTop: "top", alH: "hspace", alV: "vspace" };
/**
 * インスペクタの入力欄・選択欄の今の値を読む。
 *
 * @param sel 入力欄・選択欄の CSS セレクタ（`#renameIn` など）
 * @returns 値。欄が無ければ空文字列
 * @example
 * // #renameIn に "Motor" と入力してあるとき
 * inputValue("#renameIn") // → "Motor"
 * inputValue("#none")     // → ""（欄が無い）
 */
const inputValue = (sel: string): string => document.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(sel)?.value ?? "";

/** 最後に押した属性のボタンの属性の名前（`data-attr`。F-EDIT-12）。 */
let pickedAttr = "";

/**
 * インスペクタ・右クリックメニューのボタンの操作を行う。整列・接続モード・名前の変更・テキストへの移動・削除（2 回押しで確定）・
 * ポートの作成・型の定義を開く・メッセージの編集と並べ替えなどを、名前で振り分けて状態を変え、描き直す。知らない名前なら何もしない。
 *
 * @param a 操作の名前（ボタンの `data-act` の値。`rename`・`del`・`alLeft`・`msgUp` など）
 */
export function act(a: string): void {
  const n = nodeByKey(S.sel);
  const mode = ALIGN_ACTS[a];
  if (mode) {
    alignSel(mode);
    return;
  }
  switch (a) {
    case "cancel":
      cancelConnect();
      render();
      renderInspector();
      return;
    case "rename":
      startRename();
      return;
    case "renameCancel":
      S.renaming = false;
      renderInspector();
      return;
    case "attrAdd":
      S.attrEdit = "";
      renderInspector();
      return;
    case "attrEdit":
      S.attrEdit = pickedAttr;
      renderInspector();
      return;
    case "attrCancel":
      S.attrEdit = null;
      renderInspector();
      return;
    case "attrOk":
      if (n && S.attrEdit !== null) {
        void OPS.setAttribute(n, S.attrEdit || null, inputValue("#attrName"), inputValue("#attrType"), inputValue("#attrValue")).then((ok) => {
          if (!ok) return;
          S.attrEdit = null;
          renderInspector();
        });
      }
      return;
    case "attrDel":
      if (n) void OPS.removeAttribute(n, pickedAttr);
      return;
    case "docEdit":
      S.docEdit = true;
      renderInspector();
      document.querySelector<HTMLTextAreaElement>("#docIn")?.focus();
      return;
    case "docCancel":
      S.docEdit = false;
      renderInspector();
      return;
    case "docOk":
      if (n) {
        void OPS.setDoc(n, inputValue("#docIn")).then((ok) => {
          if (!ok) return;
          S.docEdit = false;
          renderInspector();
        });
      }
      return;
    case "renameOk":
      if (n) {
        void OPS.rename(n, inputValue("#renameIn").trim()).then((ok) => {
          if (!ok) return;
          S.renaming = false;
          renderInspector();
        });
      }
      return;
    case "connect":
      S.connectGap = activeGapKind();
      S.mode = "connect";
      S.connectFrom = S.sel;
      S.connectTo = null;
      S.wire = null;
      render();
      renderInspector();
      return;
    case "resetShape":
      if (S.selEdge) {
        resetShape(curLayout(), S.selEdge);
        commitLayout();
        renderInspector();
      }
      return;
    case "openFile":
      if (n?.file) openProjectFile(n.file);
      return;
    case "goto": {
      const ed = edgeById(S.selEdge);
      setTab("text");
      scrollEditorTo(n ? n.entry.start : ed ? ed.src.start : 0);
      return;
    }
    case "del":
    case "delEdge":
    case "delPort":
    case "delMulti":
      if (!S.confirmDel) {
        S.confirmDel = true;
        renderInspector();
        return;
      }
      S.confirmDel = false;
      deleteSelected(a, n);
      return;
    case "makePort":
      S.portForm = true;
      renderInspector();
      return;
    case "openType": {
      const tn = n && S.M.nodes.find((x) => x.isDef && x.name === n.entry.type);
      if (tn) {
        openTab("structure");
        clearSel();
        S.sel = tn.key;
        render();
        renderInspector();
        centerOn(tn.key);
      }
      return;
    }
    case "msgEdit":
    case "msgCancel":
      S.msgEdit = a === "msgEdit";
      renderInspector();
      return;
    case "msgOk": {
      const ed = edgeById(S.selEdge);
      if (ed) {
        void MSGOPS.update(ed, inputValue("#msgName").trim(), inputValue("#msgType")).then((ok) => {
          if (!ok) return;
          S.msgEdit = false;
          renderInspector();
        });
      }
      return;
    }
    case "msgUp":
    case "msgDown": {
      const ed = edgeById(S.selEdge);
      if (ed) MSGOPS.move(ed, a === "msgUp" ? -1 : 1);
      return;
    }
    case "portCancel":
      S.portForm = false;
      renderInspector();
      return;
    case "portOk": {
      const pi = selPinInfo();
      if (!pi) return;
      const dir = S.portForm && S.portForm !== true ? S.portForm.dir : "inout";
      PINOPS.makePort(pi.n, pi.pin, inputValue("#portName").trim(), dir, inputValue("#portType"));
      return;
    }
    case "rmAnchor": {
      const pi = selPinInfo();
      if (pi) PINOPS.removeAnchor(pi.n, pi.pin.id);
      return;
    }
  }
}

/**
 * 削除の確認が済んだ後、操作の名前に合わせて削除する（要素は OPS.deleteNode、関係は OPS.deleteEdge、ポートは PINOPS.deletePort、複数は deleteSel）。
 * 対象が見つからなければ何もしない。
 *
 * @param a 削除の操作の名前（`del`・`delEdge`・`delPort`・`delMulti`）
 * @param n 選択中の要素（`del` のときに消す要素。無ければ null）
 */
function deleteSelected(a: string, n: ModelNode | null): void {
  if (a === "del" && n) OPS.deleteNode(n);
  else if (a === "delEdge") {
    const ed = edgeById(S.selEdge);
    if (ed) OPS.deleteEdge(ed);
  } else if (a === "delPort") {
    const pi = selPinInfo();
    if (pi) PINOPS.deletePort(pi.n, pi.pin);
  } else if (a === "delMulti") deleteSel();
}

/**
 * インスペクタのイベントを登録する（起動時に 1 回）。フェーズの選択欄の変更と、関係・ポートの向き・ポートの作成の向き・トレースの抜けの前後・操作のボタンのクリックを処理する。
 */
export function initInspector(): void {
  const box = $("#insp");
  box.addEventListener("change", (ev) => {
    const t = ev.target;
    if (!(t instanceof HTMLSelectElement)) return;
    if (t.id === "phaseSel") {
      const n = nodeByKey(S.sel);
      if (n) PHASEOPS.set(n, t.value);
    }
    if (t.id === "phaseSelMulti" && t.value) setPhaseSel(t.value);
  });
  box.addEventListener("click", (ev) => {
    const b = closest<HTMLButtonElement>(ev, "button");
    if (!b) return;
    const { rel, dir, fdir, act: a, gap, attr } = b.dataset;
    if (attr !== undefined) pickedAttr = attr;
    if (rel) {
      const from = nodeByKey(S.connectFrom), to = nodeByKey(S.connectTo);
      if (!from || !to) return;
      if (b.dataset["reverse"]) {
        // 線と逆向きの関係（抜けを解消する関係・要求から引いた «verify» など）は、線の先から元へ引く。線を描いた端は向きが合わないので使わない
        S.wire = null;
        void OPS.connect(to, from, rel as RelKind);
      } else void OPS.connect(from, to, rel as RelKind);
      return;
    }
    if (gap) {
      stepGapGuide(gap === "prev" ? -1 : 1);
      return;
    }
    if (dir) {
      const pi = selPinInfo();
      if (pi?.pin.port) PINOPS.setDir(pi.n, pi.pin.port, dir as PortDir);
      return;
    }
    if (fdir) {
      S.portForm = { dir: fdir as PortDir, name: inputValue("#portName"), type: inputValue("#portType") };
      renderInspector();
      return;
    }
    if (a) act(a);
  });
}
