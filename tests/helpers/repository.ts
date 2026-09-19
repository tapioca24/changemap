import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach } from "vitest";
import { gitText } from "../../src/git/command.js";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

export async function repository() {
  const root = await mkdtemp(join(tmpdir(), "changemap-test-"));
  directories.push(root);
  const git = (args: string[]) => gitText(root, args);
  await git(["init", "--quiet", "--initial-branch=main", "--template="]);
  await git(["config", "user.name", "Test"]);
  await git(["config", "user.email", "test@example.invalid"]);
  await git(["config", "commit.gpgsign", "false"]);
  await git(["config", "core.autocrlf", "false"]);
  const write = async (path: string, content: string | Buffer) => {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  };
  const commit = async (message = "fixture") => {
    await git(["add", "-A"]);
    await git(["commit", "-qm", message]);
    return git(["rev-parse", "HEAD"]);
  };
  return { root, git, write, commit };
}
