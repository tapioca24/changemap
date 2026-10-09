import type { MergedDependency, MergedFileNode, ReviewGraph } from "../graph/model.js";

export type GoView = "packages" | "files";
export type MapFile = {
  kind: "file";
  id: string;
  path: string;
  file: MergedFileNode;
  unresolved: boolean;
};
export type MapPackage = {
  kind: "package";
  id: string;
  path: string;
  files: readonly MergedFileNode[];
  changedCount: number;
  status: "added" | "deleted" | "modified" | "unchanged";
  unresolved: boolean;
};
export type MapNode = MapFile | MapPackage;
export interface MapModel {
  nodes: readonly MapNode[];
  edges: readonly MergedDependency[];
}

const directory = (path: string) => {
  const slash = path.lastIndexOf("/");
  return slash < 0 ? "." : path.slice(0, slash);
};
const packageId = (path: string) => `go-package:${directory(path)}`;
const edgeKey = (source: string, target: string) => JSON.stringify([source, target]);

/** Project the captured file graph without changing file identities or review data. */
export function createMapModel(graph: ReviewGraph, goView: GoView): MapModel {
  const unresolved = new Set(
    (["before", "after"] as const).flatMap((side) =>
      graph[side].references
        .filter((ref) => ref.outcome === "unresolved")
        .map((ref) => `${side}:${ref.source}`),
    ),
  );
  const hasUnresolved = (file: MergedFileNode) =>
    unresolved.has(`before:${file.oldPath}`) || unresolved.has(`after:${file.newPath}`);
  const analyzed = graph.merged.nodes.filter((file) => file.analyzed.before || file.analyzed.after);
  const fileNode = (file: MergedFileNode, path = file.newPath ?? file.oldPath!): MapFile => ({
    kind: "file",
    id: file.id,
    path,
    file,
    unresolved: hasUnresolved(file),
  });
  if (goView === "files")
    return { nodes: analyzed.map((file) => fileNode(file)), edges: graph.merged.edges };

  const packages = new Map<string, Map<string, MergedFileNode>>();
  const files: MapFile[] = [];
  for (const file of analyzed) {
    let otherPath: string | null = null;
    let hasGo = false;
    for (const side of ["before", "after"] as const) {
      const path = side === "before" ? file.oldPath : file.newPath;
      if (path === null || !file.analyzed[side]) continue;
      if (!path.endsWith(".go")) {
        otherPath = path;
        continue;
      }
      hasGo = true;
      const id = packageId(path);
      const members = packages.get(id) ?? new Map<string, MergedFileNode>();
      members.set(file.id, file);
      packages.set(id, members);
    }
    if (otherPath !== null) files.push(hasGo ? fileNode(file, otherPath) : fileNode(file));
  }

  const allPackages = { before: new Set<string>(), after: new Set<string>() };
  const allEdges = {
    before: new Map<string, { source: string; target: string }>(),
    after: new Map<string, { source: string; target: string }>(),
  };
  const visible = new Set<string>();
  for (const side of ["before", "after"] as const) {
    const goPaths = new Set(
      graph[side].nodes.filter((node) => node.path.endsWith(".go")).map((node) => node.path),
    );
    for (const path of goPaths) allPackages[side].add(packageId(path));
    const changedPaths = new Set(
      graph.merged.nodes
        .filter((file) => file.change !== null)
        .map((file) => (side === "before" ? file.oldPath : file.newPath)),
    );
    for (const edge of graph[side].edges) {
      if (!goPaths.has(edge.source) || !goPaths.has(edge.target)) continue;
      const source = packageId(edge.source);
      const target = packageId(edge.target);
      if (source === target) continue;
      const key = edgeKey(source, target);
      allEdges[side].set(key, { source, target });
      // Visibility follows changed files; status follows the full captured package relation.
      if (changedPaths.has(edge.source) || changedPaths.has(edge.target)) visible.add(key);
    }
  }
  const packageNodes: MapPackage[] = [...packages].map(([id, members]) => {
    const files = [...members.values()].sort(
      (a, b) =>
        Number(b.change !== null) - Number(a.change !== null) ||
        (a.newPath ?? a.oldPath!).localeCompare(b.newPath ?? b.oldPath!),
    );
    const changedCount = files.filter((file) => file.change !== null).length;
    return {
      kind: "package",
      id,
      path: id.slice("go-package:".length),
      files,
      changedCount,
      status: !allPackages.before.has(id)
        ? "added"
        : !allPackages.after.has(id)
          ? "deleted"
          : changedCount > 0
            ? "modified"
            : "unchanged",
      unresolved: files.some(hasUnresolved),
    };
  });
  const fileIds = new Set(files.map((file) => file.id));
  const edges: MergedDependency[] = graph.merged.edges.filter(
    (edge) => fileIds.has(edge.source) && fileIds.has(edge.target),
  );
  for (const key of [...visible].sort()) {
    const edge = allEdges.after.get(key) ?? allEdges.before.get(key)!;
    if (!packages.has(edge.source) || !packages.has(edge.target)) continue;
    edges.push({
      ...edge,
      status: !allEdges.before.has(key)
        ? "added"
        : !allEdges.after.has(key)
          ? "deleted"
          : "unchanged",
    });
  }
  return { nodes: [...files, ...packageNodes], edges };
}
