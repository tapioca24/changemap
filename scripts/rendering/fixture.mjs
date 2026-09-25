// Deterministic synthetic review; all files changed so the entire graph is visible.
export function renderingFixture(size, shape = "layered") {
  if (!Number.isInteger(size) || size < 40) throw new Error("Size must be an integer >= 40");
  if (!["layered", "grouped", "chain", "hub"].includes(shape))
    throw new Error("Unknown graph shape");
  const changes = Array.from({ length: size }, (_, i) => ({
    status: "modified",
    oldPath:
      shape === "grouped" ? `src/area-${i % 20}/module-${i % 5}/file-${i}.ts` : `src/file-${i}.ts`,
    newPath:
      shape === "grouped" ? `src/area-${i % 20}/module-${i % 5}/file-${i}.ts` : `src/file-${i}.ts`,
    oldMode: "100644",
    newMode: "100644",
    binary: false,
    patch: "@@ -1 +1 @@\n-export const value = 1;\n+export const value = 2;",
  }));
  const nodes = changes.map((change, i) => ({
    id: `file-${i}`,
    oldPath: change.oldPath,
    newPath: change.newPath,
    status: change.status,
    analyzed: { before: true, after: true },
    change,
  }));
  const pairs = new Map();
  const add = (source, target) =>
    pairs.set(`${source}:${target}`, {
      source: `file-${source}`,
      target: `file-${target}`,
      status: "unchanged",
    });
  if (shape === "layered" || shape === "grouped") {
    // Ten nodes per layer; forward references avoid turning the benchmark into
    // only a disconnected-node or simple-chain best case.
    for (let i = 0; i < size; i++)
      for (const offset of [10, 11, 12]) if (i + offset < size) add(i, i + offset);
    for (let i = 0; pairs.size < size * 3; i++) add(0, i + 1);
  } else {
    for (let i = 1; i < size; i++) add(shape === "hub" ? 0 : i - 1, i);
  }
  const edges = [...pairs.values()];
  const dependencies = edges.map(({ source, target }) => ({
    source: nodes[Number(source.slice(5))].newPath,
    target: nodes[Number(target.slice(5))].newPath,
  }));
  const state = {
    nodes: nodes.map((n) => ({ path: n.newPath })),
    edges: dependencies,
    references: dependencies.map((edge) => ({
      source: edge.source,
      target: edge.target,
      kind: "import",
      line: 1,
      column: 1,
      expression: edge.target,
      outcome: "resolved",
    })),
    diagnostics: [],
  };
  return {
    id: "rendering-fixture",
    capturedAt: "2026-09-23T00:00:00.000Z",
    repository: "/synthetic/rendering",
    mode: ".",
    before: { kind: "commit", label: "HEAD" },
    after: { kind: "worktree", label: "Working tree" },
    changes,
    graph: {
      before: state,
      after: state,
      merged: { nodes, edges },
      incomplete: false,
      selection: {
        paths: nodes.map((n) => n.newPath),
        beforeEdges: dependencies,
        afterEdges: dependencies,
        unanalyzedChanges: [],
      },
    },
  };
}
