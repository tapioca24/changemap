// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Position } from "@xyflow/react";
import { DependencyEdge } from "../src/ui/graph.js";

const flow = vi.hoisted(() => ({
  getViewport: vi.fn(() => ({ x: 30, y: 40, zoom: 0.5 })),
  setViewport: vi.fn(async () => true),
}));
vi.mock("@xyflow/react", async (original) => ({
  ...(await original<typeof import("@xyflow/react")>()),
  useReactFlow: () => flow,
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function edge() {
  const { container } = render(
    createElement(
      "svg",
      null,
      createElement(DependencyEdge, {
        id: "test-edge",
        source: "a",
        target: "b",
        sourceX: 0,
        sourceY: 0,
        targetX: 100,
        targetY: 0,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        selected: false,
        selectable: false,
        deletable: false,
        data: {
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
          ],
          direction: "LR",
          sourceFan: 0,
          targetFan: 0,
          bend: 0,
          animate: false,
          muted: false,
        },
      }),
    ),
  );
  const wrapper = container.querySelector("g")!;
  wrapper.setPointerCapture = vi.fn();
  wrapper.releasePointerCapture = vi.fn();
  return { wrapper, path: container.querySelector(".react-flow__edge-interaction")! };
}
// jsdom lacks PointerEvent; preserve pointer identity and coordinates for React's handlers.
function pointer(
  target: Element,
  type: string,
  extra: MouseEventInit & { pointerId?: number; isPrimary?: boolean } = {},
) {
  const { pointerId = 1, isPrimary = true, ...mouse } = extra;
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: 100,
    clientY: 120,
    button: 0,
    ...mouse,
  });
  Object.assign(event, { pointerId, isPrimary });
  fireEvent(target, event);
}

test("dragging the edge hit area pans by screen pixels and preserves zoom", () => {
  const { wrapper, path } = edge();
  pointer(path, "pointerdown");
  expect(wrapper.setPointerCapture).toHaveBeenCalledWith(1);
  pointer(wrapper, "pointermove", { clientX: 180, clientY: 180 });
  expect(flow.setViewport).toHaveBeenLastCalledWith({ x: 110, y: 100, zoom: 0.5 });
  pointer(wrapper, "pointerup");
  expect(wrapper.releasePointerCapture).toHaveBeenCalledWith(1);
  pointer(wrapper, "pointermove", { clientX: 220 });
  expect(flow.setViewport).toHaveBeenCalledTimes(1);
});

test.each(["pointercancel", "lostpointercapture"])("%s ends an edge drag", (type) => {
  const { wrapper, path } = edge();
  pointer(path, "pointerdown");
  pointer(wrapper, type);
  pointer(wrapper, "pointermove", { clientX: 180 });
  expect(flow.setViewport).not.toHaveBeenCalled();
});

test("secondary pointers and right clicks do not start an edge drag", () => {
  const { wrapper, path } = edge();
  pointer(path, "pointerdown", { isPrimary: false });
  pointer(wrapper, "pointermove");
  pointer(path, "pointerdown", { button: 2 });
  pointer(wrapper, "pointermove");
  expect(wrapper.setPointerCapture).not.toHaveBeenCalled();
  expect(flow.setViewport).not.toHaveBeenCalled();
});
