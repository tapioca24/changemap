import { randomUUID } from "node:crypto";
import type {
  CapturedState,
  FileChange,
  ReviewSummary,
  StateDescription,
} from "../shared/review.js";
import { gitText } from "./command.js";
import { diffStates } from "./diff.js";
import { resolveCommit, resolveHead, type ReviewInput } from "./input.js";
import {
  commitState,
  emptyState,
  indexEntries,
  indexState,
  stateFingerprint,
  worktreeState,
} from "./state.js";

export interface ReviewSnapshot {
  readonly summary: ReviewSummary;
  readonly before: CapturedState;
  readonly after: CapturedState;
  readonly records: readonly FileChange[];
  readonly fingerprint: string;
}

interface Inputs {
  before: CapturedState;
  after: CapturedState;
  fingerprint: string;
}

export class SnapshotSource {
  private commits = new Map<string, CapturedState>();
  private fixedRefs = new Map<string, string>();
  constructor(
    readonly repository: string,
    readonly input: ReviewInput,
  ) {}

  private async resolve(ref: string): Promise<string> {
    const fixed = this.fixedRefs.get(ref);
    if (fixed) return fixed;
    const oid = await resolveCommit(this.repository, ref);
    // Full and abbreviated object IDs stay fixed after their first resolution.
    // A hex-named branch remains movable.
    if (/^[a-f\d]{4,64}$/i.test(ref)) {
      const symbolic = await gitText(this.repository, [
        "rev-parse",
        "--symbolic-full-name",
        "--verify",
        "--end-of-options",
        ref,
      ]);
      if (!symbolic) this.fixedRefs.set(ref, oid);
    }
    return oid;
  }

  private async commit(oid: string, label: string): Promise<CapturedState> {
    let state = this.commits.get(oid);
    if (!state) {
      state = await commitState(this.repository, oid, label);
      // Retain only a few immutable states while moving branches are polled.
      if (this.commits.size >= 4) this.commits.delete(this.commits.keys().next().value!);
      this.commits.set(oid, state);
    }
    return Object.freeze({ ...state, label });
  }

  async readInputs(): Promise<Inputs> {
    const { repository, input } = this;
    let before: CapturedState;
    let after: CapturedState;
    if (input.mode === "commit" || input.mode === "compare") {
      const target = await this.resolve(input.target);
      after = await this.commit(target, input.target);
      if (input.mode === "compare") {
        before = await this.commit(await this.resolve(input.compareWith!), input.compareWith!);
      } else {
        // rev-list hides parents at shallow boundaries; read the actual commit header.
        const header = (await gitText(repository, ["cat-file", "commit", target])).split(
          "\n\n",
          1,
        )[0];
        const parent = header
          .split("\n")
          .find((line) => line.startsWith("parent "))
          ?.slice(7);
        before = parent ? await this.commit(parent, `${input.target}^1`) : emptyState();
      }
    } else {
      const entries = await indexEntries(repository);
      if (input.mode === "working") {
        before = await indexState(repository);
      } else {
        const head = await resolveHead(repository);
        before = head ? await this.commit(head, "HEAD") : emptyState();
      }
      after =
        input.mode === "staged"
          ? await indexState(repository)
          : await worktreeState(repository, entries);
    }
    return { before, after, fingerprint: `${stateFingerprint(before)}:${stateFingerprint(after)}` };
  }

  async fingerprint(): Promise<string> {
    return (await this.readInputs()).fingerprint;
  }

  async capture(): Promise<ReviewSnapshot> {
    let reason = "The comparison changed during capture.";
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const inputs = await this.readInputs();
        const objectFormat = await gitText(this.repository, ["rev-parse", "--show-object-format"]);
        const changes = await diffStates(inputs.before, inputs.after, objectFormat);
        if (inputs.fingerprint !== (await this.fingerprint())) {
          reason = "The comparison changed during capture.";
          continue;
        }
        const changedPaths = new Set(changes.flatMap((change) => [change.oldPath, change.newPath]));
        const unchanged: FileChange[] = Object.entries(inputs.after.files)
          .filter(([path]) => !changedPaths.has(path))
          .map(([path, file]) =>
            Object.freeze({
              status: "unchanged",
              oldPath: path,
              newPath: path,
              oldMode: file.mode,
              newMode: file.mode,
              binary: file.encoding === "base64",
              patch: file.encoding === "base64" ? null : "",
            }),
          );
        const describe = ({ kind, label, commit }: CapturedState): StateDescription =>
          Object.freeze({ kind, label, ...(commit ? { commit } : {}) });
        return Object.freeze({
          before: inputs.before,
          after: inputs.after,
          fingerprint: inputs.fingerprint,
          records: Object.freeze([...changes, ...unchanged]),
          summary: Object.freeze({
            id: randomUUID(),
            capturedAt: new Date().toISOString(),
            repository: this.repository,
            mode: this.input.mode,
            before: describe(inputs.before),
            after: describe(inputs.after),
            changes,
          }),
        });
      } catch (error) {
        reason = error instanceof Error ? error.message : String(error);
      }
    }
    throw new Error(
      `Could not capture a stable comparison after 3 attempts. ${reason} Stop editing briefly and retry.`,
    );
  }
}
