import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  MarkerType,
  BaseEdge,
  type EdgeProps,
  type Edge,
  type NodeProps,
  type Node,
} from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import type { MergedFileNode, ReviewGraph } from "../graph/model.js";
import type { Settings } from "../shared/settings.js";
import "@xyflow/react/dist/style.css";

export const statusLabels = {
  added: "+ Added",
  modified: "~ Modified",
  deleted: "− Deleted",
  renamed: "↗ Renamed",
  unchanged: "· Unchanged",
};
export function references(graph: ReviewGraph, node: MergedFileNode) {
  return (["before", "after"] as const).flatMap((side) =>
    graph[side].references
      .filter(
        (ref) =>
          ref.source === (side === "before" ? node.oldPath : node.newPath) &&
          ref.outcome !== "resolved",
      )
      .map((ref) => ({ ...ref, side })),
  );
}
type FileData = {
  file: MergedFileNode;
  unresolved: boolean;
  direction: Settings["orientation"];
  onSelect?: () => void;
};
function FileNode({ data }: NodeProps<Node<FileData>>) {
  const source = { LR: Position.Right, RL: Position.Left, TB: Position.Bottom, BT: Position.Top }[
    data.direction
  ];
  const target = { LR: Position.Left, RL: Position.Right, TB: Position.Top, BT: Position.Bottom }[
    data.direction
  ];
  const path = data.file.newPath ?? data.file.oldPath!;
  return (
    <div
      className={`file-node ${data.file.status}`}
      role="button"
      tabIndex={0}
      aria-label={`Open ${data.file.newPath ?? data.file.oldPath}`}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          data.onSelect?.();
        }
      }}
    >
      <Handle type="target" position={target} />
      <span className="node-status">{statusLabels[data.file.status]}</span>
      <strong title={path}>{path.split("/").pop()}</strong>
      <small title={path}>{path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "/"}</small>
      {data.unresolved && <span className="unresolved">! Unresolved references</span>}
      <Handle type="source" position={source} />
    </div>
  );
}
const nodeTypes = { file: FileNode };
export function layoutElements(graph: ReviewGraph, direction: Settings["orientation"]) {
  const files = graph.merged.nodes.filter((n) => n.analyzed.before || n.analyzed.after);
  const layout = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  layout.setGraph({ rankdir: direction, ranksep: 110, nodesep: 45, marginx: 35, marginy: 35 });
  for (const file of files) layout.setNode(file.id, { width: 230, height: 108 });
  for (const edge of graph.merged.edges) layout.setEdge(edge.source, edge.target);
  dagre.layout(layout);
  const nodes = files.map((file) => ({
    id: file.id,
    type: "file",
    position: { x: layout.node(file.id).x - 115, y: layout.node(file.id).y - 54 },
    data: {
      file,
      direction,
      unresolved: references(graph, file).some((ref) => ref.outcome === "unresolved"),
    },
    ariaLabel: `${file.newPath ?? file.oldPath}, ${file.status}`,
    width: 230,
    height: 108,
  }));
  const routes = graph.merged.edges.map((edge) => layout.edge(edge.source, edge.target).points);
  return { nodes, routes };
}
export function layoutGraph(graph: ReviewGraph, direction: Settings["orientation"]) {
  return layoutElements(graph, direction).nodes;
}
function DependencyEdge({
  id,
  data,
  label,
  markerEnd,
  style,
}: EdgeProps<Edge<{ points: { x: number; y: number }[] }>>) {
  const points = data!.points;
  const middle = points[Math.floor(points.length / 2)];
  return (
    <BaseEdge
      id={id}
      path={points.map((point, i) => `${i ? "L" : "M"} ${point.x},${point.y}`).join(" ")}
      markerEnd={markerEnd}
      style={{ ...style, strokeLinejoin: "round" }}
      label={label}
      labelX={middle.x}
      labelY={middle.y}
      labelStyle={{ fill: "var(--text)", fontSize: 10 }}
      labelBgStyle={{ fill: "var(--base)" }}
    />
  );
}
const edgeTypes = { dependency: DependencyEdge };
export function Graph({
  graph,
  direction,
  selected,
  onSelect,
}: {
  graph: ReviewGraph;
  direction: Settings["orientation"];
  selected: string | null;
  onSelect(id: string): void;
}) {
  const { nodes, routes } = useMemo(() => layoutElements(graph, direction), [graph, direction]);
  const edges = useMemo(
    () =>
      graph.merged.edges.map((edge, i) => ({
        ...edge,
        id: `edge-${i}`,
        type: "dependency",
        data: { points: routes[i] },
        label:
          edge.status === "unchanged"
            ? undefined
            : edge.status === "added"
              ? "+ added"
              : "− deleted",
        className: `edge-${edge.status}`,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: `var(--${edge.status === "added" ? "green" : edge.status === "deleted" ? "red" : "overlay1"})`,
        },
        style: {
          stroke: `var(--${edge.status === "added" ? "green" : edge.status === "deleted" ? "red" : "overlay1"})`,
          strokeWidth: 2,
          strokeDasharray: edge.status === "deleted" ? "6 4" : undefined,
        },
      })),
    [graph, routes],
  );
  return (
    <div className="graph-canvas" aria-label="File dependency graph">
      <ReactFlow
        key={direction}
        nodes={nodes.map((node) => ({
          ...node,
          data: { ...node.data, onSelect: () => onSelect(node.id) },
          selected: node.id === selected,
        }))}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        onNodeClick={(_, node) => onSelect(node.id)}
        fitView
        minZoom={0.08}
        maxZoom={2}
      >
        <Background color="var(--surface1)" gap={22} />
        <Controls showInteractive={false} />
      </ReactFlow>
      {!nodes.length && <p className="canvas-empty">No analyzed files in this comparison.</p>}
    </div>
  );
}
