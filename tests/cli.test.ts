import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import metadata from "../package.json" with { type: "json" };
import { dirname } from "node:path";
import { parseOptions } from "../src/cli/options.js";
import { repository } from "./helpers/repository.js";
import { launchCli } from "./helpers/cli.js";

const cli = fileURLToPath(new URL("../dist/cli.mjs", import.meta.url));
const run = (args: string[], cwd?: string) =>
  spawnSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8", timeout: 10000 });

test("help describes implemented comparisons, server lifecycle, and options", () => {
  const result = run(["--help"]);
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("changemap --help");
  expect(result.stdout).toContain("changemap --version");
  expect(result.stdout).toContain("--no-open");
  expect(result.stdout).toContain("Ctrl+C");
  expect(result.stdout).toContain("staged");
});

test("version matches package metadata", () => {
  const result = run(["--version"]);
  expect(result.status).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toBe(`${metadata.version}\n`);
});

test.each([
  ["a", "b", "c"],
  [".", "HEAD"],
  ["--port"],
  ["--port", "-1"],
  ["--port=65536"],
  ["--port=abc"],
  ["--pr", "1"],
  ["--unknown"],
  ["--help", "HEAD"],
  ["--version", "--help"],
])("rejects unsupported invocation %j", (...args) => {
  const result = run(args);
  expect(result.status).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("changemap:");
});

test("options default to opening a browser with a free port and support suppression", () => {
  expect(parseOptions([])).toMatchObject({ command: "review", open: true, port: 0 });
  expect(parseOptions(["--no-open", "working", "--port=4321"])).toMatchObject({
    command: "review",
    open: false,
    port: 4321,
    input: { mode: "working" },
  });
});

test("CLI reports missing repositories and commits", async () => {
  const repo = await repository();
  const missing = run(["--no-open"], repo.root);
  expect(missing.status).toBe(1);
  expect(missing.stderr).toContain("No target commit exists");
  const outside = run(["--no-open"], dirname(repo.root));
  expect(outside.status).toBe(1);
  expect(outside.stderr).toContain("Git working tree");
});

test("built CLI starts the packaged React app for an empty review and keeps serving after requests end", async () => {
  const repo = await repository();
  await repo.write("file.ts", "A\n");
  await repo.commit();
  const running = await launchCli(repo.root, [".", "--no-open"]);
  try {
    expect(
      (await fetch(`${running.url}/api/snapshot`).then((response) => response.json())).changes,
    ).toEqual([]);
    const html = await fetch(running.url).then((response) => response.text());
    expect(html).toContain('<div id="root">');
    expect(html).toMatch(/\/assets\/.*\.js/);
    expect((await fetch(`${running.url}/api/status`)).status).toBe(200);
  } finally {
    await running.stop();
  }
  await expect(fetch(running.url)).rejects.toThrow();
});

test.skipIf(process.platform === "win32")(
  "SIGINT gracefully exits the CLI and releases its port",
  async () => {
    const repo = await repository();
    const running = await launchCli(repo.root, [".", "--no-open"]);
    const result = await running.stop("SIGINT");
    expect(result).toEqual({ code: 0, signal: null });
    await expect(fetch(running.url)).rejects.toThrow();
  },
);
