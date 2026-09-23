import { expect, test } from "vitest";
import { mergeGraphs } from "../src/graph/merge.js";
import type { DependencyGraph } from "../src/graph/model.js";
import type { FileChange } from "../src/shared/review.js";

const graph = (paths: string[], edges: string[][] = []): DependencyGraph => ({
  nodes: paths.map((path) => ({ path })),
  edges: edges.map(([source, target]) => ({ source, target })),
  references: [],
  diagnostics: [],
});
const change = (oldPath: string | null, newPath: string | null): FileChange => ({
  oldPath,
  newPath,
  status:
    oldPath === null
      ? "added"
      : newPath === null
        ? "deleted"
        : oldPath === newPath
          ? "modified"
          : "renamed",
  oldMode: oldPath === null ? null : "100644",
  newMode: newPath === null ? null : "100644",
  binary: false,
  patch: "diff fixture",
});

test("classifies dependency replacement independently of unchanged neighbors", () => {
  const merged = mergeGraphs(
    graph(["a", "b", "c"], [["a", "b"]]),
    graph(["a", "b", "c"], [["a", "c"]]),
    [change("a", "a")],
  );
  expect(merged.nodes.map((node) => node.status)).toEqual(["modified", "unchanged", "unchanged"]);
  expect(merged.edges).toEqual([
    { source: "before:a", target: "before:b", status: "deleted" },
    { source: "before:a", target: "before:c", status: "added" },
  ]);
});

test("normalizes both rename endpoints and preserves code changes", () => {
  const changes = [change("a", "new-a"), change("b", "new-b")];
  const merged = mergeGraphs(
    graph(["a", "b"], [["a", "b"]]),
    graph(["new-a", "new-b"], [["new-a", "new-b"]]),
    changes,
  );
  expect(merged.edges).toEqual([{ source: "before:a", target: "before:b", status: "unchanged" }]);
  expect(
    merged.nodes.map((node) => [node.oldPath, node.newPath, node.status, node.change?.patch]),
  ).toEqual([
    ["a", "new-a", "renamed", "diff fixture"],
    ["b", "new-b", "renamed", "diff fixture"],
  ]);
});

test("does not conflate a reused old path with its renamed file", () => {
  const merged = mergeGraphs(
    graph(["a", "b"], [["a", "b"]]),
    graph(
      ["a", "b", "c"],
      [
        ["a", "b"],
        ["a", "c"],
      ],
    ),
    [change("b", "c"), change(null, "b"), change("a", "a")],
  );
  expect(merged.edges).toEqual([
    { source: "before:a", target: "after:b", status: "added" },
    { source: "before:a", target: "before:b", status: "unchanged" },
  ]);
  expect(new Set(merged.nodes.map((node) => node.id)).size).toBe(3);
});

test("handles rename chains and swaps with side-specific mappings", () => {
  const merged = mergeGraphs(graph(["a", "b"], [["a", "b"]]), graph(["a", "b"], [["b", "a"]]), [
    change("a", "b"),
    change("b", "a"),
  ]);
  expect(merged.edges).toEqual([{ source: "before:a", target: "before:b", status: "unchanged" }]);
});

test.each([true, false])(
  "classifies every edge and node for a root or deletion comparison (%s)",
  (added) => {
    const full = graph(["a", "b"], [["a", "b"]]);
    const merged = mergeGraphs(
      added ? graph([]) : full,
      added ? full : graph([]),
      ["a", "b"].map((p) => change(added ? null : p, added ? p : null)),
    );
    expect(merged.nodes.every((node) => node.status === (added ? "added" : "deleted"))).toBe(true);
    expect(merged.edges[0].status).toBe(added ? "added" : "deleted");
  },
);

test("preserves unanalyzed binary changes and side-specific analysis across extension renames", () => {
  const binary = { ...change(null, "image.png"), binary: true, patch: null };
  const merged = mergeGraphs(
    graph(["a.ts", "empty.ts"], [["a.ts", "empty.ts"]]),
    graph(["empty.ts", "new.ts"]),
    [change("a.ts", "a.js"), change("old.js", "new.ts"), binary],
  );
  expect(merged.nodes.find((n) => n.oldPath === "a.ts")?.analyzed).toEqual({
    before: true,
    after: false,
  });
  expect(merged.nodes.find((n) => n.newPath === "new.ts")?.analyzed).toEqual({
    before: false,
    after: true,
  });
  expect(merged.nodes.find((n) => n.newPath === "image.png")).toMatchObject({
    analyzed: { before: false, after: false },
    change: binary,
  });
  expect(merged.nodes.find((n) => n.newPath === "empty.ts")?.analyzed).toEqual({
    before: true,
    after: true,
  });
  expect(merged.edges[0].status).toBe("deleted");
});

test("selects only direct neighbors but retains edges among selected nodes", () => {
  const full = graph(
    ["a", "b", "c", "user", "far"],
    [
      ["a", "b"],
      ["c", "a"],
      ["b", "c"],
      ["user", "a"],
      ["c", "far"],
    ],
  );
  const merged = mergeGraphs(full, full, [change("a", "a")]);
  expect(merged.nodes.map((node) => node.oldPath)).toEqual(["a", "b", "c", "user"]);
  expect(merged.edges).toHaveLength(4);
  expect(merged.edges.every((edge) => edge.status === "unchanged")).toBe(true);
  expect(mergeGraphs(full, full, []).nodes).toEqual([]);
  expect(Object.isFrozen(merged.nodes[0].analyzed)).toBe(true);
  expect(Object.isFrozen(merged.edges)).toBe(true);
});
