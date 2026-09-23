import type { FileChange } from "../shared/review.js";
import type { DependencyGraph, MergedDependency, MergedFileNode, MergedGraph } from "./model.js";

/** Match identities before selecting neighbors: paths belong to a particular side. */
export function mergeGraphs(
  before: DependencyGraph,
  after: DependencyGraph,
  changes: readonly FileChange[],
): MergedGraph {
  const beforePaths = new Set(before.nodes.map((node) => node.path));
  const afterPaths = new Set(after.nodes.map((node) => node.path));
  const oldIds = new Map<string, string>();
  const newIds = new Map<string, string>();
  const nodes = new Map<string, MergedFileNode>();
  const seeds = new Set<string>();
  const add = (oldPath: string | null, newPath: string | null, change: FileChange | null) => {
    const id = oldPath !== null ? `before:${oldPath}` : `after:${newPath}`;
    if (oldPath !== null) oldIds.set(oldPath, id);
    if (newPath !== null) newIds.set(newPath, id);
    nodes.set(
      id,
      Object.freeze({
        id,
        oldPath,
        newPath,
        status: change?.status ?? "unchanged",
        analyzed: Object.freeze({
          before: oldPath !== null && beforePaths.has(oldPath),
          after: newPath !== null && afterPaths.has(newPath),
        }),
        change,
      }),
    );
    return id;
  };
  // Reserve both sides of every change before matching unchanged paths.
  for (const change of changes) seeds.add(add(change.oldPath, change.newPath, change));
  for (const path of beforePaths) {
    if (!oldIds.has(path)) add(path, newIds.has(path) ? null : path, null);
  }
  for (const path of afterPaths) {
    if (!newIds.has(path)) add(oldIds.has(path) ? null : path, path, null);
  }
  const normalized = (graph: DependencyGraph, ids: Map<string, string>) => {
    const edges = new Map<string, { source: string; target: string }>();
    for (const edge of graph.edges) {
      const source = ids.get(edge.source);
      const target = ids.get(edge.target);
      if (source === undefined || target === undefined) throw new Error("Missing graph endpoint");
      edges.set(JSON.stringify([source, target]), { source, target });
    }
    return edges;
  };
  const oldEdges = normalized(before, oldIds);
  const newEdges = normalized(after, newIds);
  const selected = new Set(seeds);
  const edges: MergedDependency[] = [];
  for (const key of new Set([...oldEdges.keys(), ...newEdges.keys()])) {
    const edge = newEdges.get(key) ?? oldEdges.get(key)!;
    edges.push(
      Object.freeze({
        ...edge,
        status: oldEdges.has(key) ? (newEdges.has(key) ? "unchanged" : "deleted") : "added",
      }),
    );
    if (seeds.has(edge.source) || seeds.has(edge.target)) {
      selected.add(edge.source);
      selected.add(edge.target);
    }
  }
  const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  return Object.freeze({
    nodes: Object.freeze(
      [...nodes.values()]
        .filter((node) => selected.has(node.id))
        .sort((a, b) => compare(a.id, b.id)),
    ),
    edges: Object.freeze(
      edges
        .filter((edge) => selected.has(edge.source) && selected.has(edge.target))
        .sort((a, b) => compare(a.source, b.source) || compare(a.target, b.target)),
    ),
  });
}
