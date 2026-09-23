import { chmod, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, vi } from "vitest";
import { parseInput, findRepository } from "../src/git/input.js";
import { SnapshotSource } from "../src/git/snapshot.js";
import { ReviewSession } from "../src/review/session.js";
import { repository } from "./helpers/repository.js";

const source = (root: string, ...args: string[]) => new SnapshotSource(root, parseInput(args));

test("root commit, default, @, and a single branch compare against the empty state", async () => {
  const repo = await repository();
  await repo.write("hello.ts", "export const hello = true;\n");
  await repo.write("style.css", "body {}\n");
  const oid = await repo.commit();
  for (const args of [[], ["@"], ["main"], [oid]]) {
    const snapshot = await source(repo.root, ...args).capture();
    expect(snapshot.before.kind).toBe("empty");
    expect(snapshot.after.commit).toBe(oid);
    expect(snapshot.summary.changes.map((change) => change.status)).toEqual(["added", "added"]);
  }
});

test("two branches compare tips directly and reverse changes only on the comparison branch", async () => {
  const repo = await repository();
  await repo.write("base.ts", "base\n");
  await repo.commit();
  await repo.git(["checkout", "-qb", "feature"]);
  await repo.write("feature.ts", "feature\n");
  const feature = await repo.commit();
  await repo.git(["checkout", "-q", "main"]);
  await repo.write("main.ts", "main\n");
  const main = await repo.commit();
  const snapshot = await source(repo.root, "feature", "main").capture();
  expect(snapshot.before.commit).toBe(main);
  expect(snapshot.after.commit).toBe(feature);
  expect(snapshot.summary.changes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ oldPath: "main.ts", newPath: null, status: "deleted" }),
      expect.objectContaining({ oldPath: null, newPath: "feature.ts", status: "added" }),
    ]),
  );
  expect(snapshot.records.find((record) => record.newPath === "base.ts")?.status).toBe("unchanged");
  expect((await source(repo.root, "main").capture()).summary.changes).toHaveLength(1);
});

test("a merge uses its first parent, including conflict-resolution edits", async () => {
  const repo = await repository();
  await repo.write("file.ts", "base\n");
  await repo.commit();
  await repo.git(["checkout", "-qb", "feature"]);
  await repo.write("file.ts", "feature\n");
  await repo.commit();
  await repo.git(["checkout", "-q", "main"]);
  await repo.write("file.ts", "main\n");
  const firstParent = await repo.commit();
  await expect(repo.git(["merge", "--no-edit", "feature"])).rejects.toThrow();
  await repo.write("file.ts", "resolved\n");
  await repo.commit("resolve");
  const snapshot = await source(repo.root).capture();
  expect(snapshot.before.commit).toBe(firstParent);
  expect(snapshot.summary.changes[0].patch).toContain("-main\n+resolved");
});

test(". combines staged and unstaged changes; staged freezes the index; working compares index to worktree", async () => {
  const repo = await repository();
  await repo.write("file.ts", "A\n");
  await repo.commit();
  await repo.write("file.ts", "B\n");
  await repo.git(["add", "file.ts"]);
  await repo.write("file.ts", "C\n");
  const staged = await source(repo.root, "staged").capture();
  const working = await source(repo.root, "working").capture();
  const all = await source(repo.root, ".").capture();
  expect(staged.after.files["file.ts"].content).toBe("B\n");
  expect(working.summary.changes[0].patch).toContain("-B\n+C");
  expect(all.summary.changes[0].patch).toContain("-A\n+C");
  await repo.write("file.ts", "A\n");
  expect((await source(repo.root, ".").capture()).summary.changes).toEqual([]);
  expect(staged.after.files["file.ts"].content).toBe("B\n");
});

test("unborn repositories allow ., staged and working, but explain missing default/@ commits", async () => {
  const repo = await repository();
  await repo.write("tracked.ts", "staged\n");
  await repo.git(["add", "tracked.ts"]);
  await repo.write("tracked.ts", "working\n");
  await repo.write("new.css", "new\n");
  expect((await source(repo.root, ".").capture()).summary.changes).toHaveLength(2);
  const staged = await source(repo.root, "staged").capture();
  expect(staged.before.kind).toBe("empty");
  expect(staged.after.files["tracked.ts"].content).toBe("staged\n");
  expect(staged.summary.changes).toHaveLength(1);
  expect((await source(repo.root, "working").capture()).before.files["tracked.ts"].content).toBe(
    "staged\n",
  );
  for (const args of [[], ["@"]])
    await expect(source(repo.root, ...args).capture()).rejects.toThrow("No target commit exists");
});

test("untracked non-TypeScript and binary changes are retained, ignored files are excluded", async () => {
  const repo = await repository();
  await repo.write(".gitignore", "ignored*\n");
  await repo.commit();
  await repo.write("ignored.txt", "hidden");
  await repo.write("new.css", "body {}\n");
  await repo.write("image.bin", Buffer.from([0, 1, 2, 3]));
  for (const mode of [".", "working"]) {
    const snapshot = await source(repo.root, mode).capture();
    expect(snapshot.summary.changes).toHaveLength(2);
    expect(snapshot.after.files["ignored.txt"]).toBeUndefined();
    expect(snapshot.summary.changes.find((change) => change.newPath === "image.bin")).toMatchObject(
      { binary: true, patch: null, status: "added" },
    );
    expect(snapshot.after.files["image.bin"]).toMatchObject({
      encoding: "base64",
      content: "AAECAw==",
    });
  }
  expect((await source(repo.root, "staged").capture()).summary.changes).toEqual([]);
});

test("deletions, Git-detected renames, empty text files and unusual paths survive capture", async () => {
  const repo = await repository();
  const unusual = process.platform === "win32" ? "日本語 file.ts" : "日本語\tline\nbreak.ts";
  await repo.write("old.ts", "one\ntwo\nthree\nfour\nfive\n");
  await repo.write("remove.css", "deleted\n");
  await repo.commit();
  await repo.git(["mv", "old.ts", unusual]);
  await rm(join(repo.root, "remove.css"));
  await repo.write("empty.txt", "");
  const snapshot = await source(repo.root, ".").capture();
  expect(snapshot.summary.changes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ status: "renamed", oldPath: "old.ts", newPath: unusual }),
      expect.objectContaining({ status: "deleted", oldPath: "remove.css" }),
      expect.objectContaining({ status: "added", newPath: "empty.txt", binary: false }),
    ]),
  );
  expect(snapshot.after.files[unusual].content).toContain("five");
});

test("full unchanged contents and before/after analysis settings stay frozen without repository writes", async () => {
  const repo = await repository();
  await repo.write("untouched.ts", "original\n");
  await repo.write("tsconfig.json", '{"compilerOptions":{"strict":false}}');
  await repo.commit();
  await repo.write("tsconfig.json", '{"compilerOptions":{"strict":true}}');
  const index = await readFile(join(repo.root, ".git", "index"));
  const status = await repo.git(["status", "--porcelain=v1", "-uall"]);
  const snapshot = await source(repo.root, ".").capture();
  expect(await readFile(join(repo.root, ".git", "index"))).toEqual(index);
  expect(await repo.git(["status", "--porcelain=v1", "-uall"])).toBe(status);
  await repo.write("untouched.ts", "later\n");
  await repo.write("tsconfig.json", "{}");
  expect(snapshot.after.files["untouched.ts"].content).toBe("original\n");
  expect(snapshot.before.files["tsconfig.json"].content).toContain("false");
  expect(snapshot.after.files["tsconfig.json"].content).toContain("true");
  expect(Object.isFrozen(snapshot.after.files["untouched.ts"])).toBe(true);
});

test("notifications respect staged, . and working inputs, including staging and HEAD-only changes", async () => {
  const repo = await repository();
  await repo.write("file.ts", "A\n");
  const first = await repo.commit();
  const staged = await ReviewSession.create(source(repo.root, "staged"));
  await repo.write("file.ts", "B\n");
  await staged.check();
  expect(staged.status.stale).toBe(false);
  const all = await ReviewSession.create(source(repo.root, "."));
  const working = await ReviewSession.create(source(repo.root, "working"));
  await repo.git(["add", "file.ts"]);
  await staged.check();
  await all.check();
  await working.check();
  expect(staged.status.stale).toBe(true);
  expect(all.status.stale).toBe(false);
  expect(working.status.stale).toBe(true);
  await working.refresh();
  await repo.commit();
  await working.check();
  await all.check();
  expect(working.status.stale).toBe(false);
  expect(all.status.stale).toBe(true);
  await repo.git(["update-ref", "refs/heads/main", first]);
  await working.check();
  expect(working.status.stale).toBe(false);
});

test(". detects reviewed-set changes after staging ignored files and detects settings edits", async () => {
  const repo = await repository();
  await repo.write(".gitignore", "ignored.ts\n");
  await repo.write("tsconfig.json", "{}");
  await repo.commit();
  await repo.write("ignored.ts", "ignored\n");
  const session = await ReviewSession.create(source(repo.root, "."));
  await repo.git(["add", "-f", "ignored.ts"]);
  await session.check();
  expect(session.status.stale).toBe(true);
  await session.refresh();
  await repo.write("tsconfig.json", '{"extends":"./base.json"}');
  await session.check();
  expect(session.status.stale).toBe(true);
});

test("both branch tips trigger notifications, refresh re-resolves, and explicit IDs remain fixed", async () => {
  const repo = await repository();
  await repo.write("file.ts", "A\n");
  const first = await repo.commit();
  await repo.git(["branch", "feature"]);
  const branches = await ReviewSession.create(source(repo.root, "feature", "main"));
  const fixed = await ReviewSession.create(source(repo.root, first.slice(0, 8)));
  const head = await ReviewSession.create(source(repo.root));
  const original = branches.snapshot;
  await repo.write("file.ts", "B\n");
  const second = await repo.commit();
  await branches.check();
  await fixed.check();
  await head.check();
  expect(branches.status.stale).toBe(true);
  expect(head.status.stale).toBe(true);
  expect(fixed.status.stale).toBe(false);
  expect(branches.snapshot).toBe(original);
  await branches.refresh();
  expect(branches.snapshot.before.commit).toBe(second);
  await repo.git(["update-ref", "refs/heads/feature", second]);
  await branches.check();
  expect(branches.status.stale).toBe(true);
  await branches.refresh();
  expect(branches.snapshot.summary.changes).toEqual([]);
  await fixed.refresh();
  expect(fixed.snapshot.after.commit).toBe(first);
});

test("capture retries interrupted reads and leaves a current snapshot intact on exhaustion", async () => {
  const repo = await repository();
  await repo.write("file.ts", "A\n");
  await repo.commit();
  const input = source(repo.root, ".");
  const session = await ReviewSession.create(input);
  const originalFingerprint = input.fingerprint.bind(input);
  const interrupted = vi.spyOn(input, "fingerprint").mockImplementationOnce(async () => {
    await repo.write("file.ts", "B\n");
    return originalFingerprint();
  });
  await session.refresh();
  expect(interrupted).toHaveBeenCalledTimes(2);
  expect(session.snapshot.after.files["file.ts"].content).toBe("B\n");
  interrupted.mockRestore();
  const current = session.snapshot;
  let edits = 0;
  const continuous = vi.spyOn(input, "fingerprint").mockImplementation(async () => {
    await repo.write("file.ts", `edit ${++edits}\n`);
    return originalFingerprint();
  });
  await expect(session.refresh()).rejects.toThrow("after 3 attempts");
  expect(continuous).toHaveBeenCalledTimes(3);
  expect(session.snapshot).toBe(current);
  expect(session.status.error).toContain("changed during capture");
});

test("missing comparison refs preserve the snapshot and can be retried after restoring the ref", async () => {
  const repo = await repository();
  await repo.write("file.ts", "A\n");
  const oid = await repo.commit();
  await repo.git(["branch", "other"]);
  const session = await ReviewSession.create(source(repo.root, "main", "other"));
  const snapshot = session.snapshot;
  await repo.git(["branch", "-D", "other"]);
  await session.check();
  expect(session.status.stale).toBe(true);
  await expect(session.refresh()).rejects.toThrow("other");
  expect(session.snapshot).toBe(snapshot);
  await repo.git(["branch", "other", oid]);
  await session.refresh();
  expect(session.status.error).toBeNull();
});

test.skipIf(process.platform === "win32")(
  "symlinks are captured as links, directory links are not followed, and modes are retained",
  async () => {
    const repo = await repository();
    await repo.write("dir/file.ts", "inside\n");
    await repo.write("run.sh", "#!/bin/sh\n");
    await repo.commit();
    await symlink("/etc/passwd", join(repo.root, "link"));
    await rm(join(repo.root, "dir"), { recursive: true });
    await symlink("/etc", join(repo.root, "dir"));
    await chmod(join(repo.root, "run.sh"), 0o755);
    const snapshot = await source(repo.root, ".").capture();
    expect(snapshot.after.files.link).toMatchObject({ mode: "120000", content: "/etc/passwd" });
    expect(snapshot.after.files["dir/file.ts"]).toBeUndefined();
    expect(snapshot.after.files["run.sh"].mode).toBe("100755");
  },
);

test("invalid mode combinations and repositories produce useful errors", async () => {
  expect(() => parseInput([".", "HEAD"])).toThrow("alone");
  expect(() => parseInput(["main", "working"])).toThrow("alone");
  expect(() => parseInput(["a", "b", "c"])).toThrow("at most");
  expect(() => parseInput(["--bad"])).toThrow("revision");
  await expect(findRepository("/does-not-exist-changemap")).rejects.toThrow("Git working tree");
});

test("intent-to-add is absent from staged contents and added from index to working tree", async () => {
  const repo = await repository();
  await repo.write("base.ts", "base\n");
  await repo.commit();
  await repo.write("new.ts", "new\n");
  await repo.git(["add", "--intent-to-add", "new.ts"]);
  expect((await source(repo.root, "staged").capture()).after.files["new.ts"]).toBeUndefined();
  const working = await source(repo.root, "working").capture();
  expect(working.summary.changes[0]).toMatchObject({
    status: "added",
    oldPath: null,
    newPath: "new.ts",
  });
  await rm(join(repo.root, "new.ts"));
  expect((await source(repo.root, "staged").capture()).summary.changes).toEqual([]);
});

test("shallow boundaries are not mistaken for root commits", async () => {
  const repo = await repository();
  await repo.write("file.ts", "A\n");
  const parent = await repo.commit();
  await repo.write("file.ts", "B\n");
  const tip = await repo.commit();
  await writeFile(join(repo.root, ".git", "shallow"), `${tip}\n`);
  expect((await source(repo.root).capture()).before.commit).toBe(parent);
});

test("uninitialized submodules preserve gitlink identity rather than using the parent HEAD", async () => {
  const repo = await repository();
  await repo.write("base.ts", "base\n");
  const oid = await repo.commit();
  await repo.git(["update-index", "--add", "--cacheinfo", `160000,${oid},sub`]);
  await repo.git(["commit", "-qm", "gitlink"]);
  await mkdir(join(repo.root, "sub"));
  expect((await source(repo.root, ".").capture()).summary.changes).toEqual([]);
});

test("binary modification and deletion retain statuses and mark text diffs unavailable", async () => {
  const repo = await repository();
  await repo.write("modified.bin", Buffer.from([0, 1]));
  await repo.write("deleted.bin", Buffer.from([0, 2]));
  await repo.commit();
  await repo.write("modified.bin", Buffer.from([0, 3]));
  await rm(join(repo.root, "deleted.bin"));
  const snapshot = await source(repo.root, ".").capture();
  expect(snapshot.summary.changes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        status: "modified",
        newPath: "modified.bin",
        binary: true,
        patch: null,
      }),
      expect.objectContaining({
        status: "deleted",
        oldPath: "deleted.bin",
        binary: true,
        patch: null,
      }),
    ]),
  );
});

test("staged detects HEAD-only changes and working detects newly eligible files and settings", async () => {
  const repo = await repository();
  await repo.write("file.ts", "A\n");
  const first = await repo.commit();
  await repo.write("file.ts", "B\n");
  await repo.commit();
  const staged = await ReviewSession.create(source(repo.root, "staged"));
  const working = await ReviewSession.create(source(repo.root, "working"));
  await repo.git(["update-ref", "refs/heads/main", first]);
  await staged.check();
  await working.check();
  expect(staged.status.stale).toBe(true);
  expect(working.status.stale).toBe(false);
  await repo.write("new.ts", "new\n");
  await working.check();
  expect(working.status.stale).toBe(true);
  await working.refresh();
  await repo.write("tsconfig.json", "{}");
  await working.check();
  expect(working.status.stale).toBe(true);
});

test("sparse worktrees are rejected instead of reporting missing checkout files as deleted", async () => {
  const repo = await repository();
  await repo.write("src/included.ts", "included\n");
  await repo.write("other/excluded.ts", "excluded\n");
  await repo.commit();
  await repo.git(["sparse-checkout", "init", "--cone"]);
  await repo.git(["sparse-checkout", "set", "src"]);
  await expect(source(repo.root, ".").capture()).rejects.toThrow("sparse checkouts");
  const staged = await source(repo.root, "staged").capture();
  expect(staged.after.files["other/excluded.ts"].content).toBe("excluded\n");
  expect(staged.summary.changes).toEqual([]);
});

test("dirty submodule contents produce an error instead of disappearing from a worktree review", async () => {
  const child = await repository();
  await child.write("file.ts", "child\n");
  await child.commit();
  const parent = await repository();
  await parent.git(["-c", "protocol.file.allow=always", "submodule", "add", child.root, "sub"]);
  await parent.commit();
  expect((await source(parent.root, ".").capture()).summary.changes).toEqual([]);
  await parent.write("sub/file.ts", "dirty\n");
  await expect(source(parent.root, ".").capture()).rejects.toThrow(
    "uncommitted contents inside submodule",
  );
});
