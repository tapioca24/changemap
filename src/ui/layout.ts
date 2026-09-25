import dagre from "@dagrejs/dagre";
import type { Node } from "@xyflow/react";
import type { MergedFileNode, ReviewGraph } from "../graph/model.js";
import type { Settings } from "../shared/settings.js";

export type FileNodeData = {
  file: MergedFileNode;
  unresolved: boolean;
  direction: Settings["orientation"];
  onSelect?: () => void;
};

export type DirectoryNodeData = { path: string; name: string };
export type LayoutNode = Node<FileNodeData, "file"> | Node<DirectoryNodeData, "directory">;

const fileWidth = 230;
const fileHeight = 108;
const directoryId = (path: string) => `directory:${path}`;
const parentPath = (path: string) => {
  const slash = path.lastIndexOf("/");
  return slash < 0 ? null : path.slice(0, slash);
};
type Point = { x: number; y: number };
type Box = { width: number; height: number };

function routeBetween(
  source: { position: Point } & Box,
  target: { position: Point } & Box,
  direction: Settings["orientation"],
): Point[] {
  const horizontal = direction === "LR" || direction === "RL";
  const forward = direction === "LR" || direction === "TB";
  const sourceCenter = {
    x: source.position.x + source.width / 2,
    y: source.position.y + source.height / 2,
  };
  const targetCenter = {
    x: target.position.x + target.width / 2,
    y: target.position.y + target.height / 2,
  };
  if (horizontal) {
    const start = {
      x: sourceCenter.x + ((forward ? 1 : -1) * source.width) / 2,
      y: sourceCenter.y,
    };
    const end = { x: targetCenter.x - ((forward ? 1 : -1) * target.width) / 2, y: targetCenter.y };
    if ((end.x - start.x) * (forward ? 1 : -1) >= 0) {
      const middle = (start.x + end.x) / 2;
      return [start, { x: middle, y: start.y }, { x: middle, y: end.y }, end];
    }
    const outerY = Math.min(source.position.y, target.position.y) - 40;
    return [
      start,
      { x: start.x + (forward ? 35 : -35), y: start.y },
      { x: start.x + (forward ? 35 : -35), y: outerY },
      { x: end.x - (forward ? 35 : -35), y: outerY },
      { x: end.x - (forward ? 35 : -35), y: end.y },
      end,
    ];
  }
  const start = { x: sourceCenter.x, y: sourceCenter.y + ((forward ? 1 : -1) * source.height) / 2 };
  const end = { x: targetCenter.x, y: targetCenter.y - ((forward ? 1 : -1) * target.height) / 2 };
  if ((end.y - start.y) * (forward ? 1 : -1) >= 0) {
    const middle = (start.y + end.y) / 2;
    return [start, { x: start.x, y: middle }, { x: end.x, y: middle }, end];
  }
  const outerX = Math.max(source.position.x + source.width, target.position.x + target.width) + 40;
  return [
    start,
    { x: start.x, y: start.y + (forward ? 35 : -35) },
    { x: outerX, y: start.y + (forward ? 35 : -35) },
    { x: outerX, y: end.y - (forward ? 35 : -35) },
    { x: end.x, y: end.y - (forward ? 35 : -35) },
    end,
  ];
}

export function layoutElements(graph: ReviewGraph, direction: Settings["orientation"]) {
  const files = graph.merged.nodes.filter((node) => node.analyzed.before || node.analyzed.after);
  const directories = new Set<string>();
  for (const file of files) {
    let path = parentPath(file.newPath ?? file.oldPath!);
    while (path !== null) {
      directories.add(path);
      path = parentPath(path);
    }
  }
  const paths = [...directories].sort((a, b) => {
    const depth = (path: string) => path.split("/").length;
    return depth(a) - depth(b) || a.localeCompare(b);
  });

  const children = new Map<string | null, string[]>();
  const addChild = (parent: string | null, id: string) => {
    const siblings = children.get(parent) ?? [];
    siblings.push(id);
    children.set(parent, siblings);
  };
  for (const path of paths) {
    addChild(parentPath(path), directoryId(path));
  }
  const fileDirectories = new Map<string, string | null>();
  const boxes = new Map<string, Box>();
  for (const file of files) {
    const parent = parentPath(file.newPath ?? file.oldPath!);
    fileDirectories.set(file.id, parent);
    boxes.set(file.id, { width: fileWidth, height: fileHeight });
    addChild(parent, file.id);
  }
  const directChild = (container: string | null, fileId: string) => {
    const directory = fileDirectories.get(fileId);
    if (directory === undefined) return null;
    if (container === null) {
      return directory === null ? fileId : directoryId(directory.split("/")[0]);
    }
    if (directory === container) return fileId;
    if (directory === null || !directory.startsWith(`${container}/`)) return null;
    return directoryId(`${container}/${directory.slice(container.length + 1).split("/")[0]}`);
  };
  const relative = new Map<string, Point>();
  const localRoutes = new Map<number, { container: string | null; points: Point[] }>();
  const containers: (string | null)[] = [...paths].reverse();
  containers.push(null);
  for (const container of containers) {
    const layout = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
    layout.setGraph({
      rankdir: direction,
      ranksep: 110,
      nodesep: 45,
      marginx: container === null ? 35 : 24,
      marginy: container === null ? 35 : 36,
    });
    for (const id of children.get(container) ?? []) layout.setNode(id, boxes.get(id)!);
    const directEdges: number[] = [];
    graph.merged.edges.forEach((edge, index) => {
      const source = directChild(container, edge.source);
      const target = directChild(container, edge.target);
      if (source === null || target === null || source === target) return;
      layout.setEdge(source, target);
      if (source === edge.source && target === edge.target) directEdges.push(index);
    });
    dagre.layout(layout);
    for (const id of children.get(container) ?? []) {
      const node = layout.node(id);
      relative.set(id, { x: node.x - node.width / 2, y: node.y - node.height / 2 });
    }
    for (const index of directEdges) {
      const edge = graph.merged.edges[index];
      localRoutes.set(index, {
        container,
        points: layout.edge(edge.source, edge.target).points,
      });
    }
    if (container !== null) {
      boxes.set(directoryId(container), {
        width: layout.graph().width,
        height: layout.graph().height,
      });
    }
  }
  const absolute = new Map<string, Point>();
  for (const container of [null, ...paths]) {
    const origin = container === null ? { x: 0, y: 0 } : absolute.get(directoryId(container))!;
    for (const id of children.get(container) ?? []) {
      const position = relative.get(id)!;
      absolute.set(id, { x: origin.x + position.x, y: origin.y + position.y });
    }
  }
  const fileBounds = new Map<string, { position: Point } & Box>();
  for (const file of files) {
    fileBounds.set(file.id, {
      position: absolute.get(file.id)!,
      width: fileWidth,
      height: fileHeight,
    });
  }
  const routes = graph.merged.edges.map((edge, index) => {
    const local = localRoutes.get(index);
    if (local) {
      const origin =
        local.container === null ? { x: 0, y: 0 } : absolute.get(directoryId(local.container))!;
      return local.points.map((point) => ({ x: point.x + origin.x, y: point.y + origin.y }));
    }
    return routeBetween(fileBounds.get(edge.source)!, fileBounds.get(edge.target)!, direction);
  });

  const directoryNodes: LayoutNode[] = paths.map((path) => {
    const id = directoryId(path);
    const parent = parentPath(path);
    const box = boxes.get(id)!;
    return {
      id,
      type: "directory",
      parentId: parent === null ? undefined : directoryId(parent),
      position: relative.get(id)!,
      data: { path, name: path.slice(path.lastIndexOf("/") + 1) },
      ariaLabel: `Directory ${path}`,
      selectable: false,
      focusable: false,
      width: box.width,
      height: box.height,
      style: { width: box.width, height: box.height },
    };
  });

  const unresolved = {
    before: new Set(
      graph.before.references
        .filter((ref) => ref.outcome === "unresolved")
        .map((ref) => ref.source),
    ),
    after: new Set(
      graph.after.references.filter((ref) => ref.outcome === "unresolved").map((ref) => ref.source),
    ),
  };
  const fileNodes: LayoutNode[] = files.map((file) => {
    const path = file.newPath ?? file.oldPath!;
    const parent = parentPath(path);
    return {
      id: file.id,
      type: "file",
      parentId: parent === null ? undefined : directoryId(parent),
      position: relative.get(file.id)!,
      data: {
        file,
        direction,
        unresolved:
          (file.oldPath !== null && unresolved.before.has(file.oldPath)) ||
          (file.newPath !== null && unresolved.after.has(file.newPath)),
      },
      ariaLabel: `${path}, ${file.status}`,
      width: fileWidth,
      height: fileHeight,
    };
  });
  return { nodes: [...directoryNodes, ...fileNodes], routes, fileBounds };
}

export function layoutGraph(graph: ReviewGraph, direction: Settings["orientation"]) {
  return layoutElements(graph, direction).nodes;
}
