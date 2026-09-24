import { expect, test } from "vitest";
import { revealNode } from "../src/ui/viewport.js";

test("visible nodes do not move the viewport", () => {
  const view = { x: 40, y: 30, zoom: 0.8 };
  expect(
    revealNode(view, { x: 200, y: 100, width: 230, height: 108 }, { width: 800, height: 600 }),
  ).toEqual(view);
});

test("a narrowed canvas reveals the selected node with the smallest translation and keeps zoom", () => {
  const view = { x: 0, y: 0, zoom: 1.5 };
  const node = { x: 400, y: 100, width: 230, height: 108 };
  const size = { width: 700, height: 600 };
  const next = revealNode(view, node, size);
  expect(next).toEqual({ x: -269, y: 0, zoom: 1.5 });
  expect(revealNode(next, node, size)).toEqual(next);
});

test("offscreen top and left nodes return within the margin without changing zoom", () => {
  expect(
    revealNode(
      { x: -400, y: -200, zoom: 1 },
      { x: 0, y: 0, width: 230, height: 108 },
      { width: 700, height: 600 },
    ),
  ).toEqual({ x: 24, y: 24, zoom: 1 });
});

test("a node larger than the canvas is centered without forcing a zoom-out", () => {
  expect(
    revealNode(
      { x: 0, y: 0, zoom: 2 },
      { x: 0, y: 0, width: 230, height: 108 },
      { width: 300, height: 200 },
    ),
  ).toEqual({ x: -80, y: -8, zoom: 2 });
});
