import type { CapturedState } from "../shared/review.js";
import type { DependencyGraph } from "../graph/model.js";
import { analyzeGo, type GoOptions } from "./go.js";
import { analyzeTypeScript } from "./typescript.js";

export interface AnalysisOptions {
  readonly go?: GoOptions;
}

export interface LanguageAnalyzer {
  readonly language: string;
  analyze(
    state: CapturedState,
    options: AnalysisOptions,
  ): DependencyGraph | Promise<DependencyGraph>;
}

const analyzers: readonly LanguageAnalyzer[] = [
  { language: "typescript", analyze: analyzeTypeScript },
  { language: "go", analyze: (state, options) => analyzeGo(state, options.go) },
];

export async function analyzeSnapshot(
  state: CapturedState,
  options: AnalysisOptions = {},
): Promise<DependencyGraph> {
  const graphs = await Promise.all(analyzers.map((analyzer) => analyzer.analyze(state, options)));
  const freeze = <T extends object>(items: readonly T[]) =>
    Object.freeze(items.map((item) => Object.freeze(item)));
  const go = graphs.find((graph) => graph.go)?.go;
  return Object.freeze({
    nodes: freeze(
      graphs
        .flatMap((graph) => graph.nodes)
        .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
    ),
    edges: freeze(
      graphs
        .flatMap((graph) => graph.edges)
        .sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target)),
    ),
    references: freeze(
      graphs
        .flatMap((graph) => graph.references)
        .sort((a, b) => a.source.localeCompare(b.source) || a.line - b.line || a.column - b.column),
    ),
    diagnostics: freeze(graphs.flatMap((graph) => graph.diagnostics)),
    ...(go ? { go } : {}),
  });
}
