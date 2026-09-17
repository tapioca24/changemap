import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { cli: "src/cli/main.ts" },
  format: "esm",
  platform: "node",
  target: "node24.11",
  outExtensions: () => ({ js: ".mjs" }),
  dts: false,
  clean: true,
});
