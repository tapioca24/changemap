// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { App } from "../src/ui/app.js";
import type { ReviewSummary, ReviewStatus } from "../src/shared/review.js";
import type { Settings } from "../src/shared/settings.js";
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
        return response({ settings: { theme: "mocha", orientation: "LR" }, warning: null });
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
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test("stale notification and failed refresh preserve selected graph and code; successful retry replaces both", async () => {
  const state = api(snapshot("old-snapshot", "old.ts"));
  render(createElement(App));
  fireEvent.click(await screen.findByText("Open old.ts"));
  expect(screen.getByLabelText("File diff").textContent).toContain("+old-snapshot");
  state.status = { ...state.status, stale: true };
  expect(await screen.findByText(/New changes are available/, {}, { timeout: 3000 })).toBeTruthy();
  expect(screen.getByLabelText("File diff").textContent).toContain("+old-snapshot");
  state.failure = true;
  fireEvent.click(screen.getByRole("button", { name: /Refresh comparison/ }));
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    expect.stringContaining("Comparison ref missing"),
  );
  expect(screen.getByText("Open old.ts")).toBeTruthy();
  expect(screen.getByLabelText("File diff").textContent).toContain("+old-snapshot");
  state.failure = false;
  state.next = snapshot("new-snapshot", "new.ts");
  fireEvent.click(screen.getByRole("button", { name: /Retry refresh/ }));
  expect(await screen.findByText("Open new.ts")).toBeTruthy();
  expect(screen.queryByText("Open old.ts")).toBeNull();
  expect(screen.queryByLabelText("Code pane")).toBeNull();
  fireEvent.click(screen.getByText("Open new.ts"));
  expect(screen.getByLabelText("File diff").textContent).toContain("+new-snapshot");
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
  for (const theme of ["latte", "frappe", "macchiato", "mocha"]) {
    fireEvent.change(screen.getByLabelText("Theme"), { target: { value: theme } });
    expect(container.querySelector(".app")?.getAttribute("data-theme")).toBe(theme);
  }
  for (const direction of ["TB", "RL", "BT", "LR"]) {
    fireEvent.change(screen.getByLabelText("Direction"), { target: { value: direction } });
    expect(screen.getByLabelText("Test graph").getAttribute("data-direction")).toBe(direction);
  }
  expect(await screen.findByText(/Settings could not be saved/)).toBeTruthy();
  expect(state.saved).toHaveLength(8);
  expect(state.saved.at(-1)).toEqual({ theme: "mocha", orientation: "LR" });
  fireEvent.click(screen.getByText("Open file.ts"));
  expect(screen.getByLabelText("File diff").textContent).toContain("+one");
});
