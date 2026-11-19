// cli のテスト（単体・結合）。コアは Rust の wasm を使うので、先に scripts/build-wasm.sh が要る（scripts/check.sh が実行する）。
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["src/**/*.test.ts"] },
});
