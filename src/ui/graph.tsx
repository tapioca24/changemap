import { memo, useCallback, useMemo, useEffect, useState, type CSSProperties } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  MarkerType,
  BaseEdge,
  useReactFlow,
  useStore,
  type EdgeProps,
  type Edge,
  type NodeProps,
  type Node,
} from "@xyflow/react";
import { layoutElements, type DirectoryNodeData, type FileNodeData } from "./layout.js";
import { edgeAppearance, edgeFans, edgePath } from "./edge-path.js";
import { revealNode } from "./viewport.js";
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
const FileNode = memo(function FileNode({ data }: NodeProps<Node<FileNodeData>>) {
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
      {data.unresolved && <span className="unresolved">! Unresolved references</span>}
      <Handle type="source" position={source} />
    </div>
  );
});
const DirectoryNode = memo(function DirectoryNode({ data }: NodeProps<Node<DirectoryNodeData>>) {
  return (
    <div className="directory-node" title={data.path}>
      <span className="directory-name">{data.name}</span>
    </div>
  );
});
const nodeTypes = { file: FileNode, directory: DirectoryNode };
function DependencyEdge({
  id,
  data,
  label,
  markerEnd,
  style,
}: EdgeProps<
  Edge<{
    points: { x: number; y: number }[];
    direction: Settings["orientation"];
    sourceFan: number;
    targetFan: number;
    bend: number;
    animate: boolean;
    muted: boolean;
  }>
>) {
  const { path, bounds, labelX, labelY } = edgePath(
    data!.points,
    data!.direction,
    data!.sourceFan,
    data!.targetFan,
    data!.bend,
  );
  const fadeId = `edge-dots-fade-${id}`;
  const gradientId = `edge-dots-gradient-${id}`;
  const start = data!.points[0];
  const end = data!.points.at(-1)!;
  const horizontal = data!.direction === "LR" || data!.direction === "RL";
  const span = Math.abs(horizontal ? end.x - start.x : end.y - start.y);
  const forward =
    (horizontal ? end.x - start.x : end.y - start.y) *
      (data!.direction === "LR" || data!.direction === "TB" ? 1 : -1) >=
    0;
  const linearFade = forward && span > edgeAppearance.fadeDistance * 4;
  const fadeOffset = `${(edgeAppearance.fadeDistance / span) * 100}%`;
  return (
    <>
      {data!.animate && (
        <path
          d={path}
          className="edge-glow"
          fill="none"
          stroke={style?.stroke}
          strokeWidth={8}
          strokeLinecap="round"
          aria-hidden="true"
          pointerEvents="none"
        />
      )}
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={style}
        label={label}
        labelX={labelX}
        labelY={labelY}
        labelStyle={{
          fill: "var(--text)",
          fontSize: 10,
          fillOpacity: data!.muted ? edgeAppearance.mutedOpacity : 1,
        }}
        labelBgStyle={{
          fill: "var(--base)",
          fillOpacity: data!.muted ? edgeAppearance.mutedOpacity : 1,
        }}
      />
      {data!.animate && (
        <>
          <defs>
            {linearFade ? (
              <linearGradient
                id={gradientId}
                gradientUnits="userSpaceOnUse"
                x1={horizontal ? start.x : 0}
                y1={horizontal ? 0 : start.y}
                x2={horizontal ? end.x : 0}
                y2={horizontal ? 0 : end.y}
              >
                <stop offset="0" stopColor={style?.stroke} stopOpacity="0" />
                <stop offset={fadeOffset} stopColor={style?.stroke} />
                <stop
                  offset={`${100 - (edgeAppearance.fadeDistance / span) * 100}%`}
                  stopColor={style?.stroke}
                />
                <stop offset="1" stopColor={style?.stroke} stopOpacity="0" />
              </linearGradient>
            ) : (
              <>
                <radialGradient id={gradientId}>
                  <stop offset="0" stopColor="black" />
                  <stop offset="1" stopColor="white" />
                </radialGradient>
                <mask id={fadeId} maskUnits="userSpaceOnUse" {...bounds}>
                  <path
                    d={path}
                    fill="none"
                    stroke="white"
                    strokeWidth={edgeAppearance.dotDiameter + 1}
                    strokeLinecap="round"
                  />
                  <circle
                    cx={start.x}
                    cy={start.y}
                    r={edgeAppearance.fadeDistance}
                    fill={`url(#${gradientId})`}
                  />
                  <circle
                    cx={end.x}
                    cy={end.y}
                    r={edgeAppearance.fadeDistance}
                    fill={`url(#${gradientId})`}
                  />
                </mask>
              </>
            )}
          </defs>
          <path
            d={path}
            className="edge-dots"
            fill="none"
            stroke={linearFade ? `url(#${gradientId})` : style?.stroke}
            strokeWidth={edgeAppearance.dotDiameter}
            strokeLinecap="round"
            strokeDasharray={`0 ${edgeAppearance.dotSpacing}`}
            mask={linearFade ? undefined : `url(#${fadeId})`}
            style={
              {
                animationDuration: `${edgeAppearance.dotSpacing / edgeAppearance.dotSpeed}s`,
                "--edge-dot-spacing": `${edgeAppearance.dotSpacing}px`,
              } as CSSProperties
            }
            aria-hidden="true"
            pointerEvents="none"
          />
        </>
      )}
    </>
  );
}
const edgeTypes = { dependency: DependencyEdge };

function RevealSelection({
  node,
  resizing,
  suspended,
}: {
  node: { position: { x: number; y: number }; width: number; height: number } | undefined;
  resizing: boolean;
  suspended: boolean;
}) {
  const flow = useReactFlow();
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  useEffect(() => {
    if (!flow.viewportInitialized) return;
    if (resizing || suspended) {
      // Stop an in-flight reveal before a new drag or a switch to the narrow code view.
      void flow.setViewport(flow.getViewport(), { duration: 0 });
      return;
    }
    if (!node || !width || !height) return;
    const frame = requestAnimationFrame(() => {
      const current = flow.getViewport();
      const next = revealNode(
        current,
        { ...node.position, width: node.width, height: node.height },
        { width, height },
      );
      if (next.x !== current.x || next.y !== current.y) {
        void flow.setViewport(next, {
          interpolate: "linear",
          duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 240,
        });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [node, resizing, suspended, width, height, flow]);
  return null;
}

export const Graph = memo(function Graph({
  graph,
  direction,
  selected,
  onSelect,
  resizing = false,
  suspended = false,
}: {
  graph: ReviewGraph;
  direction: Settings["orientation"];
  selected: string | null;
  onSelect(id: string): void;
  resizing?: boolean;
  suspended?: boolean;
}) {
  const [hovered, setHovered] = useState<{
    graph: ReviewGraph;
    direction: Settings["orientation"];
    kind: "edge" | "node";
    id: string;
  } | null>(null);
  const { nodes, routes, fileBounds, failed } = useMemo(() => {
    try {
      return { ...layoutElements(graph, direction), failed: false };
    } catch {
      return { nodes: [], routes: [], fileBounds: new Map(), failed: true };
    }
  }, [graph, direction]);
  const selectableNodes = useMemo(
    () =>
      nodes.map((node) =>
        node.type === "file"
          ? {
              ...node,
              data: { ...node.data, onSelect: () => onSelect(node.id) },
              selected: false,
            }
          : node,
      ),
    [nodes, onSelect],
  );
  const displayedNodes = useMemo(
    () =>
      selectableNodes.map((node) => (node.id === selected ? { ...node, selected: true } : node)),
    [selectableNodes, selected],
  );
  const onNodeClick = useCallback(
    (_: unknown, node: { id: string; type?: string }) => {
      if (node.type === "file") onSelect(node.id);
    },
    [onSelect],
  );
  const focus = hovered?.graph === graph && hovered.direction === direction ? hovered : null;
  const sourceFans = useMemo(
    () => edgeFans(graph.merged.edges, fileBounds, direction),
    [graph, direction, fileBounds],
  );
  const edges = useMemo(
    () =>
      graph.merged.edges.map((edge, i) => {
        const active =
          focus?.kind === "edge"
            ? focus.id === `edge-${i}`
            : focus?.kind === "node"
              ? edge.source === focus.id || edge.target === focus.id
              : selected !== null && (edge.source === selected || edge.target === selected);
        const muted = (focus !== null || selected !== null) && !active;
        const baseColor = `var(--${edge.status === "added" ? "green" : edge.status === "deleted" ? "red" : "overlay1"})`;
        // Alpha on each paint avoids compositing a large translucent SVG group.
        // Share the color with the marker so arrowheads fade with their lines.
        const color = muted
          ? `color-mix(in srgb, ${baseColor} ${edgeAppearance.mutedOpacity * 100}%, transparent)`
          : baseColor;
        return {
          ...edge,
          id: `edge-${i}`,
          type: "dependency",
          data: {
            points: routes[i],
            direction,
            sourceFan: sourceFans.source[i],
            targetFan: sourceFans.target[i],
            bend: i % 2 === 0 ? 12 : -12,
            animate: active,
            muted,
          },
          label:
            edge.status === "unchanged"
              ? undefined
              : edge.status === "added"
                ? "+ added"
                : "− deleted",
          className: `edge-${edge.status}${active ? " edge-active" : muted ? " edge-muted" : ""}`,
          zIndex: active ? 10 : 0,
          markerEnd: { type: MarkerType.ArrowClosed, color },
          style: {
            stroke: color,
            strokeWidth: active ? edgeAppearance.activeWidth : edgeAppearance.normalWidth,
            strokeLinecap: "round" as const,
            strokeDasharray: edge.status === "deleted" ? "6 4" : undefined,
          },
        };
      }),
    [graph, routes, direction, sourceFans, focus, selected],
  );
  if (failed) {
    return (
      <div className="notice" role="alert">
        <p>The dependency map could not be displayed. Choose a file to review its captured code.</p>
        <label>
          File
          <select
            aria-label="File to review"
            value={selected ?? ""}
            onChange={(event) => {
              if (event.target.value) onSelect(event.target.value);
            }}
          >
            <option value="">Select a file</option>
            {graph.merged.nodes
              .filter((node) => node.analyzed.before || node.analyzed.after)
              .map((node) => (
                <option key={node.id} value={node.id}>
                  {statusLabels[node.status]} · {node.newPath ?? node.oldPath}
                </option>
              ))}
          </select>
        </label>
      </div>
    );
  }
  return (
    <div className="graph-canvas" aria-label="File dependency graph">
      <ReactFlow
        key={direction}
        nodes={displayedNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={(_, node) => {
          if (node.type === "file") setHovered({ graph, direction, kind: "node", id: node.id });
        }}
        onNodeMouseLeave={(_, node) => {
          setHovered((current) =>
            current?.kind === "node" && current.id === node.id ? null : current,
          );
        }}
        onEdgeMouseEnter={(_, edge) => setHovered({ graph, direction, kind: "edge", id: edge.id })}
        onEdgeMouseLeave={(_, edge) => {
          setHovered((current) =>
            current?.kind === "edge" && current.id === edge.id ? null : current,
          );
        }}
        fitView
        minZoom={0.08}
        maxZoom={2}
      >
        <RevealSelection
          node={selected === null ? undefined : fileBounds.get(selected)}
          resizing={resizing}
          suspended={suspended}
        />
        <Background color="var(--surface1)" gap={22} />
        <Controls showInteractive={false} />
      </ReactFlow>
      {!nodes.length && <p className="canvas-empty">No analyzed files in this comparison.</p>}
    </div>
  );
});
