import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const [tag] = process.argv.slice(2);
const { name, version } = JSON.parse(readFileSync("package.json", "utf8"));

assert.equal(name, "changemap", "Unexpected package name");
assert.equal(tag, `v${version}`, `Release tag must match package version v${version}`);

try {
  execFileSync("git", ["merge-base", "--is-ancestor", "HEAD", "origin/main"], {
    stdio: "pipe",
  });
} catch {
  throw new Error("Release commit must be on main");
}

console.log(`${name}@${version} release metadata validated.`);
