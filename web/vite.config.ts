import { execSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";
import { createTranslator } from "./src/l10n/translator";
import { cspPlugin } from "./tools/csp";
import { fillHtml } from "./tools/l10n-html";
import { appLicense, thirdPartyNotices, viteCoreLicense, type BundledPart } from "./tools/licenses";
import { COPYRIGHT, rustCrateParts } from "./tools/licenses-io";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

/** ビルドしたコミット。AGPL §13 のソースへのリンクを、動いている版に合わせるために埋め込む。 */
function commitSha(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

/**
 * 配布物にライセンス文を添える（AGPL §5(d)・OFL・MIT）。
 * - LICENSE.txt：Modelith 本体のライセンス（AGPL-3.0 全文とプラグイン例外）
 * - licenses.txt：同梱する第三者の部品（フォント・Vite の実行時コード・Rust のコアのクレート）のライセンス
 */
function bundledLicenses(): Plugin {
  const read = (path: string): string => readFileSync(new URL(path, import.meta.url), "utf8");
  return {
    name: "modelith-licenses",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "LICENSE.txt", source: appLicense(COPYRIGHT, read("../LICENSE"), read("../PLUGIN-EXCEPTION.md")) });
      const parts: BundledPart[] = [
        { name: "@fontsource/ibm-plex-sans-jp", license: "OFL-1.1", usage: "画面の文字（IBM Plex Sans JP）", text: read("./node_modules/@fontsource/ibm-plex-sans-jp/LICENSE") },
        { name: "@fontsource/ibm-plex-mono", license: "OFL-1.1", usage: "テキスト欄の文字（IBM Plex Mono）", text: read("./node_modules/@fontsource/ibm-plex-mono/LICENSE") },
        // npm の配布物にライセンス文が無いので、リポジトリ（projectfluent/fluent.js）の LICENSE と NOTICE を写したものを使う
        {
          name: "@fluent/bundle",
          license: "Apache-2.0",
          usage: "画面の文言を辞書から作る部品",
          text: `${read("./tools/third-party-licenses/@fluent/bundle/NOTICE").trim()}\n\n${read("./tools/third-party-licenses/@fluent/bundle/LICENSE")}`,
        },
        { name: "vite", license: "MIT", usage: "スクリプトを読み込む小さな実行時コード", text: viteCoreLicense(read("./node_modules/vite/LICENSE.md")) },
        ...rustCrateParts(),
      ];
      this.emitFile({ type: "asset", fileName: "licenses.txt", source: thirdPartyNotices(parts) });
    },
  };
}

/**
 * 画面の骨組み（index.html）の文言を、元の言語（0.3.0 の間は日本語）の辞書で埋める（ADR-0027）。
 * スクリプトを読み込む前から文が見えるように、ビルドのとき（開発サーバでは配るとき）に埋める。辞書に無いキーがあれば止める。
 *
 * @returns Vite のプラグイン
 * @example
 * l10nHtml() // index.html の <button data-l10n="shell-save"></button> → <button data-l10n="shell-save">保存</button>
 */
function l10nHtml(): Plugin {
  const dir = new URL("./src/locales/ja/", import.meta.url);
  return {
    name: "modelith-l10n-html",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        const dictionaries = readdirSync(dir)
          .filter((name) => name.endsWith(".ftl"))
          .map((name) => ({ locale: "ja", source: readFileSync(new URL(name, dir), "utf8") }));
        const translate = createTranslator(dictionaries, (problem) => {
          throw new Error(`l10n: ${problem}`);
        });
        return fillHtml(html, translate);
      },
    },
  };
}

export default defineConfig({
  // GitHub Pages ではリポジトリ名のパス（/modelith/）の下に置く。CI が MODELITH_BASE で渡す
  base: process.env.MODELITH_BASE ?? "/",
  define: {
    __APP_COPYRIGHT__: JSON.stringify(COPYRIGHT),
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(commitSha()),
    // 公開の系列（stable・rc・preview）。保存領域の名前を系列ごとに分ける（ADR-0020・ADR-0022）。CI が MODELITH_CHANNEL で渡す
    __APP_CHANNEL__: JSON.stringify(process.env.MODELITH_CHANNEL ?? "stable"),
    // 利用状況の受け口（ADR-0026）。渡さないビルド（手元のビルドなど）は、何も送らない
    __USAGE_ENDPOINT__: JSON.stringify(process.env.MODELITH_USAGE_ENDPOINT ?? ""),
  },
  plugins: [bundledLicenses(), l10nHtml(), cspPlugin(process.env.MODELITH_USAGE_ENDPOINT)],
  server: { fs: { allow: [".."] } },
  // e2e（e2e/*.spec.ts）は Playwright で動かすので、Vitest は src と tools の単体・結合テストだけを拾う
  test: { include: ["src/**/*.test.ts", "tools/**/*.test.ts"], setupFiles: ["src/l10n/setup.ts", "src/core/testing/setup.ts"] },
});
