import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { build } from "tsdown";
const directory = await mkdtemp(join(tmpdir(), "changemap-layout-"));
try {
  await build({
    config: false,
    entry: { layout: "scripts/rendering/layout.mjs" },
    outDir: directory,
    format: "esm",
    platform: "node",
    target: "node24.11",
    dts: false,
    deps: { alwaysBundle: ["@dagrejs/dagre", "@dagrejs/graphlib"] },
    outExtensions: () => ({ js: ".mjs" }),
    logLevel: "error",
  });
  const result = spawnSync(
    process.execPath,
    [join(directory, "layout.mjs"), ...process.argv.slice(2)],
    { stdio: "inherit", timeout: 60_000 },
  );
  if (result.error) console.error(String(result.error));
  process.exitCode = result.status ?? 1;
} finally {
  await rm(directory, { recursive: true, force: true });
}
