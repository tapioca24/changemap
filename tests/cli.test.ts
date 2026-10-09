import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import metadata from "../package.json" with { type: "json" };
import { dirname } from "node:path";
import { createServer as createTcpServer } from "node:net";
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
  expect(result.stdout).toContain("--editor");
  expect(result.stdout).toContain("--merge-base");
  expect(result.stdout).toContain("changemap <source> <target> --merge-base");
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
  ["--editor"],
  ["--editor="],
  ["--go-os"],
  ["--go-arch="],
  ["--go-tags", "feature,,other"],
  ["--go-os", "../../linux"],
  ["--pr", "1"],
  ["--unknown"],
  ["--merge-base"],
  ["feature", "--merge-base"],
  [".", "--merge-base"],
  ["staged", "HEAD", "--merge-base"],
  ["HEAD", "working", "--merge-base"],
  ["feature", "main", "--merge-base=true"],
  ["--help", "HEAD"],
  ["--version", "--help"],
])("rejects unsupported invocation %j", (...args) => {
  const result = run(args);
  expect(result.status).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("changemap:");
});

test("options default to the preferred port and support explicit OS selection", () => {
  expect(parseOptions([])).toMatchObject({ command: "review", open: true, port: 18473 });
  expect(parseOptions(["--port", "0"])).toMatchObject({ command: "review", port: 0 });
  expect(parseOptions(["--no-open", "working", "--port=4321"])).toMatchObject({
    command: "review",
    open: false,
    port: 4321,
    input: { mode: "working" },
  });
  expect(parseOptions(["working", "--editor", "vim -p"])).toMatchObject({
    command: "review",
    editor: "vim -p",
  });
});

test("Go options accept separate and inline values and normalize build tags", () => {
  expect(
    parseOptions([".", "--go-os", "linux", "--go-arch=arm64", "--go-tags=feature,other,feature"]),
  ).toMatchObject({
    go: { os: "linux", arch: "arm64", tags: ["feature", "other"] },
  });
  expect(parseOptions([])).toMatchObject({ go: {} });
});

test("merge-base accepts two revisions with the flag in any position and normalizes @", () => {
  for (const args of [
    ["feature", "@", "--merge-base"],
    ["--merge-base", "feature", "@"],
    ["feature", "--merge-base", "@"],
  ]) {
    expect(parseOptions(args)).toMatchObject({
      input: { mode: "compare", target: "feature", compareWith: "HEAD", mergeBase: true },
    });
  }
  expect(parseOptions(["@", "main", "--merge-base"])).toMatchObject({
    input: { target: "HEAD", compareWith: "main", mergeBase: true },
  });
  expect(() => parseOptions(["feature", "--merge-base"])).toThrow(
    "--merge-base requires two Git revisions",
  );
  expect(parseOptions(["feature", "main"])).toMatchObject({
    input: { mode: "compare", target: "feature", compareWith: "main" },
  });
});

test("built CLI compares a merge base to the source tip", async () => {
  const repo = await repository();
  await repo.write("base.txt", "base\n");
  const base = await repo.commit();
  await repo.git(["checkout", "-qb", "feature"]);
  await repo.write("feature.txt", "feature\n");
  const feature = await repo.commit();
  await repo.git(["checkout", "-q", "main"]);
  await repo.write("main.txt", "main\n");
  await repo.commit();
  const running = await launchCli(repo.root, ["feature", "main", "--merge-base", "--no-open"]);
  try {
    const snapshot = await fetch(`${running.url}/api/snapshot`).then((response) => response.json());
    expect(snapshot.before.commit).toBe(base);
    expect(snapshot.after.commit).toBe(feature);
    expect(snapshot.changes).toEqual([
      expect.objectContaining({ newPath: "feature.txt", status: "added" }),
    ]);
  } finally {
    await running.stop();
  }
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

test("CLI reports when it uses a port above the preferred port", async () => {
  const repo = await repository();
  await repo.write("file.ts", "A\n");
  await repo.commit();
  const close = (server: ReturnType<typeof createTcpServer>) =>
    new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  let blocker: ReturnType<typeof createTcpServer> | undefined;
  let preferredPort = 0;
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = createTcpServer();
    try {
      await new Promise<void>((resolve, reject) => {
        candidate.once("error", reject);
        candidate.listen(20000 + attempt * 2, "127.0.0.1", resolve);
      });
    } catch (error) {
      if (["EACCES", "EADDRINUSE"].includes((error as NodeJS.ErrnoException).code ?? "")) continue;
      throw error;
    }
    const address = candidate.address();
    if (!address || typeof address === "string") throw new Error("No listening address.");
    const probe = createTcpServer();
    try {
      await new Promise<void>((resolve, reject) => {
        probe.once("error", reject);
        probe.listen(address.port + 1, "127.0.0.1", resolve);
      });
      await close(probe);
      blocker = candidate;
      preferredPort = address.port;
      break;
    } catch (error) {
      await close(candidate);
      if (!["EACCES", "EADDRINUSE"].includes((error as NodeJS.ErrnoException).code ?? ""))
        throw error;
    }
  }
  if (!blocker) throw new Error("Could not find adjacent ports for the CLI test.");
  try {
    const running = await launchCli(repo.root, [".", "--no-open", "--port", `${preferredPort}`]);
    try {
      const actual = Number(new URL(running.url).port);
      expect(actual).toBeGreaterThan(preferredPort);
    } finally {
      await running.stop();
    }
    expect(running.output()).toContain(
      `Port ${preferredPort} is in use; using ${new URL(running.url).port}.`,
    );
  } finally {
    await close(blocker);
  }
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
