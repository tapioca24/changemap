import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { cpus, platform, arch } from "node:os";
import ts from "typescript-api";
import { analyzeTypeScript } from "../src/analysis/typescript.js";
import { selectNeighborhood } from "../src/graph/select.js";
import { SnapshotSource } from "../src/git/snapshot.js";
import { gitText } from "../src/git/command.js";
import { diffStates } from "../src/git/diff.js";
import type { CapturedState, FileChange } from "../src/shared/review.js";

const size = process.argv[2] ?? "100";
let before: CapturedState;
let after: CapturedState;
let changes: readonly FileChange[];
let captureMs = 0;
if (/^\d+$/.test(size)) {
  const count = Number(size);
  const files: Record<string, string> = {
    "tsconfig.json": '{"compilerOptions":{"module":"NodeNext","moduleResolution":"NodeNext"}}',
  };
  for (let i = 0; i < count; i++) {
    files[`f${i}.ts`] =
      `import type { T } from './f${(i + 1) % count}.js';\nexport type U = T;\nexport interface T { value: number }\nconst target = './f${(i + 2) % count}.js';\nvoid import(target);\n`;
  }
  const state = (): CapturedState => ({
    kind: "worktree",
    label: "synthetic",
    files: Object.fromEntries(
      Object.entries(files).map(([path, content]) => [
        path,
        { mode: "100644", encoding: "utf8", content },
      ]),
    ),
  });
  before = state();
  files["f0.ts"] = files["f0.ts"].replace("f1.js", "f3.js");
  after = state();
  changes = [
    {
      oldPath: "f0.ts",
      newPath: "f0.ts",
      oldMode: "100644",
      newMode: "100644",
      binary: false,
      status: "modified",
      patch: "",
    },
  ];
} else {
  const start = performance.now();
  const source = new SnapshotSource(size, { mode: ".", target: "." });
  ({ before, after } = await source.readInputs());
  changes = await diffStates(
    before,
    after,
    await gitText(size, ["rev-parse", "--show-object-format"]),
  );
  captureMs = Math.round(performance.now() - start);
}
const results = [];
for (let run = 0; run < 2; run++) {
  const start = performance.now();
  const graph = selectNeighborhood(analyzeTypeScript(before), analyzeTypeScript(after), changes);
  const milliseconds = Math.round(performance.now() - start);
  if (/^\d+$/.test(size)) {
    assert.equal(graph.before.edges.length, Number(size) * 2);
    assert.equal(graph.after.edges.length, Number(size) * 2);
    assert.equal(graph.incomplete, false);
    assert.ok(graph.selection.paths.includes("f1.ts"));
    assert.ok(graph.selection.paths.includes("f3.ts"));
  }
  results.push({
    milliseconds,
    nodesPerSide: [graph.before.nodes.length, graph.after.nodes.length],
    edgesPerSide: [graph.before.edges.length, graph.after.edges.length],
    selected: graph.selection.paths.length,
    incomplete: graph.incomplete,
  });
}
console.log(
  JSON.stringify({
    size,
    environment: {
      node: process.version,
      typescript: ts.version,
      platform: platform(),
      arch: arch(),
      cpu: cpus()[0]?.model,
    },
    captureMs,
    bytesPerSide: [before, after].map((state) =>
      Object.values(state.files).reduce((sum, file) => sum + Buffer.byteLength(file.content), 0),
    ),
    results,
    peakRssMiB: Math.round(process.resourceUsage().maxRSS / 1024),
  }),
);
