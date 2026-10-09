// @vitest-environment jsdom
import { createElement, useState } from "react";
import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { CodePane, defaultDiffDisplay } from "../src/ui/code-pane.js";
import dagre from "@dagrejs/dagre";
import { Graph, statusLabels } from "../src/ui/graph.js";
import { layoutElements, layoutGraph } from "../src/ui/layout.js";
import type { ReviewSummary } from "../src/shared/review.js";
import type { MergedFileNode } from "../src/graph/model.js";
import { selectNeighborhood } from "../src/graph/select.js";
import { createMapModel } from "../src/ui/map-model.js";
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
test("a single Go package stays collapsed, displays its changed count and supports keyboard selection", () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  const paths = ["main.go", "helper.go"];
  const state = {
    ...empty,
    nodes: paths.map((path) => ({ path })),
    edges: [{ source: "main.go", target: "helper.go" }],
  };
  const graph = selectNeighborhood(state, state, [file("main.go").change!]);
  const onSelect = vi.fn();
  const props = {
    graph,
    direction: "LR" as const,
    groupByDirectory: true,
    selected: "go-package:.",
    onSelect,
  };
  const view = render(createElement(Graph, { ...props, model: createMapModel(graph, "packages") }));
  const pkg = screen.getByRole("button", { name: "Open Go package ." });
  expect(screen.getByText("1 changed · 2 shown")).toBeTruthy();
  expect(screen.queryByText("helper.go")).toBeNull();
  expect(view.container.querySelector(".react-flow__node.selected .package-node")).toBeTruthy();
  fireEvent.keyDown(pkg, { key: "Enter" });
  expect(onSelect).toHaveBeenCalledWith("go-package:.");
  view.rerender(
    createElement(Graph, {
      ...props,
      selected: "before:main.go",
      model: createMapModel(graph, "files"),
    }),
  );
  expect(screen.getByRole("button", { name: "Open helper.go" })).toBeTruthy();
  expect(view.container.querySelector(".react-flow__node.selected .file-node")).toBeTruthy();
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
test.each(["LR", "RL", "TB", "BT"] as const)(
  "flat layout in %s places every file at the root with routed dependencies",
  (direction) => {
    const graph = {
      ...snapshot.graph,
      merged: {
        nodes: [file("src/a.ts"), file("other/b.ts"), file("root.ts")],
        edges: [{ source: "src/a.ts", target: "other/b.ts", status: "added" as const }],
      },
    };
    const { nodes, routes, fileBounds } = layoutElements(graph, direction, false);
    expect(nodes).toHaveLength(3);
    expect(nodes.every((node) => node.type === "file" && node.parentId === undefined)).toBe(true);
    expect(nodes.find((node) => node.id === "src/a.ts")).toMatchObject({
      data: { directoryPath: "src" },
    });
    expect(nodes.find((node) => node.id === "root.ts")).toMatchObject({
      data: { directoryPath: null },
    });
    const source = fileBounds.get("src/a.ts")!;
    const target = fileBounds.get("other/b.ts")!;
    expect(routes).toHaveLength(1);
    expect(routes[0].length).toBeGreaterThanOrEqual(2);
    expect(routes[0][0]).not.toEqual(routes[0].at(-1));
    expect(source.position).not.toEqual(target.position);
  },
);
test.each(["LR", "RL", "TB", "BT"] as const)(
  "flat layout in %s keeps directory peers adjacent without hiding isolated files",
  (direction) => {
    const graph = {
      ...snapshot.graph,
      merged: {
        nodes: [
          file("src/a.ts"),
          file("other/c.ts"),
          file("src/b.ts"),
          file("other/d.ts"),
          file("root.ts"),
          file("target.ts"),
        ],
        edges: [
          { source: "src/a.ts", target: "target.ts", status: "added" as const },
          { source: "other/c.ts", target: "target.ts", status: "added" as const },
          { source: "src/b.ts", target: "target.ts", status: "added" as const },
          { source: "other/d.ts", target: "target.ts", status: "added" as const },
        ],
      },
    };
    const { nodes, routes, fileBounds } = layoutElements(graph, direction, false);
    const rankAxis = direction === "LR" || direction === "RL" ? "x" : "y";
    const crossAxis = rankAxis === "x" ? "y" : "x";
    const sources = nodes
      .filter((node) => node.id !== "target.ts" && node.id !== "root.ts")
      .sort((a, b) => a.position[crossAxis] - b.position[crossAxis]);
    expect(new Set(sources.map((node) => node.position[rankAxis])).size).toBe(1);
    const directoryOrder = sources.map((node) => node.id.split("/")[0]);
    expect(Math.abs(directoryOrder.indexOf("src") - directoryOrder.lastIndexOf("src"))).toBe(1);
    expect(Math.abs(directoryOrder.indexOf("other") - directoryOrder.lastIndexOf("other"))).toBe(1);
    expect(nodes).toHaveLength(6);
    expect(nodes.find((node) => node.id === "root.ts")).toBeTruthy();
    for (const [index, node] of nodes.entries()) {
      for (const other of nodes.slice(index + 1)) {
        const separated =
          node.position.x + node.width! <= other.position.x ||
          other.position.x + other.width! <= node.position.x ||
          node.position.y + node.height! <= other.position.y ||
          other.position.y + other.height! <= node.position.y;
        expect(separated).toBe(true);
      }
    }
    expect(routes).toHaveLength(graph.merged.edges.length);
    for (const [index, edge] of graph.merged.edges.entries()) {
      const source = fileBounds.get(edge.source)!;
      const target = fileBounds.get(edge.target)!;
      const horizontal = rankAxis === "x";
      const forward = direction === "LR" || direction === "TB";
      expect(routes[index][0][rankAxis]).toBe(
        source.position[rankAxis] + (forward ? (horizontal ? source.width : source.height) : 0),
      );
      expect(routes[index].at(-1)![rankAxis]).toBe(
        target.position[rankAxis] + (forward ? 0 : horizontal ? target.width : target.height),
      );
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
  fireEvent.click(screen.getByRole("tab", { name: "Before" }));
  fireEvent.click(screen.getByRole("tab", { name: "After" }));
  expect((await screen.findByLabelText("Full file")).textContent).toContain("captured after");
  await act(async () =>
    finishBefore(new Response(JSON.stringify({ encoding: "utf8", content: "obsolete before" }))),
  );
  expect(screen.getByLabelText("Full file").textContent).not.toContain("obsolete before");
  expect(fetcher.mock.calls[0][0]).toContain("snapshot=snapshot-1");
});

test.each([
  ["unchanged", null],
  ["renamed", ""],
] as const)("%s file with identical code has no redundant tabs", async (status, patch) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ encoding: "utf8", content: "same code" }))),
  );
  const original = file("a.ts");
  const node = {
    ...original,
    status,
    newPath: status === "renamed" ? "renamed.ts" : original.newPath,
    change:
      status === "renamed" ? { ...original.change!, status: "renamed" as const, patch } : null,
  };
  render(createElement(CodePane, { snapshot, node }));
  expect(screen.queryByRole("tablist")).toBeNull();
  expect((await screen.findByLabelText("Full file")).textContent).toContain("same code");
  if (status === "renamed") {
    fireEvent.click(screen.getByRole("button", { name: "File information" }));
    expect(await screen.findByText(/Renamed from/)).toBeTruthy();
  }
});

test("content tabs expose tab semantics and selected state", () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ encoding: "utf8", content: "captured" }))),
  );
  render(createElement(CodePane, { snapshot, node: file("a.ts") }));
  const diff = screen.getByRole("tab", { name: "Diff" });
  expect(diff.getAttribute("aria-selected")).toBe("true");
  const before = screen.getByRole("tab", { name: "Before" });
  fireEvent.click(before);
  expect(before.getAttribute("aria-selected")).toBe("true");
  expect(diff.getAttribute("aria-selected")).toBe("false");
});

test("code pane opens a working tree file and explains launch errors", async () => {
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
    if (url.startsWith("/api/editor")) {
      if (options?.method === "POST")
        return new Response(
          JSON.stringify({ error: "Could not open a.ts: editor command not found" }),
          {
            status: 503,
          },
        );
      return new Response(JSON.stringify({ available: true, path: "a.ts", differs: true }));
    }
    if (options?.method === "HEAD") return new Response(null, { status: 415 });
    return new Response(JSON.stringify({ encoding: "utf8", content: "captured" }));
  });
  vi.stubGlobal("fetch", fetcher);
  render(createElement(CodePane, { snapshot, node: file("a.ts") }));
  const button = await screen.findByRole("button", { name: "Open in editor" });
  await vi.waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "File information" }));
  expect(await screen.findByText(/working tree file differs/)).toBeTruthy();
  fireEvent.click(button);
  expect((await screen.findByRole("alert")).textContent).toContain("editor command not found");
  expect(
    fetcher.mock.calls.some(
      ([url, options]) => String(url).includes("node=a.ts") && options?.method === "POST",
    ),
  ).toBe(true);
});

test("code pane disables editor action when the working tree file is absent", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options?: RequestInit) => {
      if (url.startsWith("/api/editor"))
        return new Response(
          JSON.stringify({
            available: false,
            path: "deleted.ts",
            differs: false,
            reason: "File is absent from the working tree.",
          }),
        );
      if (options?.method === "HEAD") return new Response(null, { status: 415 });
      return new Response(JSON.stringify({ encoding: "utf8", content: "captured" }));
    }),
  );
  const deleted = { ...file("deleted.ts"), status: "deleted" as const, newPath: null };
  render(createElement(CodePane, { snapshot, node: deleted }));
  await screen.findByRole("button", { name: "File information" });
  fireEvent.click(screen.getByRole("button", { name: "File information" }));
  expect(await screen.findByText("File is absent from the working tree.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Open in editor" }).hasAttribute("disabled")).toBe(
    true,
  );
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
    return createElement(
      "div",
      null,
      createElement(
        "button",
        { onClick: () => setDisplay((current) => ({ ...current, layout: "split" })) },
        "Choose split",
      ),
      createElement(
        "button",
        { onClick: () => setDisplay((current) => ({ ...current, ignoreWhitespace: true })) },
        "Ignore whitespace",
      ),
      createElement(CodePane, { snapshot, node, display }),
    );
  }
  render(createElement(Example));
  fireEvent.click(screen.getByRole("button", { name: "Choose split" }));
  const diff = screen.getByLabelText("File diff");
  expect(diff.querySelectorAll(".split-row")).toHaveLength(1);
  expect(diff.querySelector(".line-delete")?.textContent).toContain("old");
  expect(diff.querySelector(".line-add")?.textContent).toContain("new");
  fireEvent.click(screen.getByRole("button", { name: "Ignore whitespace" }));
  expect(screen.getByText("No differences after ignoring whitespace.")).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: "After" }));
  expect((await screen.findByLabelText("Full file")).textContent).toContain(
    "a very long captured line",
  );
  expect(screen.queryByLabelText("Wrap lines")).toBeNull();
});
test("deleted files start with old contents, and binary files explain unavailable text", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(null, {
          status: 415,
          headers: { "X-Changemap-Preview-Reason": "Unsupported or invalid image format." },
        }),
    ),
  );
  const original = file("deleted.bin");
  const node = {
    ...original,
    status: "deleted" as const,
    newPath: null,
    change: { ...original.change!, binary: true, patch: null },
  };
  render(createElement(CodePane, { snapshot, node }));
  expect(await screen.findByText(/Unsupported or invalid image format/)).toBeTruthy();
  expect(screen.queryByRole("tab", { name: "After" })).toBeNull();
});

test("binary diff previews an available side and explains why the other side is unavailable", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === "HEAD" && String(_url).includes("side=before")) {
        return new Response(null, {
          status: 200,
          headers: {
            "Content-Type": "image/png",
            "X-Changemap-Image-Width": "32",
            "X-Changemap-Image-Height": "16",
          },
        });
      }
      return new Response(null, {
        status: 413,
        headers: {
          "X-Changemap-Preview-Reason": "Image exceeds the 10 MiB preview limit.",
        },
      });
    }),
  );
  const original = file("picture.bin");
  const node = { ...original, change: { ...original.change!, binary: true, patch: null } };
  render(createElement(CodePane, { snapshot, node }));
  const image = await screen.findByAltText("Before file preview");
  expect(image.getAttribute("src")).toContain("side=before");
  expect(screen.getByText("32 × 16 px")).toBeTruthy();
  expect(screen.getByText(/10 MiB preview limit/)).toBeTruthy();
  expect(screen.queryByLabelText("Display settings")).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: "Before" }));
  expect(screen.getByAltText("Before file preview")).toBeTruthy();
  expect(screen.queryByText(/10 MiB preview limit/)).toBeNull();
  fireEvent.error(screen.getByAltText("Before file preview"));
  expect(screen.getByText("The browser could not decode this image.")).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: "After" }));
  expect(screen.getByText(/10 MiB preview limit/)).toBeTruthy();
});

test("clicking a preview opens an enlarged dialog and returns focus when closed", async () => {
  const showDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
  const closeDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    },
  });
  try {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(null, {
            status: 200,
            headers: {
              "Content-Type": "image/png",
              "X-Changemap-Image-Width": "64",
              "X-Changemap-Image-Height": "32",
            },
          }),
      ),
    );
    const original = file("picture.bin");
    const node = { ...original, change: { ...original.change!, binary: true, patch: null } };
    render(createElement(CodePane, { snapshot, node }));
    const trigger = await screen.findByRole("button", { name: "Enlarge Before image" });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Before image enlarged" });
    expect(dialog.querySelector("img")?.getAttribute("src")).toContain("side=before");
    expect(dialog.textContent).toContain("64 × 32 px");
    fireEvent.click(screen.getByRole("button", { name: "Close ×" }));
    expect(screen.queryByRole("dialog", { name: "Before image enlarged" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("dialog", { name: "Before image enlarged" }));
    expect(screen.queryByRole("dialog", { name: "Before image enlarged" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  } finally {
    if (showDescriptor)
      Object.defineProperty(HTMLDialogElement.prototype, "showModal", showDescriptor);
    else delete (HTMLDialogElement.prototype as { showModal?: unknown }).showModal;
    if (closeDescriptor)
      Object.defineProperty(HTMLDialogElement.prototype, "close", closeDescriptor);
    else delete (HTMLDialogElement.prototype as { close?: unknown }).close;
  }
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
  fireEvent.click(screen.getByRole("button", { name: "File information" }));
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
    createElement(Graph, {
      graph: snapshot.graph,
      direction: "LR",
      groupByDirectory: true,
      selected: null,
      onSelect,
    }),
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
  render(
    createElement(Graph, {
      graph,
      direction: "LR",
      groupByDirectory: true,
      selected: null,
      onSelect,
    }),
  );
  expect(screen.getByText("src")).toBeTruthy();
  expect(screen.getByText("deep")).toBeTruthy();
  expect(screen.getByText("index.ts")).toBeTruthy();
  fireEvent.click(screen.getByText("deep"));
  expect(onSelect).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Open src/deep/index.ts" }));
  expect(onSelect).toHaveBeenCalledWith("src/deep/index.ts");
});

test("flat graph shows the parent path separately and omits it for root files", () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  const graph = {
    ...snapshot.graph,
    merged: { nodes: [file("src/deep/index.ts"), file("root.ts")], edges: [] },
  };
  const onSelect = vi.fn();
  render(
    createElement(Graph, {
      graph,
      direction: "LR",
      groupByDirectory: false,
      selected: null,
      onSelect,
    }),
  );
  expect(screen.queryByText("deep")).toBeNull();
  expect(
    screen.getByRole("button", { name: "Open src/deep/index.ts" }).querySelector("strong")
      ?.textContent,
  ).toBe("index.ts");
  expect(screen.getByText("src/deep").classList.contains("file-directory")).toBe(true);
  expect(
    screen.getByRole("button", { name: "Open root.ts" }).querySelector(".file-directory"),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Open src/deep/index.ts" }));
  expect(onSelect).toHaveBeenCalledWith("src/deep/index.ts");
});

test("switching grouping remounts the fitted canvas and retains the selected file", () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  const graph = {
    ...snapshot.graph,
    merged: { nodes: [file("src/index.ts")], edges: [] },
  };
  const props = { graph, direction: "LR" as const, selected: "src/index.ts", onSelect: vi.fn() };
  const view = render(createElement(Graph, { ...props, groupByDirectory: true }));
  const firstCanvas = view.container.querySelector(".react-flow");
  expect(firstCanvas).toBeTruthy();
  view.rerender(createElement(Graph, { ...props, groupByDirectory: false }));
  expect(view.container.querySelector(".react-flow")).not.toBe(firstCanvas);
  expect(view.container.querySelector(".react-flow__node.selected .file-node")).toBeTruthy();
});

test("mixed file states keep names visible with badges only on changed nodes", () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  const statuses = ["added", "modified", "deleted", "renamed", "unchanged"] as const;
  const nodes = statuses.map((status) => ({
    ...file(`${status}.ts`),
    status,
    oldPath: status === "added" ? null : `${status}.ts`,
    newPath: status === "deleted" ? null : `${status}.ts`,
  }));
  const edges = [
    { source: "added.ts", target: "modified.ts", status: "added" as const },
    { source: "deleted.ts", target: "unchanged.ts", status: "deleted" as const },
  ];
  const graph = { ...snapshot.graph, merged: { nodes, edges } };
  const { container } = render(
    createElement(Graph, {
      graph,
      direction: "LR",
      groupByDirectory: true,
      selected: "renamed.ts",
      onSelect: vi.fn(),
    }),
  );
  for (const status of statuses) {
    const node = screen.getByRole("button", { name: `Open ${status}.ts` });
    expect(node.classList.contains(status)).toBe(true);
    expect(node.querySelector("strong")?.textContent).toBe(`${status}.ts`);
    expect(node.querySelector(".status-badge")?.textContent).toBe(
      status === "unchanged" ? undefined : statusLabels[status],
    );
  }
  expect(container.querySelector(".react-flow__node.selected .file-node.renamed")).toBeTruthy();
});
