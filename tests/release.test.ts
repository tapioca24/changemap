import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { repository } from "./helpers/repository.js";

const checkRelease = fileURLToPath(new URL("../scripts/check-release.mjs", import.meta.url));

test("release checks require the exact package version tag and a commit on main", async () => {
  const repo = await repository();
  await repo.write("package.json", JSON.stringify({ name: "changemap", version: "1.2.3" }));
  await repo.commit();
  await repo.git(["update-ref", "refs/remotes/origin/main", "HEAD"]);

  const run = (tag: string) =>
    spawnSync(process.execPath, [checkRelease, tag], {
      cwd: repo.root,
      encoding: "utf8",
    });

  const valid = run("v1.2.3");
  expect(valid.status).toBe(0);
  expect(valid.stdout).toContain("changemap@1.2.3 release metadata validated");

  const wrongVersion = run("v1.2.4");
  expect(wrongVersion.status).not.toBe(0);
  expect(wrongVersion.stderr).toContain("Release tag must match package version v1.2.3");

  await repo.write("unmerged.ts", "export {};\n");
  await repo.commit();
  const offMain = run("v1.2.3");
  expect(offMain.status).not.toBe(0);
  expect(offMain.stderr).toContain("Release commit must be on main");
});
