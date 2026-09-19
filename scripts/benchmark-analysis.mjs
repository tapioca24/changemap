import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { build } from "tsdown";

const directory = await mkdtemp(join(tmpdir(), "changemap-benchmark-"));
try {
  await build({
    config: false,
    entry: { benchmark: "scripts/analysis-benchmark.ts" },
    outDir: directory,
    format: "esm",
    platform: "node",
    target: "node24.11",
    shims: true,
    deps: { alwaysBundle: ["typescript-api"] },
    dts: false,
    outExtensions: () => ({ js: ".mjs" }),
    logLevel: "error",
  });
  for (const size of process.argv.length > 2
    ? process.argv.slice(2)
    : ["100", "10000", process.cwd()]) {
    const result = spawnSync(process.execPath, [join(directory, "benchmark.mjs"), size], {
      stdio: "inherit",
      timeout: 120_000,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Benchmark failed for ${size}: exit ${result.status}`);
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}
