// cli のパッケージに添えるライセンス文を書き出す（scripts/build-cli.sh が使う）。判断は licenses.ts。
//   node web/tools/licenses-cli.ts <出力のフォルダ>
// - LICENSE.txt：Modelith 本体のライセンス（AGPL-3.0 全文とプラグイン例外）
// - licenses.txt：同梱する第三者の部品（Rust のコアの wasm と、PNG を描く wasm に組み込まれるクレート、PNG の図のフォント）のライセンス
// npm の依存（MCP のライブラリなど）は同梱せず、入れるときに npm が取ってくるので、ここには入れない。
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { appLicense, thirdPartyNotices } from "./licenses.ts";
import { COPYRIGHT, fontParts, rustCrateParts } from "./licenses-io.ts";

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
// 両方の wasm に入るクレート（wasm-bindgen など）は、1 回だけ書く
const core = rustCrateParts();
const raster = rustCrateParts("modelith-raster", "PNG を描く wasm の部品（ADR-0029）").filter((p) => !core.some((c) => c.name === p.name));
writeFileSync(join(out, "licenses.txt"), thirdPartyNotices([...core, ...raster, ...fontParts()]));
console.log(`licenses: ${out} に LICENSE.txt と licenses.txt を書きました`);
