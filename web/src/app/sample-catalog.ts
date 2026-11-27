// 公式のサンプル集（F-FILE-20、#92 の段階 1）。「サンプルを開く」の一覧に出すサンプルと、その並びを決める。
// サンプルはどれも Modelith のために書いたもので、リポジトリのライセンスで配る。

import { t } from "../l10n";
import DRONE from "../samples/delivery-drone.sysml?raw";
import KETTLE_LAYOUT from "../samples/electric-kettle.layout.json?raw";
import KETTLE from "../samples/electric-kettle.sysml?raw";
import BEHAVIOR from "../samples/intro-behavior.sysml?raw";
import REQUIREMENTS from "../samples/intro-requirements.sysml?raw";
import STRUCTURE from "../samples/intro-structure.sysml?raw";

/** サンプルの文書（ファイル名・テキスト・配置ファイルの文字列。配置が無ければ空）。 */
export interface SampleDoc {
  name: string;
  text: string;
  layout: string;
}

/** 一覧の 1 件（選ぶための名前と説明を添えたサンプル）。 */
export interface SampleChoice {
  /** 一覧の中で変わらない名前。 */
  id: string;
  /** 一覧に出す名前（分野：題）。 */
  title: string;
  /** 一覧の名前の下に出す説明（何を学べるか）。 */
  note: string;
  doc: SampleDoc;
}

/** 起動したときに開くサンプル（電気ケトル）。 */
export const START_SAMPLE: SampleDoc = { name: "electric-kettle.sysml", text: KETTLE, layout: KETTLE_LAYOUT };

/**
 * 「サンプルを開く」の一覧に出すサンプルを、名前と説明（今の表示の言語）を添えて返す。
 * 入門を先に、分野ごとのまとまったモデルを後に並べる。
 *
 * @returns サンプルの一覧（出す順）
 * @example
 * sampleChoices()[0]
 * // → { id: "intro-requirements", title: "入門：要求のトレース（自転車のライト）", note: "…", doc: { name: "intro-requirements.sysml", … } }
 */
export function sampleChoices(): SampleChoice[] {
  return [
    { id: "intro-requirements", title: t("app-files-samples-intro-requirements-title"), note: t("app-files-samples-intro-requirements-note"), doc: { name: "intro-requirements.sysml", text: REQUIREMENTS, layout: "" } },
    { id: "intro-structure", title: t("app-files-samples-intro-structure-title"), note: t("app-files-samples-intro-structure-note"), doc: { name: "intro-structure.sysml", text: STRUCTURE, layout: "" } },
    { id: "intro-behavior", title: t("app-files-samples-intro-behavior-title"), note: t("app-files-samples-intro-behavior-note"), doc: { name: "intro-behavior.sysml", text: BEHAVIOR, layout: "" } },
    { id: "electric-kettle", title: t("app-files-samples-electric-kettle-title"), note: t("app-files-samples-electric-kettle-note"), doc: START_SAMPLE },
    { id: "delivery-drone", title: t("app-files-samples-delivery-drone-title"), note: t("app-files-samples-delivery-drone-note"), doc: { name: "delivery-drone.sysml", text: DRONE, layout: "" } },
  ];
}
