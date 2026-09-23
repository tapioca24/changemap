// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { CodePane } from "../src/ui/code-pane.js";
import dagre from "@dagrejs/dagre";
import { Graph } from "../src/ui/graph.js";
import { layoutGraph } from "../src/ui/layout.js";
import type { ReviewSummary } from "../src/shared/review.js";
import type { MergedFileNode } from "../src/graph/model.js";
const file = (id: string): MergedFileNode => ({
  id,
  oldPath: id,
  newPath: id,
  status: "modified",
  analyzed: { before: true, after: true },
  change: {
    status: "modified",
    oldPath: id,
    newPath: id,
    oldMode: "100644",
    newMode: "100644",
    binary: false,
    patch: "@@ -1 +1 @@\n-old\n+new",
  },
});
const empty = { nodes: [], edges: [], references: [], diagnostics: [] };
const snapshot: ReviewSummary = {
  id: "snapshot-1",
  capturedAt: "2026-09-23",
  repository: "/repo",
  mode: ".",
  before: { kind: "commit", label: "HEAD" },
  after: { kind: "worktree", label: "Working tree" },
  changes: [],
  graph: {
    merged: {
      nodes: [file("a.ts"), file("b.ts"), file("alone.ts")],
      edges: [{ source: "a.ts", target: "b.ts", status: "added" }],
    },
    before: empty,
    after: empty,
    selection: { paths: [], beforeEdges: [], afterEdges: [], unanalyzedChanges: [] },
    incomplete: false,
  },
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
test.each(["LR", "RL", "TB", "BT"] as const)(
  "layout %s respects direction and includes isolated files",
  (direction) => {
    const nodes = layoutGraph(snapshot.graph, direction);
    const a = nodes.find((n) => n.id === "a.ts")!;
    const b = nodes.find((n) => n.id === "b.ts")!;
    expect(nodes).toHaveLength(3);
    const axis = direction === "LR" || direction === "RL" ? "x" : "y";
    expect(
      (b.position[axis] - a.position[axis]) * (direction === "LR" || direction === "TB" ? 1 : -1),
    ).toBeGreaterThan(0);
  },
);
test("cyclic and self dependencies produce finite, distinct node positions", () => {
  const nodes = layoutGraph(
    {
      ...snapshot.graph,
      merged: {
        ...snapshot.graph.merged,
        edges: [
          ...snapshot.graph.merged.edges,
          { source: "b.ts", target: "a.ts", status: "deleted" },
          { source: "a.ts", target: "a.ts", status: "unchanged" },
        ],
      },
    },
    "LR",
  );
  expect(new Set(nodes.map((n) => `${n.position.x}:${n.position.y}`)).size).toBe(3);
  for (const node of nodes)
    expect(Number.isFinite(node.position.x) && Number.isFinite(node.position.y)).toBe(true);
});
test("diff is default; switching sides cannot display an older asynchronous response", async () => {
  let finishBefore!: (response: Response) => void;
  const fetcher = vi.fn((url: string) =>
    url.includes("side=before")
      ? new Promise<Response>((resolve) => {
          finishBefore = resolve;
        })
      : Promise.resolve(
          new Response(JSON.stringify({ encoding: "utf8", content: "captured after" })),
        ),
  );
  vi.stubGlobal("fetch", fetcher);
  render(createElement(CodePane, { snapshot, node: file("a.ts") }));
  expect(screen.getByLabelText("File diff").textContent).toContain("+new");
  fireEvent.click(screen.getByText("Before · full file"));
  fireEvent.click(screen.getByText("After · full file"));
  expect((await screen.findByLabelText("Full file")).textContent).toContain("captured after");
  await act(async () =>
    finishBefore(new Response(JSON.stringify({ encoding: "utf8", content: "obsolete before" }))),
  );
  expect(screen.getByLabelText("Full file").textContent).not.toContain("obsolete before");
  expect(fetcher.mock.calls[0][0]).toContain("snapshot=snapshot-1");
});
test("deleted files start with old contents, and binary files explain unavailable text", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ encoding: "base64", content: "AA==" }))),
  );
  const node = { ...file("deleted.bin"), status: "deleted" as const, newPath: null };
  render(createElement(CodePane, { snapshot, node }));
  expect(await screen.findByText(/Text diff unavailable/)).toBeTruthy();
  expect(screen.queryByText("After · full file")).toBeNull();
});
test("rename paths and unresolved vs intentionally excluded references remain distinct", () => {
  const node = { ...file("a.ts"), status: "renamed" as const, newPath: "renamed.ts" };
  const graph = {
    ...snapshot.graph,
    before: {
      ...empty,
      references: [
        {
          source: "a.ts",
          kind: "import" as const,
          line: 2,
          column: 1,
          expression: "./missing",
          outcome: "unresolved" as const,
          reason: "Missing target",
        },
        {
          source: "a.ts",
          kind: "import" as const,
          line: 3,
          column: 1,
          expression: "node:fs",
          outcome: "excluded" as const,
          reason: "Node builtin",
        },
      ],
    },
  };
  render(createElement(CodePane, { snapshot: { ...snapshot, graph }, node }));
  expect(screen.getByText("renamed.ts")).toBeTruthy();
  expect(screen.getByText("a.ts")).toBeTruthy();
  expect(screen.getByText(/1 unresolved · 1 intentionally excluded/)).toBeTruthy();
  expect(screen.getByText("Missing target")).toBeTruthy();
  expect(screen.getByText("Node builtin")).toBeTruthy();
});

test("layout failure preserves access to every analyzed file instead of crashing the review", () => {
  vi.spyOn(dagre, "layout").mockImplementationOnce(() => {
    throw new RangeError("Maximum call stack size exceeded");
  });
  const onSelect = vi.fn();
  render(
    createElement(Graph, { graph: snapshot.graph, direction: "LR", selected: null, onSelect }),
  );
  expect(screen.getByRole("alert").textContent).toContain("dependency map could not be displayed");
  expect(screen.getAllByRole("option")).toHaveLength(4);
  fireEvent.change(screen.getByLabelText("File to review"), { target: { value: "alone.ts" } });
  expect(onSelect).toHaveBeenCalledWith("alone.ts");
});
