import { mergeGraphs } from "./merge.js";
import type { FileChange } from "../shared/review.js";
import type { DependencyGraph, ReviewGraph } from "./model.js";

export function selectNeighborhood(
  before: DependencyGraph,
  after: DependencyGraph,
  changes: readonly FileChange[],
): ReviewGraph {
  const analyzed = new Set([...before.nodes, ...after.nodes].map((node) => node.path));
  const seeds = new Set(
    changes
      .flatMap((change) => [change.oldPath, change.newPath])
      .filter((path): path is string => path !== null && analyzed.has(path)),
  );
  const selected = new Set(seeds);
  for (const graph of [before, after]) {
    for (const edge of graph.edges) {
      if (seeds.has(edge.source) || seeds.has(edge.target)) {
        selected.add(edge.source);
        selected.add(edge.target);
      }
    }
  }
  const edges = (graph: DependencyGraph) =>
    Object.freeze(
      graph.edges.filter((edge) => selected.has(edge.source) && selected.has(edge.target)),
    );
  return Object.freeze({
    before,
    after,
    merged: mergeGraphs(before, after, changes),
    selection: Object.freeze({
      paths: Object.freeze([...selected].sort()),
      beforeEdges: edges(before),
      afterEdges: edges(after),
      unanalyzedChanges: Object.freeze(
        changes.filter(
          (change) =>
            ![change.oldPath, change.newPath].some((path) => path !== null && analyzed.has(path)),
        ),
      ),
    }),
    incomplete: [before, after].some(
      (graph) =>
        graph.diagnostics.length > 0 ||
        graph.references.some((reference) => reference.outcome === "unresolved"),
    ),
  });
}
