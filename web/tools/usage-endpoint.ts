// 利用状況の受け口（ADR-0026）と、報告で名乗る系列を、ビルドの条件から決める純粋関数。
// 受け口の URL はソースの既定に入れる（n8n・Grafana と同じ）。手元のビルドやフォークも既定で送り、開発用の画面は送らない。

/** 既定の受け口（Modelith のプロジェクトが動かす）。 */
export const DEFAULT_USAGE_ENDPOINT = "https://telemetry.modelith-studio.org/v1/events";

/**
 * ビルドに埋め込む受け口の URL を決める。
 *
 * @param command Vite の動かし方（`build`：配る形の組み立て、`serve`：開発用の画面とテスト）
 * @param configured 環境変数 `MODELITH_USAGE_ENDPOINT` の値（無ければ undefined）
 * @returns 受け口の URL。空なら、何も送らず、知らせも設定も出さないビルドになる
 * @example
 * usageEndpointFor("build", undefined)   // → "https://telemetry.modelith-studio.org/v1/events"（既定で送る）
 * usageEndpointFor("build", "")          // → ""（送らないビルド）
 * usageEndpointFor("build", "/__usage")  // → "/__usage"（渡した受け口へ送る）
 * usageEndpointFor("serve", undefined)   // → ""（開発用の画面は送らない）
 * usageEndpointFor("serve", "/__usage")  // → "/__usage"（渡したときだけ送る）
 */
export function usageEndpointFor(command: "build" | "serve", configured: string | undefined): string {
  if (configured !== undefined) return configured;
  return command === "build" ? DEFAULT_USAGE_ENDPOINT : "";
}

/**
 * 利用状況の報告で名乗る系列を決める。公式のページのビルド（系列を渡して組み立てる）だけが、その系列を名乗る。
 *
 * @param configured 環境変数 `MODELITH_CHANNEL` の値（無ければ undefined）
 * @returns stable・rc・preview のどれかならそれ、ほか（手元のビルド・フォーク）は "other"
 * @example
 * usageChannelFor("preview") // → "preview"
 * usageChannelFor(undefined) // → "other"
 * usageChannelFor("nightly") // → "other"
 */
export function usageChannelFor(configured: string | undefined): "stable" | "rc" | "preview" | "other" {
  return configured === "stable" || configured === "rc" || configured === "preview" ? configured : "other";
}
