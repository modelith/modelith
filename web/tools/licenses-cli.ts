// cli のパッケージに添えるライセンス文を書き出す（scripts/build-cli.sh が使う）。判断は licenses.ts。
//   node web/tools/licenses-cli.ts <出力のフォルダ>
// - LICENSE.txt：Modelith 本体のライセンス（AGPL-3.0 全文とプラグイン例外）
// - licenses.txt：同梱する第三者の部品（Rust のコアの wasm に組み込まれるクレート）のライセンス
// npm の依存（MCP のライブラリなど）は同梱せず、入れるときに npm が取ってくるので、ここには入れない。
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { appLicense, thirdPartyNotices } from "./licenses.ts";
import { COPYRIGHT, rustCrateParts } from "./licenses-io.ts";

const out = process.argv[2];
if (!out) {
  console.error("使い方: node web/tools/licenses-cli.ts <出力のフォルダ>");
  process.exit(2);
}
const root = new URL("../..", import.meta.url);
mkdirSync(out, { recursive: true });
writeFileSync(
  join(out, "LICENSE.txt"),
  appLicense(COPYRIGHT, readFileSync(new URL("LICENSE", root), "utf8"), readFileSync(new URL("PLUGIN-EXCEPTION.md", root), "utf8")),
);
writeFileSync(join(out, "licenses.txt"), thirdPartyNotices(rustCrateParts()));
console.log(`licenses: ${out} に LICENSE.txt と licenses.txt を書きました`);
