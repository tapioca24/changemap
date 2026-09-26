// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "../src/ui/app.js";
import type { ReviewSummary, ReviewStatus } from "../src/shared/review.js";
import type { Settings } from "../src/shared/settings.js";
import { themes } from "../src/shared/settings.js";
import type { ReviewGraph } from "../src/graph/model.js";

// Canvas geometry is tested separately and measured in Chromium. Keep the real
// App, CodePane, API client, and all asynchronous state transitions in this suite.
vi.mock("../src/ui/graph.js", async (original) => ({
  ...(await original<typeof import("../src/ui/graph.js")>()),
  Graph: ({
    graph,
    direction,
    onSelect,
  }: {
    graph: ReviewGraph;
    direction: string;
    onSelect(id: string): void;
  }) =>
    createElement(
      "div",
      { "aria-label": "Test graph", "data-direction": direction },
      ...graph.merged.nodes
        .filter((n) => n.analyzed.after || n.analyzed.before)
        .map((n) =>
          createElement(
            "button",
            { key: n.id, onClick: () => onSelect(n.id) },
            `Open ${n.newPath ?? n.oldPath}`,
          ),
        ),
    ),
}));
vi.mock("../src/ui/highlight-client.js", () => ({ highlightFile: vi.fn(async () => []) }));

const addedCode = () => screen.getByLabelText("File diff").querySelector(".line-add")?.textContent;

function snapshot(id: string, path?: string): ReviewSummary {
  const change = {
    status: "modified" as const,
    oldPath: path!,
    newPath: path!,
    oldMode: "100644",
    newMode: "100644",
    binary: false,
    patch: `@@ -1 +1 @@\n-old\n+${id}`,
  };
  const state = { nodes: [], edges: [], references: [], diagnostics: [] };
  return {
    id,
    capturedAt: "2026-09-23T00:00:00Z",
    repository: "/repo",
    mode: ".",
    before: { kind: "commit", label: "HEAD" },
    after: { kind: "worktree", label: "Working tree" },
    changes: path ? [change] : [],
    graph: {
      before: state,
      after: state,
      incomplete: false,
      selection: { paths: [], beforeEdges: [], afterEdges: [], unanalyzedChanges: [] },
      merged: {
        nodes: path
          ? [
              {
                id: "reused-id",
                oldPath: path,
                newPath: path,
                status: "modified",
                analyzed: { before: true, after: true },
                change,
              },
            ]
          : [],
        edges: [],
      },
    },
  };
}
function api(initial: ReviewSummary) {
  const state = {
    snapshot: initial,
    next: initial,
    failure: false,
    saveFailure: false,
    status: {
      snapshotId: initial.id,
      stale: false,
      refreshing: false,
      error: null,
    } as ReviewStatus,
    saved: [] as Settings[],
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const response = (value: unknown, status = 200) =>
        new Response(JSON.stringify(value), { status });
      if (url === "/api/snapshot") return response(state.snapshot);
      if (url === "/api/status") return response(state.status);
      if (url === "/api/settings") {
        if (init?.method === "POST") {
          const settings = JSON.parse(init.body as string) as Settings;
          state.saved.push(settings);
          if (state.saveFailure) return response({ error: "Disk full" }, 500);
          return response({ settings, warning: null });
        }
        return response({
          settings: { theme: "catppuccin-mocha", orientation: "LR" },
          warning: null,
        });
      }
      if (url === "/api/refresh") {
        if (state.failure) return response({ error: "Comparison ref missing" }, 503);
        state.snapshot = state.next;
        state.status = { ...state.status, snapshotId: state.next.id, stale: false };
        return response(state.next);
      }
      if (url.startsWith("/api/file?"))
        return response({ encoding: "utf8", content: "captured full file" });
      throw new Error(`Unexpected request: ${url}`);
    }),
  );
  return state;
}
let measuredWidth = 1440;
let resizeWorkspace: () => void;
beforeEach(() => {
  measuredWidth = 1440;
  document.cookie = "changemap.workspace=; Max-Age=0; Path=/";
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => measuredWidth);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resizeWorkspace = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

test("stale notification and failed refresh preserve selected graph and code; successful retry replaces both", async () => {
  const state = api(snapshot("old-snapshot", "old.ts"));
  render(createElement(App));
  fireEvent.click(await screen.findByText("Open old.ts"));
  expect(addedCode()).toContain("old-snapshot");
  state.status = { ...state.status, stale: true };
  expect(await screen.findByText(/New changes are available/, {}, { timeout: 3000 })).toBeTruthy();
  expect(addedCode()).toContain("old-snapshot");
  state.failure = true;
  fireEvent.click(screen.getByRole("button", { name: /Refresh comparison/ }));
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    expect.stringContaining("Comparison ref missing"),
  );
  expect(screen.getByText("Open old.ts")).toBeTruthy();
  expect(addedCode()).toContain("old-snapshot");
  state.failure = false;
  state.next = snapshot("new-snapshot", "new.ts");
  fireEvent.click(screen.getByRole("button", { name: /Retry refresh/ }));
  expect(await screen.findByText("Open new.ts")).toBeTruthy();
  expect(screen.queryByText("Open old.ts")).toBeNull();
  expect(screen.queryByLabelText("Code pane")).toBeNull();
  fireEvent.click(screen.getByText("Open new.ts"));
  expect(addedCode()).toContain("new-snapshot");
});

test("empty review transitions on explicit refresh; incomplete analysis outside visible files is announced", async () => {
  const state = api(snapshot("empty"));
  render(createElement(App));
  expect(await screen.findByText("No changes")).toBeTruthy();
  state.next = snapshot("populated", "file.ts");
  state.next = { ...state.next, graph: { ...state.next.graph, incomplete: true } };
  fireEvent.click(screen.getByRole("button", { name: /Refresh comparison/ }));
  expect(await screen.findByText("Open file.ts")).toBeTruthy();
  expect(screen.queryByText("No changes")).toBeNull();
  expect(screen.getByText(/Direct users may be missing/)).toBeTruthy();
});

test("theme and direction remain applied after failed saves and review continues", async () => {
  const state = api(snapshot("one", "file.ts"));
  state.saveFailure = true;
  const { container } = render(createElement(App));
  await screen.findByText("Open file.ts");
  await waitFor(() =>
    expect((screen.getByLabelText("Theme") as HTMLSelectElement).disabled).toBe(false),
  );
  for (const theme of [
    "catppuccin-latte",
    "catppuccin-frappe",
    "catppuccin-macchiato",
    "catppuccin-mocha",
  ]) {
    fireEvent.change(screen.getByLabelText("Theme"), { target: { value: theme } });
    expect(container.querySelector(".app")?.getAttribute("data-theme")).toBe(theme);
  }
  for (const direction of ["TB", "RL", "BT", "LR"]) {
    fireEvent.change(screen.getByLabelText("Direction"), { target: { value: direction } });
    expect(screen.getByLabelText("Test graph").getAttribute("data-direction")).toBe(direction);
  }
  expect(await screen.findByText(/Settings could not be saved/)).toBeTruthy();
  expect(state.saved).toHaveLength(8);
  expect(state.saved.at(-1)).toEqual({ theme: "catppuccin-mocha", orientation: "LR" });
  fireEvent.click(screen.getByText("Open file.ts"));
  expect(addedCode()).toContain("one");
});

test("all bundled themes appear in the existing selector and update the whole app", async () => {
  api(snapshot("one", "file.ts"));
  const { container } = render(createElement(App));
  await waitFor(() =>
    expect((screen.getByLabelText("Theme") as HTMLSelectElement).disabled).toBe(false),
  );
  const selector = screen.getByLabelText("Theme") as HTMLSelectElement;
  expect([...selector.options].map((option) => option.value)).toEqual(themes);
  for (const theme of themes.slice(4)) {
    fireEvent.change(selector, { target: { value: theme } });
    const app = container.querySelector<HTMLElement>(".app");
    expect(app?.dataset.theme).toBe(theme);
    expect(app?.style.getPropertyValue("--base")).toMatch(/^#[0-9a-f]{6}$/);
    expect(app?.style.getPropertyValue("--text")).toMatch(/^#[0-9a-f]{6}$/);
  }
});

test("selection survives refresh with updated code, then closes when the file disappears", async () => {
  const state = api(snapshot("one", "file.ts"));
  render(createElement(App));
  fireEvent.click(await screen.findByText("Open file.ts"));
  const graph = screen.getByLabelText("Test graph");
  state.next = snapshot("two", "file.ts");
  fireEvent.click(screen.getByRole("button", { name: /Refresh comparison/ }));
  await waitFor(() => expect(addedCode()).toContain("two"));
  expect(screen.getByLabelText("Test graph")).toBe(graph);
  state.next = snapshot("three");
  fireEvent.click(screen.getByRole("button", { name: /Refresh comparison/ }));
  await screen.findByText("No changes");
  expect(screen.queryByLabelText("Code pane")).toBeNull();
});

test("pane starts closed, supports keyboard resize, remembers width and returns to the same graph", async () => {
  api(snapshot("one", "file.ts"));
  const view = render(createElement(App));
  const file = await screen.findByText("Open file.ts");
  expect(screen.queryByLabelText("Code pane")).toBeNull();
  fireEvent.click(file);
  fireEvent.click(screen.getByRole("button", { name: "Split diff" }));
  expect(screen.queryByLabelText("Wrap lines")).toBeNull();
  expect(document.cookie).toContain("changemap.workspace=");
  const separator = screen.getByRole("separator");
  expect(separator.getAttribute("aria-valuenow")).toBe("30");
  fireEvent.keyDown(separator, { key: "End" });
  expect(separator.getAttribute("aria-valuenow")).toBe("55");
  fireEvent.keyDown(separator, { key: "ArrowLeft" });
  expect(separator.getAttribute("aria-valuenow")).toBe("55");
  fireEvent.click(screen.getByRole("button", { name: /Close code pane/ }));
  expect(screen.queryByLabelText("Code pane")).toBeNull();
  expect(screen.getByText("Open file.ts")).toBe(file);
  fireEvent.click(screen.getByText("Open selected file"));
  expect(screen.getByRole("separator").getAttribute("aria-valuenow")).toBe("55");
  view.unmount();
  render(createElement(App));
  fireEvent.click(await screen.findByText("Open file.ts"));
  expect(screen.getByRole("separator").getAttribute("aria-valuenow")).toBe("55");
  expect(screen.getByRole("button", { name: "Split diff" }).getAttribute("aria-pressed")).toBe(
    "true",
  );
  expect(screen.queryByLabelText("Wrap lines")).toBeNull();
});

test("wide screens cap the code pane at 1440px without discarding a saved 55% preference", async () => {
  measuredWidth = 3200;
  document.cookie = `changemap.workspace=${encodeURIComponent(JSON.stringify({ width: 55, listOpen: true }))}; Path=/`;
  api(snapshot("one", "file.ts"));
  render(createElement(App));
  fireEvent.click(await screen.findByText("Open file.ts"));
  const separator = screen.getByRole("separator");
  const workspace = screen.getByLabelText("Change map").parentElement!;
  expect(separator.getAttribute("aria-valuemax")).toBe("45");
  expect(separator.getAttribute("aria-valuenow")).toBe("45");
  expect(workspace.style.getPropertyValue("--pane-width")).toBe("45%");
  act(() => {
    measuredWidth = 2560;
    resizeWorkspace();
  });
  expect(separator.getAttribute("aria-valuemax")).toBe("55");
  expect(separator.getAttribute("aria-valuenow")).toBe("55");
  expect(workspace.style.getPropertyValue("--pane-width")).toBe("55%");
  act(() => {
    measuredWidth = 3200;
    resizeWorkspace();
  });
  fireEvent.keyDown(separator, { key: "End" });
  expect(separator.getAttribute("aria-valuenow")).toBe("45");
});

test("narrow screen returns to the graph without losing selection or remounting it", async () => {
  api(snapshot("one", "file.ts"));
  render(createElement(App));
  const file = await screen.findByText("Open file.ts");
  act(() => {
    measuredWidth = 390;
    resizeWorkspace();
  });
  fireEvent.click(file);
  const back = screen.getByRole("button", { name: /Back to graph/ });
  expect(document.activeElement).toBe(back);
  expect(screen.getByLabelText("Change map").hasAttribute("inert")).toBe(true);
  fireEvent.click(back);
  expect(screen.getByLabelText("Change map").hasAttribute("inert")).toBe(false);
  expect(screen.getByText("Open file.ts")).toBe(file);
  fireEvent.click(screen.getByText("Open selected file"));
  expect(screen.getByLabelText("File diff")).toBeTruthy();
});

test("outside file list can be collapsed and restored; analysis details start collapsed", async () => {
  const initial = snapshot("one", "README.md");
  const node = initial.graph.merged.nodes[0];
  api({
    ...initial,
    graph: {
      ...initial.graph,
      incomplete: true,
      merged: {
        ...initial.graph.merged,
        nodes: [{ ...node, analyzed: { before: false, after: false } }],
      },
    },
  });
  const view = render(createElement(App));
  fireEvent.click(await screen.findByText("README.md"));
  expect(screen.getByLabelText("File diff")).toBeTruthy();
  expect(screen.getByText(/Direct users may be missing/).closest("details")?.open).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: /Other files/ }));
  expect(screen.queryByLabelText("Unanalyzed changed files")).toBeNull();
  view.unmount();
  render(createElement(App));
  const toggle = await screen.findByRole("button", { name: /Other files/ });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(toggle);
  expect(screen.getByLabelText("Unanalyzed changed files")).toBeTruthy();
});
