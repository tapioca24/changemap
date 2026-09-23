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

test.each([
  { name: "default", args: [], before: 1, after: 2 },
  { name: "HEAD alias", args: ["@"], before: 1, after: 2 },
  { name: "single branch", args: ["main"], before: 1, after: 2 },
  { name: "two revisions", args: ["main", "HEAD~1"], before: 1, after: 2 },
  { name: "combined worktree", args: ["."], before: 2, after: 4 },
  { name: "staged", args: ["staged"], before: 2, after: 3 },
  { name: "working", args: ["working"], before: 3, after: 4 },
])(
  "built CLI $name serves consistent full contents and merged dependencies",
  async ({ args, before, after }) => {
    const repo = await repository();
    await repo.write("dependency.ts", "export {};\n");
    const content = (value: number) => `import './dependency';\nexport const value = ${value};\n`;
    await repo.write("file.ts", content(1));
    await repo.commit();
    await repo.write("file.ts", content(2));
    await repo.commit();
    await repo.write("file.ts", content(3));
    await repo.git(["add", "file.ts"]);
    await repo.write("file.ts", content(4));
    const running = await launchCli(repo.root, [...args, "--no-open"]);
    try {
      const snapshot = await fetch(`${running.url}/api/snapshot`).then((response) =>
        response.json(),
      );
      expect(snapshot.changes).toHaveLength(1);
      expect(snapshot.changes[0]).toMatchObject({ status: "modified", newPath: "file.ts" });
      expect(snapshot.graph.merged.edges).toHaveLength(1);
      expect(snapshot.graph.merged.edges[0].status).toBe("unchanged");
      expect(snapshot.graph.incomplete).toBe(false);
      for (const [side, value] of [
        ["before", before],
        ["after", after],
      ] as const) {
        const response = await fetch(
          `${running.url}/api/file?${new URLSearchParams({ side, path: "file.ts", snapshot: snapshot.id })}`,
        );
        expect(response.status).toBe(200);
        expect((await response.json()).content).toBe(content(value));
      }
    } finally {
      await running.stop();
    }
  },
);
