// 画面の外の図の書き出し（render/index.ts）を確かめるための、自作の小さなモデルと図の対象。
// 一般の図・内部ブロック図・状態遷移図・シーケンス図を 1 つずつ描けるようにしてある。

import type { ViewTarget } from "../view-content";

/** 自転車のライトのモデル（部品の接続・状態・シナリオを含む）。 */
export const LIGHT_MODEL = `package BikeLight {
  port def Power;
  part def Battery { port pwr : Power; }
  part def Lamp { port pwr : ~Power; }
  part def Light {
    part battery : Battery;
    part lamp : Lamp;
    connect battery.pwr to lamp.pwr;
  }
  state def LightStates {
    entry; then off;
    state off;
    state on;
    transition first off then on;
    transition first on then off;
  }
  occurrence def Switching {
    part rider;
    part light;
    message press from rider to light;
    message glow from light to rider;
  }
}`;

/** 対象・工程の指定の無い図の対象。 */
const AUTO: ViewTarget = { view: "all", modelView: null, ibdCtx: null, seqCtx: null, flowCtx: null, stateCtx: null, phase: "" };

/** 描く図の種類ごとの対象と、図に出るはずの名前。 */
export const LIGHT_DIAGRAMS: { name: string; target: ViewTarget; names: string[] }[] = [
  { name: "一般の図（すべて）", target: AUTO, names: ["Battery", "Lamp", "Light"] },
  { name: "ブロック定義図", target: { ...AUTO, view: "structure" }, names: ["Battery", "Lamp", "Light"] },
  { name: "内部ブロック図", target: { ...AUTO, view: "ibd", ibdCtx: "Light" }, names: ["battery", "lamp", "pwr"] },
  { name: "状態遷移図", target: { ...AUTO, view: "stm", stateCtx: "LightStates" }, names: ["off", "on"] },
  { name: "シーケンス図", target: { ...AUTO, view: "seq", seqCtx: "Switching" }, names: ["rider", "light", "press", "glow"] },
];
