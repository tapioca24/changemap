import assert from "node:assert/strict";
import { layoutElements } from "../../src/ui/layout.ts";
import { renderingFixture } from "./fixture.mjs";
const size = Number(process.argv[2] ?? 1000);
const shape = process.argv[3] ?? "layered";
const fixture = renderingFixture(size, shape);
const start = performance.now();
try {
  const result = layoutElements(fixture.graph, "LR");
  assert.equal(result.nodes.length, size);
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
      nodes: result.nodes.length,
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
