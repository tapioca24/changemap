import type { ReviewGraph } from "../graph/model.js";

export type ReviewMode = "commit" | "compare" | "." | "staged" | "working";
export type ChangeStatus = "added" | "modified" | "deleted" | "renamed" | "unchanged";

export interface CapturedFile {
  readonly mode: string;
  readonly encoding: "utf8" | "base64";
  readonly content: string;
}

export interface StateDescription {
  readonly kind: "commit" | "empty" | "index" | "worktree";
  readonly label: string;
  readonly commit?: string;
}

export interface CapturedState extends StateDescription {
  // All repository files are retained, including unchanged files and analysis settings.
  readonly files: Readonly<Record<string, CapturedFile>>;
}

export interface FileChange {
  readonly status: ChangeStatus;
  readonly oldPath: string | null;
  readonly newPath: string | null;
  readonly oldMode: string | null;
  readonly newMode: string | null;
  readonly binary: boolean;
  // null means unavailable, while an empty string is a valid empty text diff.
  readonly patch: string | null;
  // Display-only patch generated with Git -w from the same captured states.
  readonly whitespacePatch?: string | null;
}

export interface ReviewSummary {
  readonly id: string;
  readonly capturedAt: string;
  readonly repository: string;
  readonly mode: ReviewMode;
  readonly before: StateDescription;
  readonly after: StateDescription;
  readonly changes: readonly FileChange[];
  readonly graph: ReviewGraph;
}

export interface ReviewStatus {
  readonly snapshotId: string;
  readonly stale: boolean;
  readonly refreshing: boolean;
  readonly error: string | null;
}
