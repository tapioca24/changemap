import type { ReviewMode } from "../shared/review.js";
import { GitError, gitText } from "./command.js";

export interface ReviewInput {
  readonly mode: ReviewMode;
  readonly target: string;
  readonly compareWith?: string;
}

export function parseInput(args: readonly string[]): ReviewInput {
  if (args.length > 2) throw new Error("Expected at most <target> [compare-with].");
  const target = args[0] === "@" || !args[0] ? "HEAD" : args[0];
  const special = (value: string) => [".", "staged", "working"].includes(value);
  if (args.some((arg) => !arg || arg.startsWith("-") || arg.includes("\0"))) {
    throw new Error("Expected a Git revision, not an option or empty argument.");
  }
  if (args.length === 2) {
    if (special(target) || special(args[1])) {
      throw new Error(
        "Use ., staged, or working alone; two-argument input requires two revisions.",
      );
    }
    return { mode: "compare", target, compareWith: args[1] === "@" ? "HEAD" : args[1] };
  }
  return { mode: special(target) ? (target as ReviewMode) : "commit", target };
}

export async function findRepository(cwd: string): Promise<string> {
  try {
    return await gitText(cwd, ["rev-parse", "--show-toplevel"]);
  } catch {
    throw new Error("Run changemap inside a Git working tree.");
  }
}

export async function resolveCommit(repository: string, ref: string): Promise<string> {
  try {
    return await gitText(repository, [
      "rev-parse",
      "--verify",
      "--end-of-options",
      `${ref}^{commit}`,
    ]);
  } catch {
    throw new Error(
      `No target commit exists for ${JSON.stringify(ref)}. Check the revision or create a commit first.`,
    );
  }
}

export async function resolveHead(repository: string): Promise<string | undefined> {
  try {
    return await resolveCommit(repository, "HEAD");
  } catch (error) {
    // Only an unborn symbolic HEAD represents an empty state, not a broken ref.
    const ref = await gitText(repository, ["symbolic-ref", "-q", "HEAD"]);
    try {
      await gitText(repository, ["show-ref", "--verify", "--quiet", ref]);
    } catch (missing) {
      if (missing instanceof GitError && missing.code === 1) return undefined;
    }
    throw error;
  }
}
