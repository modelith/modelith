/// <reference types="vite/client" />

/** package.json の version（vite.config.ts で埋め込む）。 */
declare const __APP_VERSION__: string;
/** ビルドしたコミットの SHA（取得できなければ空文字列）。 */
declare const __APP_COMMIT__: string;
/** 著作権表示（vite.config.ts で埋め込む）。 */
declare const __APP_COPYRIGHT__: string;
/** 公開の系列（`stable`：安定版、`rc`：リリース候補版、`preview`：プレビュー版。vite.config.ts で MODELITH_CHANNEL から埋め込む。ADR-0020・ADR-0022）。 */
declare const __APP_CHANNEL__: string;
/** 利用状況の受け口の URL（vite.config.ts で MODELITH_USAGE_ENDPOINT から埋め込む。空なら送らない。ADR-0026）。 */
declare const __USAGE_ENDPOINT__: string;
