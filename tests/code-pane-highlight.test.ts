// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { CodePane } from "../src/ui/code-pane.js";
import { highlightFile } from "../src/ui/highlight-client.js";
import type { MergedFileNode } from "../src/graph/model.js";
import type { ReviewSummary } from "../src/shared/review.js";

vi.mock("../src/ui/highlight-client.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/ui/highlight-client.js")>();
  return { ...original, highlightFile: vi.fn() };
});

const node: MergedFileNode = {
  id: "renamed",
  oldPath: "before.js",
  newPath: "after.ts",
  status: "renamed",
  analyzed: { before: false, after: false },
  change: {
    status: "renamed",
    oldPath: "before.js",
    newPath: "after.ts",
    oldMode: "100644",
    newMode: "100644",
    binary: false,
    patch:
      "diff --git a/before.js b/after.ts\n--- a/before.js\n+++ b/after.ts\n@@ -1 +1 @@\n-const old = 1;\n+const fresh = 2;\n",
  },
};
const empty = { nodes: [], edges: [], references: [], diagnostics: [] };
const snapshot: ReviewSummary = {
  id: "snapshot-1",
  capturedAt: "2026-09-25",
  repository: "/repo",
  mode: ".",
  before: { kind: "commit", label: "HEAD" },
  after: { kind: "worktree", label: "Working tree" },
  changes: [],
  graph: {
    merged: { nodes: [node], edges: [] },
    before: empty,
    after: empty,
    selection: { paths: [], beforeEdges: [], afterEdges: [], unanalyzedChanges: [] },
    incomplete: false,
  },
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.mocked(highlightFile).mockReset();
});

test("diff and full files use their own language tokens while change markers stay hidden", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify({
            encoding: "utf8",
            content: url.includes("side=before") ? "const old = 1;\n" : "const fresh = 2;\n",
          }),
        ),
    ),
  );
  vi.mocked(highlightFile).mockImplementation(async (content, language) =>
    content
      .trimEnd()
      .split("\n")
      .map((line) => [{ content: line, color: `var(--test-${language})` }]),
  );
  render(createElement(CodePane, { snapshot, node }));
  const diff = screen.getByLabelText("File diff");
  await waitFor(() => expect(diff.querySelectorAll(".code-line span[style]")).toHaveLength(2));
  expect(diff.querySelector(".line-delete")?.textContent).toContain("const old = 1;");
  expect(diff.querySelector(".line-add")?.textContent).toContain("const fresh = 2;");
  expect(diff.querySelector(".line-delete span[style]")?.getAttribute("style")).toContain(
    "--test-javascript",
  );
  expect(diff.querySelector(".line-add span[style]")?.getAttribute("style")).toContain(
    "--test-typescript",
  );
  expect(diff.textContent).not.toContain("-const");
  expect(diff.textContent).not.toContain("+const");
  expect(diff.textContent).not.toContain("+++ b/");

  fireEvent.click(screen.getByText("Before · full file"));
  const full = await screen.findByLabelText("Full file");
  expect(full.querySelector(".code-line span[style]")?.getAttribute("style")).toContain(
    "--test-javascript",
  );
  fireEvent.click(screen.getByText("After · full file"));
  await waitFor(() =>
    expect(
      screen
        .getByLabelText("Full file")
        .querySelector(".code-line span[style]")
        ?.getAttribute("style"),
    ).toContain("--test-typescript"),
  );
  expect(vi.mocked(highlightFile).mock.calls.map(([, language]) => language)).toEqual([
    "javascript",
    "typescript",
  ]);
});

test("highlight failures keep diff code readable and report the reason", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ encoding: "utf8", content: "const x = 1;" }))),
  );
  vi.mocked(highlightFile).mockRejectedValue(
    new Error("File is too large for syntax highlighting."),
  );
  render(createElement(CodePane, { snapshot, node }));
  expect(await screen.findByText(/File is too large for syntax highlighting/)).toBeTruthy();
  expect(screen.getByLabelText("File diff").textContent).toContain("const fresh = 2;");
  expect(screen.getByLabelText("File diff").querySelector(".line-add")).toBeTruthy();
});

test("copies each path of a renamed file and confirms success", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 404 })),
  );
  render(createElement(CodePane, { snapshot, node }));

  fireEvent.click(screen.getByRole("button", { name: "Copy after.ts" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith("after.ts"));
  expect(await screen.findByText("Copied after.ts")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Copy after.ts" }).classList.contains("copied")).toBe(
    true,
  );

  fireEvent.click(screen.getByRole("button", { name: "Copy before.js" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith("before.js"));
  expect(screen.getAllByRole("status").map((status) => status.textContent)).toContain(
    "Copied before.js",
  );
});

test("reports clipboard failures beside the path", async () => {
  vi.stubGlobal("navigator", {
    clipboard: { writeText: vi.fn().mockRejectedValue(new Error("Denied")) },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 404 })),
  );
  render(createElement(CodePane, { snapshot, node }));

  fireEvent.click(screen.getByRole("button", { name: "Copy after.ts" }));
  expect((await screen.findByRole("alert")).textContent).toBe("コピーできませんでした");
});
