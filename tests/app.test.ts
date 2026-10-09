// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "../src/ui/app.js";
import type { ReviewSummary, ReviewStatus } from "../src/shared/review.js";
import type { Settings } from "../src/shared/settings.js";
import { themes } from "../src/shared/settings.js";
import type { ReviewGraph } from "../src/graph/model.js";
import type { MapModel } from "../src/ui/map-model.js";

// Canvas geometry is tested separately and measured in Chromium. Keep the real
// App, CodePane, API client, and all asynchronous state transitions in this suite.
vi.mock("../src/ui/graph.js", async (original) => ({
  ...(await original<typeof import("../src/ui/graph.js")>()),
  Graph: ({
    model,
    direction,
    groupByDirectory,
    onSelect,
  }: {
    graph: ReviewGraph;
    model: MapModel;
    direction: string;
    groupByDirectory: boolean;
    onSelect(id: string): void;
  }) =>
    createElement(
      "div",
      { "aria-label": "Test graph", "data-direction": direction, "data-grouped": groupByDirectory },
      ...model.nodes.map((n) =>
        createElement(
          "button",
          { key: n.id, onClick: () => onSelect(n.id) },
          n.kind === "package" ? `Open Go package ${n.path}` : `Open ${n.path}`,
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
          settings: { theme: "catppuccin-mocha", orientation: "LR", groupByDirectory: true },
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
const resizeCallbacks = new Set<() => void>();
function resizeWorkspace() {
  for (const callback of resizeCallbacks) callback();
}
beforeEach(() => {
  measuredWidth = 1440;
  resizeCallbacks.clear();
  document.cookie = "changemap.workspace=; Max-Age=0; Path=/";
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => measuredWidth);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resizeCallbacks.add(callback);
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
  expect(await screen.findByText(/Update available/, {}, { timeout: 3000 })).toBeTruthy();
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
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
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
    fireEvent.change(screen.getByLabelText("Graph direction"), { target: { value: direction } });
    expect(screen.getByLabelText("Test graph").getAttribute("data-direction")).toBe(direction);
  }
  expect((await screen.findAllByText(/Settings could not be saved/)).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: "Close settings" }));
  expect(document.querySelector(".settings-warning-indicator")).toBeTruthy();
  expect(state.saved).toHaveLength(8);
  expect(state.saved.at(-1)).toEqual({
    theme: "catppuccin-mocha",
    orientation: "LR",
    groupByDirectory: true,
  });
  fireEvent.click(screen.getByText("Open file.ts"));
  expect(addedCode()).toContain("one");
});

test("directory grouping applies immediately and is saved", async () => {
  const state = api(snapshot("one", "src/file.ts"));
  render(createElement(App));
  fireEvent.click(await screen.findByText("Open src/file.ts"));
  expect(addedCode()).toContain("one");
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  const checkbox = screen.getByRole("checkbox", { name: "Group files by directory" });
  await waitFor(() => expect(checkbox.hasAttribute("disabled")).toBe(false));
  expect(screen.getByLabelText("Test graph").getAttribute("data-grouped")).toBe("true");
  fireEvent.click(checkbox);
  expect(screen.getByLabelText("Test graph").getAttribute("data-grouped")).toBe("false");
  expect(addedCode()).toContain("one");
  await waitFor(() => expect(state.saved.at(-1)?.groupByDirectory).toBe(false));
});

test("all bundled themes appear in the existing selector and update the whole app", async () => {
  api(snapshot("one", "file.ts"));
  const { container } = render(createElement(App));
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
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

test("diff preferences chosen in an empty review survive reopening", async () => {
  api(snapshot("empty"));
  const view = render(createElement(App));
  await screen.findByText("No changes");
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  fireEvent.click(screen.getByRole("radio", { name: /Split/ }));
  fireEvent.click(screen.getByRole("button", { name: "Close settings" }));
  expect(decodeURIComponent(document.cookie)).toContain('"layout":"split"');
  view.unmount();
  render(createElement(App));
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  expect(screen.getByRole("radio", { name: /Split/ }).getAttribute("aria-checked")).toBe("true");
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
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  fireEvent.click(screen.getByRole("radio", { name: /Split/ }));
  fireEvent.click(screen.getByRole("button", { name: "Close settings" }));
  expect(screen.queryByLabelText("Wrap lines")).toBeNull();
  expect(document.cookie).toContain("changemap.workspace=");
  const separator = screen.getByRole("separator");
  expect(separator.getAttribute("aria-valuenow")).toBe("648");
  expect(separator.getAttribute("aria-valuetext")).toBe("648 pixels");
  fireEvent.keyDown(separator, { key: "Home" });
  expect(separator.getAttribute("aria-valuenow")).toBe("320");
  fireEvent.keyDown(separator, { key: "ArrowLeft" });
  expect(separator.getAttribute("aria-valuenow")).toBe("340");
  fireEvent.keyDown(separator, { key: "ArrowRight" });
  expect(separator.getAttribute("aria-valuenow")).toBe("320");
  fireEvent.keyDown(separator, { key: "End" });
  expect(separator.getAttribute("aria-valuenow")).toBe("1114");
  fireEvent.keyDown(separator, { key: "ArrowLeft" });
  expect(separator.getAttribute("aria-valuenow")).toBe("1114");
  fireEvent.click(screen.getByRole("button", { name: /Close code pane/ }));
  expect(screen.queryByLabelText("Code pane")).toBeNull();
  expect(screen.getByText("Open file.ts")).toBe(file);
  fireEvent.click(screen.getByText("Open selected file"));
  expect(screen.getByRole("separator").getAttribute("aria-valuenow")).toBe("1114");
  view.unmount();
  measuredWidth = 1800;
  render(createElement(App));
  fireEvent.click(await screen.findByText("Open file.ts"));
  expect(screen.getByRole("separator").getAttribute("aria-valuenow")).toBe("1114");
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  expect(screen.getByRole("radio", { name: /Split/ }).getAttribute("aria-checked")).toBe("true");
  expect(screen.queryByLabelText("Wrap lines")).toBeNull();
});

test("legacy percentages migrate once and retain their pixel width across resizing and reloads", async () => {
  measuredWidth = 1400;
  document.cookie = `changemap.workspace=${encodeURIComponent(JSON.stringify({ width: 60, listOpen: true }))}; Path=/`;
  api(snapshot("one", "file.ts"));
  const view = render(createElement(App));
  fireEvent.click(await screen.findByText("Open file.ts"));
  const workspace = screen.getByLabelText("Change map").parentElement!;
  expect(workspace.style.getPropertyValue("--pane-width")).toBe("840px");
  expect(decodeURIComponent(document.cookie)).toContain('"width":840,"widthUnit":"px"');
  act(() => {
    measuredWidth = 1800;
    resizeWorkspace();
  });
  expect(workspace.style.getPropertyValue("--pane-width")).toBe("840px");
  view.unmount();
  measuredWidth = 2000;
  render(createElement(App));
  fireEvent.click(await screen.findByText("Open file.ts"));
  expect(screen.getByRole("separator").getAttribute("aria-valuenow")).toBe("840");
});

test("initial width is set when first opened on a wide screen, rather than when the page loads", async () => {
  api(snapshot("one", "file.ts"));
  render(createElement(App));
  const file = await screen.findByText("Open file.ts");
  act(() => {
    measuredWidth = 1800;
    resizeWorkspace();
  });
  fireEvent.click(file);
  expect(screen.getByRole("separator").getAttribute("aria-valuenow")).toBe("810");
  act(() => {
    measuredWidth = 2000;
    resizeWorkspace();
  });
  expect(screen.getByRole("separator").getAttribute("aria-valuenow")).toBe("810");
});

test.each([undefined, 60])(
  "narrow startup defers converting %s until the first wide screen",
  async (width) => {
    measuredWidth = 390;
    if (width !== undefined)
      document.cookie = `changemap.workspace=${encodeURIComponent(JSON.stringify({ width }))}; Path=/`;
    api(snapshot("one", "file.ts"));
    render(createElement(App));
    fireEvent.click(await screen.findByText("Open file.ts"));
    expect(screen.getByRole("button", { name: /Back to graph/ })).toBeTruthy();
    expect(decodeURIComponent(document.cookie)).toContain('"widthUnit":"%"');
    act(() => {
      measuredWidth = 959;
      resizeWorkspace();
    });
    expect(decodeURIComponent(document.cookie)).toContain('"widthUnit":"%"');
    act(() => {
      measuredWidth = 960;
      resizeWorkspace();
    });
    const preferred = (960 * (width ?? 45)) / 100;
    expect(decodeURIComponent(document.cookie)).toContain(`"width":${preferred},"widthUnit":"px"`);
    act(() => {
      measuredWidth = 1440;
      resizeWorkspace();
    });
    expect(screen.getByRole("separator").getAttribute("aria-valuenow")).toBe(String(preferred));
  },
);

test("pixel widths temporarily shrink to fit and restore without overwriting the saved preference", async () => {
  document.cookie = `changemap.workspace=${encodeURIComponent(JSON.stringify({ width: 800, widthUnit: "px" }))}; Path=/`;
  api(snapshot("one", "file.ts"));
  const view = render(createElement(App));
  fireEvent.click(await screen.findByText("Open file.ts"));
  const workspace = screen.getByLabelText("Change map").parentElement!;
  for (const [width, expected] of [
    [1800, 800],
    [1100, 774],
    [960, 634],
  ]) {
    act(() => {
      measuredWidth = width;
      resizeWorkspace();
    });
    expect(workspace.style.getPropertyValue("--pane-width")).toBe(`${expected}px`);
    expect(decodeURIComponent(document.cookie)).toContain('"width":800,"widthUnit":"px"');
  }
  view.unmount();
  const reloaded = render(createElement(App));
  fireEvent.click(await screen.findByText("Open file.ts"));
  expect(screen.getByRole("separator").getAttribute("aria-valuenow")).toBe("634");
  act(() => {
    measuredWidth = 390;
    resizeWorkspace();
  });
  expect(screen.getByRole("button", { name: /Back to graph/ })).toBeTruthy();
  act(() => {
    measuredWidth = 1800;
    resizeWorkspace();
  });
  expect(screen.getByRole("separator").getAttribute("aria-valuenow")).toBe("800");
  reloaded.unmount();
});

test("pointer resizing stores pixels using the workspace right edge", async () => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  api(snapshot("one", "file.ts"));
  const view = render(createElement(App));
  fireEvent.click(await screen.findByText("Open file.ts"));
  const separator = screen.getByRole("separator");
  const workspace = screen.getByLabelText("Change map").parentElement!;
  vi.spyOn(workspace, "getBoundingClientRect").mockReturnValue({
    x: 100,
    y: 0,
    left: 100,
    right: 1540,
    top: 0,
    bottom: 800,
    width: 1440,
    height: 800,
    toJSON() {},
  });
  Object.assign(separator, { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() });
  fireEvent.pointerMove(separator, { clientX: 700 });
  expect(separator.getAttribute("aria-valuenow")).toBe("648");
  fireEvent.pointerDown(separator, { button: 0 });
  fireEvent.pointerMove(separator, { clientX: 700 });
  fireEvent.pointerUp(separator);
  expect(separator.getAttribute("aria-valuenow")).toBe("840");
  expect(decodeURIComponent(document.cookie)).toContain('"width":840,"widthUnit":"px"');
  view.unmount();
  measuredWidth = 2000;
  render(createElement(App));
  fireEvent.click(await screen.findByText("Open file.ts"));
  expect(screen.getByRole("separator").getAttribute("aria-valuenow")).toBe("840");
});

test("wide screens cap the code pane at 1920px and restore that pixel width", async () => {
  measuredWidth = 3200;
  document.cookie = `changemap.workspace=${encodeURIComponent(JSON.stringify({ width: 70, listOpen: true }))}; Path=/`;
  api(snapshot("one", "file.ts"));
  render(createElement(App));
  fireEvent.click(await screen.findByText("Open file.ts"));
  const separator = screen.getByRole("separator");
  const workspace = screen.getByLabelText("Change map").parentElement!;
  expect(separator.getAttribute("aria-valuemax")).toBe("1920");
  expect(separator.getAttribute("aria-valuenow")).toBe("1920");
  expect(workspace.style.getPropertyValue("--pane-width")).toBe("1920px");
  act(() => {
    measuredWidth = 2560;
    resizeWorkspace();
  });
  expect(separator.getAttribute("aria-valuemax")).toBe("1920");
  expect(separator.getAttribute("aria-valuenow")).toBe("1920");
  expect(workspace.style.getPropertyValue("--pane-width")).toBe("1920px");
  act(() => {
    measuredWidth = 2200;
    resizeWorkspace();
  });
  expect(separator.getAttribute("aria-valuenow")).toBe("1874");
  act(() => {
    measuredWidth = 3200;
    resizeWorkspace();
  });
  expect(separator.getAttribute("aria-valuenow")).toBe("1920");
});

test("open Other files leaves at least 320px for the graph beside the code pane", async () => {
  const initial = snapshot("one", "README.md");
  const file = initial.graph.merged.nodes[0];
  api({
    ...initial,
    graph: {
      ...initial.graph,
      merged: {
        ...initial.graph.merged,
        nodes: [{ ...file, analyzed: { before: false, after: false } }],
      },
    },
  });
  document.cookie = `changemap.workspace=${encodeURIComponent(JSON.stringify({ width: 70, listOpen: true }))}; Path=/`;
  render(createElement(App));
  fireEvent.click(await screen.findByText("README.md"));
  const workspace = screen.getByLabelText("Change map").parentElement!;
  const paneWidth = Number.parseFloat(workspace.style.getPropertyValue("--pane-width"));
  expect(measuredWidth - paneWidth - 280 - 6).toBe(320);
  fireEvent.click(screen.getByRole("button", { name: /Close Other files/ }));
  expect(workspace.style.getPropertyValue("--pane-width")).toBe("1008px");
  fireEvent.click(screen.getByRole("button", { name: /Open Other files/ }));
  expect(workspace.style.getPropertyValue("--pane-width")).toBe("834px");
  expect(decodeURIComponent(document.cookie)).toContain('"width":1008,"widthUnit":"px"');
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
  const toggle = await screen.findByRole("button", { name: /Open Other files/ });
  fireEvent.click(toggle);
  fireEvent.click(screen.getByText("README.md"));
  expect(screen.getByLabelText("File diff")).toBeTruthy();
  expect(screen.getByText(/Direct users may be missing/).closest("details")?.open).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: /Close Other files/ }));
  expect(screen.getByLabelText("Unanalyzed changed files").getAttribute("aria-hidden")).toBe(
    "true",
  );
  view.unmount();
  render(createElement(App));
  const restoredToggle = await screen.findByRole("button", { name: /Other files/ });
  expect(restoredToggle.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(restoredToggle);
  expect(screen.getByLabelText("Unanalyzed changed files")).toBeTruthy();
});

test("shows the selected Go configuration and retains partial-analysis diagnostics", async () => {
  const initial = snapshot("go", "main.go");
  api({
    ...initial,
    graph: {
      ...initial.graph,
      incomplete: true,
      after: {
        ...initial.graph.after,
        go: { os: "linux", arch: "amd64", tags: ["integration"], version: "go1.26.5", cgo: false },
        diagnostics: [
          { path: "main.go", message: "External package is unavailable in the captured module." },
        ],
      },
    },
  });
  render(createElement(App));
  await screen.findByText("Open Go package .");
  fireEvent.click(screen.getByRole("button", { name: "Snapshot details" }));
  expect(await screen.findByText(/linux\/amd64/)).toBeTruthy();
  expect(screen.getByText(/tags: integration/)).toBeTruthy();
  expect(screen.getByText(/External package is unavailable/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Snapshot details" }));
  fireEvent.click(screen.getByText("Open Go package ."));
  fireEvent.click(screen.getByRole("button", { name: "Open main.go" }));
  expect(screen.getByLabelText("File diff")).toBeTruthy();
});

function goSnapshot() {
  const initial = snapshot("go-review", "service/user.go");
  const changed = initial.graph.merged.nodes[0];
  const related = {
    ...changed,
    id: "related-id",
    oldPath: "service/helper.go",
    newPath: "service/helper.go",
    status: "unchanged" as const,
    change: null,
  };
  const state = {
    ...initial.graph.before,
    nodes: ["service/user.go", "service/helper.go"].map((path) => ({ path })),
    edges: [{ source: "service/user.go", target: "service/helper.go" }],
  };
  return {
    ...initial,
    graph: {
      ...initial.graph,
      before: state,
      after: state,
      merged: {
        nodes: [changed, related],
        edges: [{ source: changed.id, target: related.id, status: "unchanged" as const }],
      },
    },
  };
}

test("Go package and code panes share a fixed pixel width and restore it after temporary shrinking", async () => {
  api(goSnapshot());
  render(createElement(App));
  fireEvent.click(await screen.findByRole("button", { name: "Open Go package service" }));
  const separator = screen.getByRole("separator");
  expect(separator.getAttribute("aria-valuenow")).toBe("648");
  fireEvent.keyDown(separator, { key: "ArrowLeft" });
  expect(separator.getAttribute("aria-valuenow")).toBe("668");
  act(() => {
    measuredWidth = 1800;
    resizeWorkspace();
  });
  expect(separator.getAttribute("aria-valuenow")).toBe("668");
  fireEvent.click(screen.getByRole("button", { name: "Open service/user.go" }));
  expect(screen.getByLabelText("Code pane")).toBeTruthy();
  expect(separator.getAttribute("aria-valuenow")).toBe("668");
  act(() => {
    measuredWidth = 980;
    resizeWorkspace();
  });
  expect(separator.getAttribute("aria-valuenow")).toBe("654");
  expect(decodeURIComponent(document.cookie)).toContain('"width":668,"widthUnit":"px"');
  fireEvent.click(screen.getByRole("button", { name: "Back to package files" }));
  expect(separator.getAttribute("aria-valuenow")).toBe("654");
  act(() => {
    measuredWidth = 1800;
    resizeWorkspace();
  });
  expect(screen.getByLabelText("Go package service files")).toBeTruthy();
  expect(separator.getAttribute("aria-valuenow")).toBe("668");
});

test("Go packages open a changed/related file list, code and a return path while file mode preserves selection", async () => {
  api(goSnapshot());
  const view = render(createElement(App));
  const openPackage = await screen.findByRole("button", { name: "Open Go package service" });
  expect((screen.getByLabelText("Go map granularity") as HTMLSelectElement).value).toBe("packages");
  expect(screen.queryByLabelText("Code pane")).toBeNull();
  fireEvent.click(openPackage);
  expect(screen.getByLabelText("Changed files").textContent).toContain("user.go");
  expect(screen.getByLabelText("Related files").textContent).toContain("helper.go");
  fireEvent.click(screen.getByRole("button", { name: "Open service/user.go" }));
  expect(addedCode()).toContain("go-review");
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close code pane" }));
  fireEvent.click(screen.getByRole("button", { name: "Back to package files" }));
  fireEvent.click(screen.getByRole("button", { name: "Open service/helper.go" }));
  expect(await screen.findByLabelText("Full file")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Go map granularity"), { target: { value: "files" } });
  expect(screen.getByLabelText("Code pane")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Back to package files" })).toBeNull();
  expect(screen.getByRole("button", { name: "Open service/user.go" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Close code pane" }));
  view.unmount();
  render(createElement(App));
  await screen.findByRole("button", { name: "Open service/user.go" });
  expect((screen.getByLabelText("Go map granularity") as HTMLSelectElement).value).toBe("files");
});

test("narrow package/file navigation returns to the map and can reopen the package", async () => {
  measuredWidth = 390;
  api(goSnapshot());
  render(createElement(App));
  fireEvent.click(await screen.findByRole("button", { name: "Open Go package service" }));
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Back to graph" }));
  expect(screen.getByLabelText("Change map").hasAttribute("inert")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Open service/user.go" }));
  fireEvent.click(screen.getByRole("button", { name: "Back to package files" }));
  fireEvent.click(screen.getByRole("button", { name: "Back to graph" }));
  expect(screen.getByLabelText("Change map").hasAttribute("inert")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Open selected package" }));
  expect(screen.getByLabelText("Go package service files")).toBeTruthy();
});

test("a selected package updates its list on refresh and closes when its files disappear", async () => {
  const state = api(goSnapshot());
  render(createElement(App));
  fireEvent.click(await screen.findByRole("button", { name: "Open Go package service" }));
  state.next = { ...goSnapshot(), id: "updated" };
  fireEvent.click(screen.getByRole("button", { name: "Refresh comparison" }));
  await waitFor(() => expect(state.snapshot.id).toBe("updated"));
  expect(screen.getByLabelText("Go package service files")).toBeTruthy();
  state.next = snapshot("typescript-only", "a.ts");
  fireEvent.click(screen.getByRole("button", { name: "Refresh comparison" }));
  await screen.findByText("Open a.ts");
  expect(screen.queryByLabelText("Go package service files")).toBeNull();
  expect(screen.queryByLabelText("Go map granularity")).toBeNull();
});
