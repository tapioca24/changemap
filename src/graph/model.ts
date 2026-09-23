import type { FileChange } from "../shared/review.js";

export interface FileNode {
  readonly path: string;
}

export interface FileDependency {
  readonly source: string;
  readonly target: string;
}

export interface ModuleReference {
  readonly source: string;
  readonly kind:
    | "import"
    | "export"
    | "import-type"
    | "import-equals"
    | "dynamic-import"
    | "require";
  readonly line: number;
  readonly column: number;
  readonly expression: string;
  readonly specifier?: string;
  readonly outcome: "resolved" | "unresolved" | "excluded";
  readonly target?: string;
  readonly reason?: string;
}

export interface AnalysisDiagnostic {
  readonly path: string;
  readonly message: string;
}

export interface DependencyGraph {
  readonly nodes: readonly FileNode[];
  readonly edges: readonly FileDependency[];
  readonly references: readonly ModuleReference[];
  readonly diagnostics: readonly AnalysisDiagnostic[];
}

export interface ReviewGraph {
  readonly merged: MergedGraph;
  readonly before: DependencyGraph;
  readonly after: DependencyGraph;
  readonly selection: {
    readonly paths: readonly string[];
    readonly beforeEdges: readonly FileDependency[];
    readonly afterEdges: readonly FileDependency[];
    readonly unanalyzedChanges: readonly FileChange[];
  };
  // Includes references and diagnostics outside the selected neighborhood.
  readonly incomplete: boolean;
}

export interface MergedFileNode {
  readonly id: string;
  readonly oldPath: string | null;
  readonly newPath: string | null;
  readonly status: FileChange["status"];
  readonly analyzed: { readonly before: boolean; readonly after: boolean };
  readonly change: FileChange | null;
}

export interface MergedDependency extends FileDependency {
  readonly status: "added" | "deleted" | "unchanged";
}

export interface MergedGraph {
  readonly nodes: readonly MergedFileNode[];
  readonly edges: readonly MergedDependency[];
}
