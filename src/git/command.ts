import { spawn } from "node:child_process";
import { isUtf8 } from "node:buffer";

export class GitError extends Error {
  constructor(
    readonly args: readonly string[],
    readonly code: number | null,
    detail: string,
  ) {
    super(`Git ${args[0]} failed: ${detail.trim() || `exit ${code}`}`);
  }
}

export async function git(
  cwd: string,
  args: readonly string[],
  input?: Buffer | string,
  environment?: NodeJS.ProcessEnv,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", ["--no-pager", "--literal-pathspecs", ...args], {
      cwd,
      windowsHide: true,
      env: {
        ...process.env,
        GIT_OPTIONAL_LOCKS: "0",
        GIT_TERMINAL_PROMPT: "0",
        GIT_NO_REPLACE_OBJECTS: "1",
        GIT_NO_LAZY_FETCH: "1",
        LC_ALL: "C",
        ...environment,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    const timer = setTimeout(() => child.kill(), 30_000);
    child.stdout.on("data", (data: Buffer) => out.push(data));
    child.stderr.on("data", (data: Buffer) => err.push(data));
    child.on("error", reject);
    // A command that exits before consuming its input reports the Git error below.
    child.stdin.on("error", () => {});
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new GitError(args, code, Buffer.concat(err).toString()));
    });
    child.stdin.end(input);
  });
}

export async function gitText(cwd: string, args: readonly string[]): Promise<string> {
  return (await git(cwd, args)).toString("utf8").trimEnd();
}

export function nulRecords(data: Buffer): string[] {
  if (!isUtf8(data)) throw new Error("Repository paths must be valid UTF-8.");
  return data.toString("utf8").split("\0").filter(Boolean);
}
