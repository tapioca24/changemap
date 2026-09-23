import dagre from "@dagrejs/dagre";
import type { ReviewGraph } from "../graph/model.js";
import type { Settings } from "../shared/settings.js";

export function layoutElements(graph: ReviewGraph, direction: Settings["orientation"]) {
  const files = graph.merged.nodes.filter((n) => n.analyzed.before || n.analyzed.after);
  const layout = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  layout.setGraph({ rankdir: direction, ranksep: 110, nodesep: 45, marginx: 35, marginy: 35 });
  for (const file of files) layout.setNode(file.id, { width: 230, height: 108 });
  for (const edge of graph.merged.edges) layout.setEdge(edge.source, edge.target);
  dagre.layout(layout);
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
  const nodes = files.map((file) => ({
    id: file.id,
    type: "file",
    position: { x: layout.node(file.id).x - 115, y: layout.node(file.id).y - 54 },
    data: {
      file,
      direction,
      unresolved:
        (file.oldPath !== null && unresolved.before.has(file.oldPath)) ||
        (file.newPath !== null && unresolved.after.has(file.newPath)),
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
