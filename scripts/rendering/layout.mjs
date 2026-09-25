import assert from "node:assert/strict";
import { layoutElements } from "../../src/ui/layout.ts";
import { renderingFixture } from "./fixture.mjs";
const size = Number(process.argv[2] ?? 1000);
const shape = process.argv[3] ?? "layered";
const fixture = renderingFixture(size, shape);
const start = performance.now();
try {
  const result = layoutElements(fixture.graph, "LR");
  const fileNodes = result.nodes.filter((node) => node.type === "file");
  const directoryNodes = result.nodes.filter((node) => node.type === "directory");
  const expectedDirectories = new Set();
  for (const change of fixture.changes) {
    const parts = change.newPath.split("/");
    for (let depth = 1; depth < parts.length; depth++)
      expectedDirectories.add(parts.slice(0, depth).join("/"));
  }
  assert.equal(fileNodes.length, size);
  assert.equal(directoryNodes.length, expectedDirectories.size);
  assert.equal(result.routes.length, fixture.graph.merged.edges.length);
  assert.ok(
    result.nodes.every(
      (node) => Number.isFinite(node.position.x) && Number.isFinite(node.position.y),
    ),
  );
  assert.ok(
    result.routes.every(
      (route) =>
        route.length > 0 &&
        route.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
    ),
  );
  console.log(
    JSON.stringify({
      size,
      shape,
      nodes: fileNodes.length,
      directories: directoryNodes.length,
      routes: result.routes.length,
      layoutMs: performance.now() - start,
      maxRssMiB: process.resourceUsage().maxRSS / 1024,
    }),
  );
} catch (error) {
  console.log(
    JSON.stringify({
      size,
      shape,
      layoutMs: performance.now() - start,
      failure: String(error),
      maxRssMiB: process.resourceUsage().maxRSS / 1024,
    }),
  );
  process.exitCode = 1;
}
