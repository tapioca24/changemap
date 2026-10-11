// @vitest-environment jsdom
import { createElement, type ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { GraphControls } from "../src/ui/graph.js";
import { useShortcuts } from "../src/ui/shortcuts.js";

const flow = vi.hoisted(() => ({ zoom: 1, zoomIn: vi.fn(), zoomOut: vi.fn(), fitView: vi.fn() }));
vi.mock("@xyflow/react", async (original) => ({
  ...(await original<typeof import("@xyflow/react")>()),
  useReactFlow: () => flow,
  useViewport: () => ({ zoom: flow.zoom }),
  Panel: ({ children }: { children: ReactNode }) => createElement("div", {}, children),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  flow.zoom = 1;
});

test("graph controls put live zoom between minus and plus and support every key alias", () => {
  const view = render(createElement(GraphControls));
  expect(screen.getByLabelText("Zoom out").nextElementSibling).toBe(
    screen.getByLabelText("Zoom level"),
  );
  expect(screen.getByLabelText("Zoom level").nextElementSibling).toBe(
    screen.getByLabelText("Zoom in"),
  );
  expect(screen.getByLabelText("Zoom level").textContent).toBe("100%");
  flow.zoom = 1.8;
  view.rerender(createElement(GraphControls));
  expect(screen.getByLabelText("Zoom level").textContent).toBe("180%");
  for (const key of ["-", "+", "=", "f", "F", "0"]) fireEvent.keyDown(window, { key });
  expect(flow.zoomOut).toHaveBeenCalledTimes(1);
  expect(flow.zoomIn).toHaveBeenCalledTimes(2);
  expect(flow.fitView).toHaveBeenCalledTimes(3);
  fireEvent.click(screen.getByLabelText("Zoom out"));
  fireEvent.click(screen.getByLabelText("Zoom in"));
  fireEvent.click(screen.getByLabelText("Fit graph"));
  expect(flow.fitView).toHaveBeenCalledTimes(4);
  flow.zoom = 2;
  view.rerender(createElement(GraphControls));
  expect((screen.getByLabelText("Zoom in") as HTMLButtonElement).disabled).toBe(true);
  flow.zoom = 0.08;
  view.rerender(createElement(GraphControls));
  expect((screen.getByLabelText("Zoom out") as HTMLButtonElement).disabled).toBe(true);
});

test("shortcuts preserve typing, composition, browser combinations and dialog interactions", () => {
  const handle = vi.fn(() => true);
  function Harness() {
    useShortcuts(handle);
    return null;
  }
  render(createElement(Harness));
  for (const tag of ["input", "textarea", "select"]) {
    const input = document.createElement(tag);
    document.body.append(input);
    fireEvent.keyDown(input, { key: "r" });
    input.remove();
  }
  const editable = document.createElement("div");
  editable.contentEditable = "true";
  editable.setAttribute("contenteditable", "true");
  document.body.append(editable);
  fireEvent.keyDown(editable, { key: "c" });
  editable.remove();
  for (const modifier of ["ctrlKey", "metaKey", "altKey", "isComposing"])
    fireEvent.keyDown(window, { key: "r", [modifier]: true });
  const dialog = document.createElement("div");
  dialog.setAttribute("role", "dialog");
  document.body.append(dialog);
  fireEvent.keyDown(window, { key: "Escape" });
  dialog.remove();
  expect(handle).not.toHaveBeenCalled();
  const event = new KeyboardEvent("keydown", { key: "R", cancelable: true });
  window.dispatchEvent(event);
  expect(handle).toHaveBeenCalledWith("r", event);
  expect(event.defaultPrevented).toBe(true);
});

test("suspended graph ignores shortcuts", () => {
  render(createElement(GraphControls, { suspended: true }));
  fireEvent.keyDown(window, { key: "+" });
  expect(flow.zoomIn).not.toHaveBeenCalled();
});
