import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const metadata = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
// pnpm may be installed as a JS entry point or a standalone executable (mise).
const pnpm = process.env.npm_execpath;
assert.ok(pnpm, "Run this script with pnpm test:pack");
const temporary = mkdtempSync(join(tmpdir(), "changemap-pack-"));

function runPnpm(args, cwd) {
  const isJavaScript = /\.[cm]?js$/i.test(pnpm);
  const result = spawnSync(
    isJavaScript ? process.execPath : pnpm,
    isJavaScript ? [pnpm, ...args] : args,
    {
      cwd,
      encoding: "utf8",
      timeout: 120_000,
    },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  return result;
}

try {
  runPnpm(["pack", "--pack-destination", temporary], root);
  const archives = readdirSync(temporary).filter((name) => name.endsWith(".tgz"));
  assert.equal(archives.length, 1);
  writeFileSync(join(temporary, "package.json"), JSON.stringify({ private: true }));
  runPnpm(
    ["add", "--prod", "--ignore-scripts", "--offline", join(temporary, archives[0])],
    temporary,
  );
  const installed = join(temporary, "node_modules", "changemap");
  assert.deepEqual(
    readdirSync(installed)
      .filter((name) => name !== "node_modules")
      .sort(),
    ["LICENSE", "README.md", "dist", "package.json"],
  );
  for (const dependency of Object.keys(metadata.devDependencies)) {
    assert.equal(existsSync(join(temporary, "node_modules", dependency)), false);
    assert.equal(existsSync(join(installed, "node_modules", dependency)), false);
  }
  assert.deepEqual(readdirSync(join(installed, "dist")), ["cli.mjs"]);
  // pnpm exec resolves the installed bin shim, including changemap.cmd on Windows.
  const help = runPnpm(["exec", "changemap", "--help"], temporary);
  assert.match(help.stdout, /Usage:/);
  assert.equal(help.stderr, "");
  const version = runPnpm(["exec", "changemap", "--version"], temporary);
  assert.equal(version.stdout.trim(), metadata.version);
  assert.equal(version.stderr, "");
  console.log(
    `Packed CLI passed in an isolated directory (${process.platform}, ${process.version}).`,
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
