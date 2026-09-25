import { expect, test } from "vitest";
import { edgeFans, edgePath } from "../src/ui/edge-path.js";

test.each(["LR", "RL", "TB", "BT"] as const)(
  "%s dependency route is curved and keeps its endpoints",
  (direction) => {
    const horizontal = direction === "LR" || direction === "RL";
    const forward = direction === "LR" || direction === "TB";
    const points = horizontal
      ? [
          { x: forward ? 0 : 180, y: 20 },
          { x: forward ? 80 : 100, y: 20 },
          { x: forward ? 80 : 100, y: 120 },
          { x: forward ? 180 : 0, y: 120 },
        ]
      : [
          { x: 20, y: forward ? 0 : 180 },
          { x: 20, y: forward ? 80 : 100 },
          { x: 120, y: forward ? 80 : 100 },
          { x: 120, y: forward ? 180 : 0 },
        ];
    const { path, bounds } = edgePath(points, direction, 0, 0);
    expect(path.startsWith(`M ${points[0].x},${points[0].y} C `)).toBe(true);
    expect(path).toContain(" C ");
    expect(path.endsWith(`${points.at(-1)!.x},${points.at(-1)!.y}`)).toBe(true);
    expect(path).not.toMatch(/NaN|Infinity/);
    expect(bounds.x).toBeLessThan(Math.min(...points.map((point) => point.x)));
    expect(bounds.y).toBeLessThan(Math.min(...points.map((point) => point.y)));
  },
);

test("parallel connections fan out without changing the arrow endpoints", () => {
  const points = [
    { x: 0, y: 20 },
    { x: 100, y: 20 },
    { x: 100, y: 120 },
    { x: 200, y: 120 },
  ];
  const upper = edgePath(points, "LR", -24, -12);
  const lower = edgePath(points, "LR", 24, 12);
  expect(upper.path).not.toBe(lower.path);
  expect(upper.path.startsWith("M 0,20")).toBe(true);
  expect(lower.path.startsWith("M 0,20")).toBe(true);
  expect(upper.path.endsWith("200,120")).toBe(true);
  expect(lower.path.endsWith("200,120")).toBe(true);
  expect(upper.labelY).toBeLessThan(lower.labelY);
});

test("return dependency bends outside the node row and still enters the target forward", () => {
  const result = edgePath(
    [
      { x: 240, y: 50 },
      { x: 300, y: 50 },
      { x: 300, y: -60 },
      { x: 20, y: -60 },
      { x: 20, y: 50 },
      { x: 80, y: 50 },
    ],
    "LR",
    0,
    0,
  );
  expect(result.path.match(/ C /g)).toHaveLength(2);
  expect(result.labelY).toBeLessThan(-60);
  expect(result.path.endsWith("80,50")).toBe(true);
});

test("a high degree node gets distinct, bounded fan offsets", () => {
  const edges = Array.from({ length: 40 }, (_, index) => ({
    source: "hub",
    target: `file-${index}`,
  }));
  const bounds = new Map(
    edges.map((edge, index) => [
      edge.target,
      { position: { x: 300, y: index * 120 }, width: 230, height: 108 },
    ]),
  );
  const fans = edgeFans(edges, bounds, "LR");
  expect(new Set(fans.source).size).toBe(edges.length);
  expect(Math.min(...fans.source)).toBe(-72);
  expect(Math.max(...fans.source)).toBe(72);
});
