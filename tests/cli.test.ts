import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import metadata from "../package.json" with { type: "json" };

const cli = fileURLToPath(new URL("../dist/cli.mjs", import.meta.url));
const run = (args: string[]) => spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });

test("help describes the available commands and unfinished review features", () => {
  const result = run(["--help"]);
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("changemap --help");
  expect(result.stdout).toContain("changemap --version");
  expect(result.stdout).toContain("not implemented yet");
});

test("version matches package metadata", () => {
  const result = run(["--version"]);
  expect(result.status).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toBe(`${metadata.version}\n`);
});

test.each([
  [],
  ["HEAD"],
  ["feature", "main"],
  ["."],
  ["staged"],
  ["working"],
  ["@"],
  ["--unknown"],
  ["--help", "HEAD"],
  ["--version", "--help"],
])("rejects unsupported invocation %j", (...args) => {
  const result = run(args);
  expect(result.status).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("not supported yet");
});
