// @vitest-environment jsdom
import { createElement, useState } from "react";
import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { CodePane, defaultDiffDisplay } from "../src/ui/code-pane.js";
import dagre from "@dagrejs/dagre";
import { Graph } from "../src/ui/graph.js";
import { layoutElements, layoutGraph } from "../src/ui/layout.js";
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
test.each(["LR", "RL", "TB", "BT"] as const)(
  "nested directories in %s contain their files and preserve dependency routes",
  (direction) => {
    const moved = {
      ...file("moved"),
      oldPath: "old/index.ts",
      newPath: "src/deep/index.ts",
      status: "renamed" as const,
    };
    const deleted = {
      ...file("deleted"),
      oldPath: "src/gone.ts",
      newPath: null,
      status: "deleted" as const,
    };
    const root = file("root.ts");
    const hidden = {
      ...file("hidden.ts"),
      newPath: "unused/hidden.ts",
      analyzed: { before: false, after: false },
    };
    const graph = {
      ...snapshot.graph,
      merged: {
        nodes: [moved, deleted, root, hidden],
        edges: [
          { source: "moved", target: "deleted", status: "deleted" as const },
          { source: "root.ts", target: "moved", status: "added" as const },
        ],
      },
    };
    const { nodes, routes, fileBounds } = layoutElements(graph, direction);
    expect(nodes.map((node) => node.id)).toEqual([
      "directory:src",
      "directory:src/deep",
      "moved",
      "deleted",
      "root.ts",
    ]);
    expect(nodes.find((node) => node.id === "directory:src/deep")?.parentId).toBe("directory:src");
    expect(nodes.find((node) => node.id === "moved")?.parentId).toBe("directory:src/deep");
    expect(nodes.find((node) => node.id === "deleted")?.parentId).toBe("directory:src");
    expect(nodes.find((node) => node.id === "root.ts")?.parentId).toBeUndefined();
    for (const node of nodes) {
      if (!node.parentId) continue;
      const parent = nodes.find((candidate) => candidate.id === node.parentId)!;
      expect(node.position.x).toBeGreaterThanOrEqual(0);
      expect(node.position.y).toBeGreaterThanOrEqual(20);
      expect(node.position.x + node.width!).toBeLessThanOrEqual(parent.width!);
      expect(node.position.y + node.height!).toBeLessThanOrEqual(parent.height!);
    }
    expect(fileBounds.get("moved")?.position).toEqual({
      x:
        nodes.find((node) => node.id === "directory:src")!.position.x +
        nodes.find((node) => node.id === "directory:src/deep")!.position.x +
        nodes.find((node) => node.id === "moved")!.position.x,
      y:
        nodes.find((node) => node.id === "directory:src")!.position.y +
        nodes.find((node) => node.id === "directory:src/deep")!.position.y +
        nodes.find((node) => node.id === "moved")!.position.y,
    });
    expect(routes).toHaveLength(2);
    for (const [index, route] of routes.entries()) {
      expect(route.length).toBeGreaterThanOrEqual(2);
      for (const point of route) {
        expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
      }
      const edge = graph.merged.edges[index];
      const source = fileBounds.get(edge.source)!;
      const target = fileBounds.get(edge.target)!;
      const start = route[0];
      const end = route.at(-1)!;
      if (direction === "LR" || direction === "RL") {
        expect(start.y).toBe(source.position.y + source.height / 2);
        expect(end.y).toBe(target.position.y + target.height / 2);
        expect(start.x).toBe(source.position.x + (direction === "LR" ? source.width : 0));
        expect(end.x).toBe(target.position.x + (direction === "LR" ? 0 : target.width));
      } else {
        expect(start.x).toBe(source.position.x + source.width / 2);
        expect(end.x).toBe(target.position.x + target.width / 2);
        expect(start.y).toBe(source.position.y + (direction === "TB" ? source.height : 0));
        expect(end.y).toBe(target.position.y + (direction === "TB" ? 0 : target.height));
      }
    }
  },
);
test("many dependencies across sibling directories keep every file and edge visible", () => {
  const nodes = Array.from({ length: 120 }, (_, index) =>
    file(`src/area-${index % 8}/file-${index}.ts`),
  );
  const edges = nodes.flatMap((node, index) =>
    [1, 8, 17]
      .filter((offset) => index + offset < nodes.length)
      .map((offset) => ({
        source: node.id,
        target: nodes[index + offset].id,
        status: "unchanged" as const,
      })),
  );
  const result = layoutElements({ ...snapshot.graph, merged: { nodes, edges } }, "LR");
  expect(result.fileBounds.size).toBe(nodes.length);
  expect(result.routes).toHaveLength(edges.length);
  expect(result.nodes.filter((node) => node.type === "directory")).toHaveLength(9);
  expect(
    result.routes.every((route) =>
      route.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
    ),
  ).toBe(true);
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
  expect(screen.getByLabelText("File diff").textContent).toContain("new");
  expect(screen.getByLabelText("File diff").textContent).not.toContain("+new");
  fireEvent.click(screen.getByText("Before · full file"));
  fireEvent.click(screen.getByText("After · full file"));
  expect((await screen.findByLabelText("Full file")).textContent).toContain("captured after");
  await act(async () =>
    finishBefore(new Response(JSON.stringify({ encoding: "utf8", content: "obsolete before" }))),
  );
  expect(screen.getByLabelText("Full file").textContent).not.toContain("obsolete before");
  expect(fetcher.mock.calls[0][0]).toContain("snapshot=snapshot-1");
});

test("display controls switch split rows and whitespace patch while full files remain available", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ encoding: "utf8", content: "a very long captured line\n" })),
    ),
  );
  const node = {
    ...file("a.ts"),
    change: {
      ...file("a.ts").change!,
      patch: "@@ -1 +1 @@\n-old\n+new",
      whitespacePatch: "",
    },
  };
  function Example() {
    const [display, setDisplay] = useState(defaultDiffDisplay);
    return createElement(CodePane, { snapshot, node, display, onDisplayChange: setDisplay });
  }
  render(createElement(Example));
  fireEvent.click(screen.getByRole("button", { name: "Split diff" }));
  const diff = screen.getByLabelText("File diff");
  expect(diff.querySelectorAll(".split-row")).toHaveLength(1);
  expect(diff.querySelector(".line-delete")?.textContent).toContain("old");
  expect(diff.querySelector(".line-add")?.textContent).toContain("new");
  fireEvent.click(screen.getByLabelText("Ignore whitespace"));
  expect(screen.getByText("No differences after ignoring whitespace.")).toBeTruthy();
  fireEvent.click(screen.getByText("After · full file"));
  expect((await screen.findByLabelText("Full file")).textContent).toContain(
    "a very long captured line",
  );
  expect(screen.queryByLabelText("Wrap lines")).toBeNull();
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

test("directory headings are visible while only files can be selected", () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  const onSelect = vi.fn();
  const graph = {
    ...snapshot.graph,
    merged: {
      nodes: [file("src/deep/index.ts")],
      edges: [],
    },
  };
  render(createElement(Graph, { graph, direction: "LR", selected: null, onSelect }));
  expect(screen.getByText("src")).toBeTruthy();
  expect(screen.getByText("deep")).toBeTruthy();
  expect(screen.getByText("index.ts")).toBeTruthy();
  fireEvent.click(screen.getByText("deep"));
  expect(onSelect).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Open src/deep/index.ts" }));
  expect(onSelect).toHaveBeenCalledWith("src/deep/index.ts");
});
