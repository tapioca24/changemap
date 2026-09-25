import type { Settings } from "../shared/settings.js";

type Point = { x: number; y: number };
type FileBounds = { position: Point; width: number; height: number };

export const edgeAppearance = {
  normalWidth: 2,
  activeWidth: 2,
  mutedOpacity: 0.12,
  dotDiameter: 5,
  dotSpacing: 120,
  dotSpeed: 80,
  fadeDistance: 10,
} as const;

function pathBounds(points: Point[]) {
  const padding = edgeAppearance.fadeDistance + edgeAppearance.dotDiameter / 2;
  const x = Math.min(...points.map((point) => point.x)) - padding;
  const y = Math.min(...points.map((point) => point.y)) - padding;
  return {
    x,
    y,
    width: Math.max(...points.map((point) => point.x)) - x + padding,
    height: Math.max(...points.map((point) => point.y)) - y + padding,
  };
}

export function edgeFans(
  edges: readonly { source: string; target: string }[],
  bounds: ReadonlyMap<string, FileBounds>,
  direction: Settings["orientation"],
) {
  const source = Array.from<number>({ length: edges.length }).fill(0);
  const target = Array.from<number>({ length: edges.length }).fill(0);
  const horizontal = direction === "LR" || direction === "RL";
  const coordinate = (id: string) => {
    const box = bounds.get(id);
    if (!box) return 0;
    return horizontal ? box.position.y + box.height / 2 : box.position.x + box.width / 2;
  };
  for (const side of ["source", "target"] as const) {
    const groups = new Map<string, number[]>();
    edges.forEach((edge, index) => {
      const group = groups.get(edge[side]) ?? [];
      group.push(index);
      groups.set(edge[side], group);
    });
    for (const group of groups.values()) {
      group.sort(
        (a, b) =>
          coordinate(edges[a][side === "source" ? "target" : "source"]) -
            coordinate(edges[b][side === "source" ? "target" : "source"]) || a - b,
      );
      const spacing = Math.min(12, 144 / Math.max(1, group.length - 1));
      group.forEach((index, rank) => {
        (side === "source" ? source : target)[index] = (rank - (group.length - 1) / 2) * spacing;
      });
    }
  }
  return { source, target };
}

/** Keep each file endpoint fixed while curving forward edges and routing return edges outside. */
export function edgePath(
  points: readonly Point[],
  direction: Settings["orientation"],
  sourceFan: number,
  targetFan: number,
  bend = 12,
) {
  const horizontal = direction === "LR" || direction === "RL";
  const sign = direction === "LR" || direction === "TB" ? 1 : -1;
  const start = points[0];
  const end = points.at(-1)!;
  const axis = (point: Point) => (horizontal ? point.x : point.y);
  const normal = (point: Point) => (horizontal ? point.y : point.x);
  const point = (along: number, across: number): Point =>
    horizontal ? { x: along, y: across } : { x: across, y: along };
  const command = (location: Point) => `${location.x},${location.y}`;
  const span = (axis(end) - axis(start)) * sign;
  if (span >= 0) {
    const reach = Math.min(140, Math.max(12, span * 0.45));
    const control1 = point(axis(start) + sign * reach, normal(start) + sourceFan + bend);
    const control2 = point(axis(end) - sign * reach, normal(end) + targetFan + bend);
    return {
      path: `M ${command(start)} C ${command(control1)} ${command(control2)} ${command(end)}`,
      bounds: pathBounds([start, control1, control2, end]),
      labelX: (start.x + end.x) / 2 + (horizontal ? 0 : (sourceFan + targetFan) / 2 + bend),
      labelY: (start.y + end.y) / 2 + (horizontal ? (sourceFan + targetFan) / 2 + bend : 0),
    };
  }

  const lane = 24 + Math.abs(sourceFan + targetFan) / 4 + bend + 12;
  const outside = horizontal
    ? Math.min(...points.map((entry) => entry.y)) - lane
    : Math.max(...points.map((entry) => entry.x)) + lane;
  const exit = axis(start) + sign * 44;
  const entry = axis(end) - sign * 44;
  const middle = point((exit + entry) / 2, outside);
  const firstControl = point(exit, normal(start) + sourceFan);
  const secondControl = point(exit, outside);
  const thirdControl = point(entry, outside);
  const fourthControl = point(entry, normal(end) + targetFan);
  return {
    path: `M ${command(start)} C ${command(firstControl)} ${command(secondControl)} ${command(middle)} C ${command(thirdControl)} ${command(fourthControl)} ${command(end)}`,
    bounds: pathBounds([
      start,
      firstControl,
      secondControl,
      middle,
      thirdControl,
      fourthControl,
      end,
    ]),
    labelX: middle.x,
    labelY: middle.y,
  };
}
