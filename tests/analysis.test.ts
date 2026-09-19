import { describe, expect, test, vi } from "vitest";
import * as analysis from "../src/analysis/typescript.js";
import { analyzeTypeScript } from "../src/analysis/typescript.js";
import { selectNeighborhood } from "../src/graph/select.js";
import { SnapshotSource } from "../src/git/snapshot.js";
import { ReviewSession } from "../src/review/session.js";
import type { CapturedState, FileChange } from "../src/shared/review.js";
import { repository } from "./helpers/repository.js";

function state(files: Record<string, string>): CapturedState {
  return {
    kind: "worktree",
    label: "fixture",
    files: Object.fromEntries(
      Object.entries(files).map(([path, content]) => [
        path,
        { mode: "100644", encoding: "utf8", content },
      ]),
    ),
  };
}
const analyze = (files: Record<string, string>) => analyzeTypeScript(state(files));
const edgeNames = (graph: ReturnType<typeof analyze>) =>
  graph.edges.map(({ source, target }) => `${source}->${target}`);
function change(oldPath: string | null, newPath: string | null): FileChange {
  return {
    oldPath,
    newPath,
    status:
      oldPath === null
        ? "added"
        : newPath === null
          ? "deleted"
          : oldPath === newPath
            ? "modified"
            : "renamed",
    oldMode: oldPath ? "100644" : null,
    newMode: newPath ? "100644" : null,
    binary: false,
    patch: "",
  };
}

describe("captured TypeScript analysis", () => {
  test("deduplicates imports, type imports, re-exports, import types and import-equals", () => {
    const graph = analyze({
      "a.ts": `import './b.js'; import type { B } from './b.js'; export { b } from './b.js'; export type { B } from './b.js'; type T = import('./b.js').B; import b = require('./b.js');`,
      "b.ts": "export const b = 1; export interface B {}",
    });
    expect(edgeNames(graph)).toEqual(["a.ts->b.ts"]);
    expect(graph.references).toHaveLength(6);
    expect(graph.references.every((ref) => ref.outcome === "resolved")).toBe(true);
    expect(graph.diagnostics).toEqual([]);
  });

  test("supports every TS extension and keeps JavaScript, binary and symlinks outside analysis", () => {
    const input = state(
      Object.fromEntries(
        [
          "a.ts",
          "b.tsx",
          "c.mts",
          "d.cts",
          "e.d.ts",
          "f.d.mts",
          "g.d.cts",
          "h.js",
          "i.jsx",
          "j.mjs",
          "k.cjs",
          "node_modules/pkg/a.ts",
        ].map((path) => [path, "export {};"]),
      ),
    );
    const graph = analyzeTypeScript({
      ...input,
      files: {
        ...input.files,
        "binary.ts": { encoding: "base64", mode: "100644", content: "AA==" },
        "link.ts": { encoding: "utf8", mode: "120000", content: "a.ts" },
      },
    });
    expect(graph.nodes.map((node) => node.path)).toEqual([
      "a.ts",
      "b.tsx",
      "c.mts",
      "d.cts",
      "e.d.ts",
      "f.d.mts",
      "g.d.cts",
    ]);
  });

  test("preserves unusual paths as unanalyzed when compiler path normalization cannot load them", () => {
    const graph = analyze({ "a\\b.ts": "export {};", "space name.ts": "export {};" });
    expect(graph.nodes.map((node) => node.path)).toEqual(["space name.ts"]);
    expect(graph.diagnostics).toHaveLength(1);
    const review = selectNeighborhood(analyze({}), graph, [change(null, "a\\b.ts")]);
    expect(review.selection.unanalyzedChanges).toHaveLength(1);
    expect(review.incomplete).toBe(true);
  });

  test("uses compiler literal types for nonliteral dynamic and CommonJS references", () => {
    const graph = analyze({
      "a.ts": `const target = './b.js'; void import(target); require(target); void import(\`./b.js\`); const obj = { path: './b.js' } as const; void import(obj.path); let unknown: string; void import(unknown); require('./missing.js'); const missing = './absent.js'; void import(missing);`,
      "b.ts": "export {};",
    });
    expect(edgeNames(graph)).toEqual(["a.ts->b.ts"]);
    expect(graph.references.filter((ref) => ref.outcome === "resolved")).toHaveLength(4);
    expect(graph.references.filter((ref) => ref.outcome === "unresolved")).toHaveLength(3);
    expect(graph.references.find((ref) => ref.expression === "unknown")).toMatchObject({
      line: 1,
      kind: "dynamic-import",
      outcome: "unresolved",
    });
  });

  test("uses imported constant types without expanding the selected neighborhood recursively", () => {
    const graph = analyze({
      "a.ts": "import { target } from './names.js'; void import(target);",
      "names.ts": "export const target = './b.js';",
      "b.ts": "export {};",
    });
    expect(edgeNames(graph)).toEqual(["a.ts->b.ts", "a.ts->names.ts"]);
    expect(graph.references.every((ref) => ref.outcome === "resolved")).toBe(true);
  });

  test("does not interpret string unions, concatenation or a shadowed require as a dependency", () => {
    const graph = analyze({
      "a.ts": `declare const target: './b.js' | './c.js'; void import(target); void import('./' + 'b.js'); function run(require: (s: string) => void) { require('./c.js'); }`,
      "b.ts": "export {};",
      "c.ts": "export {};",
    });
    expect(graph.edges).toEqual([]);
    expect(graph.references).toHaveLength(2);
    expect(graph.references.every((ref) => ref.outcome === "unresolved")).toBe(true);
  });

  test("resolves tsconfig extends, paths, rootDirs and nearest nested configuration", () => {
    const graph = analyze({
      "tsconfig.json": '{ "extends": "./config/base.json", "include": ["src/**/*.ts"] }',
      "config/base.json":
        '{ "compilerOptions": { "baseUrl": "..", "paths": { "@/*": ["src/*"] }, "rootDirs": ["../src", "../generated"] } }',
      "src/a.ts": "import '@/b'; import './generated';",
      "src/b.ts": "export {};",
      "generated/generated.ts": "export {};",
      "packages/p/tsconfig.json":
        '{ "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["lib/*"] } } }',
      "packages/p/a.ts": "import '@/b';",
      "packages/p/lib/b.ts": "export {};",
    });
    expect(edgeNames(graph)).toEqual([
      "packages/p/a.ts->packages/p/lib/b.ts",
      "src/a.ts->generated/generated.ts",
      "src/a.ts->src/b.ts",
    ]);
    expect(graph.diagnostics).toEqual([]);
  });

  test("loads project reference configs with include/exclude and analyzes excluded changed sources too", () => {
    const graph = analyze({
      "tsconfig.json":
        '{ "files": [], "references": [{"path":"./tsconfig.app.json"}, {"path":"./tsconfig.test.json"}] }',
      "tsconfig.app.json":
        '{ "include": ["src"], "exclude": ["src/**/*.test.ts"], "compilerOptions": { "paths": { "target": ["./app.ts"] } } }',
      "tsconfig.test.json":
        '{ "include": ["src/**/*.test.ts"], "compilerOptions": { "paths": { "target": ["./test.ts"] } } }',
      "src/a.ts": "import 'target';",
      "src/a.test.ts": "import 'target';",
      "extra.ts": "import './app.js';",
      "app.ts": "export {};",
      "test.ts": "export {};",
    });
    expect(edgeNames(graph)).toEqual([
      "extra.ts->app.ts",
      "src/a.test.ts->test.ts",
      "src/a.ts->app.ts",
    ]);
    expect(graph.diagnostics).toEqual([]);
  });

  test("resolves internal packages but distinguishes declared external, builtin, unsupported and unknown targets", () => {
    const graph = analyze({
      "tsconfig.json":
        '{ "compilerOptions": { "paths": { "@repo/lib": ["./packages/lib/index.ts"], "missing-alias": ["./absent.ts"] } } }',
      "package.json":
        '{ "dependencies": { "react": "*", "missing-alias": "*", "@repo/unlinked": "*" } }',
      "a.ts":
        "import '@repo/lib'; import 'react'; import 'node:fs'; import 'fs'; import './plain.js'; import 'unknown'; import 'missing-alias'; import '@repo/unlinked'; import './node_modules/external/index.js';",
      "packages/lib/index.ts": "export {};",
      "packages/unlinked/package.json": '{"name":"@repo/unlinked"}',
      "plain.js": "export {};",
      "node_modules/external/index.ts": "export {};",
    });
    expect(edgeNames(graph)).toEqual(["a.ts->packages/lib/index.ts"]);
    expect(graph.references.filter((ref) => ref.outcome === "excluded")).toHaveLength(5);
    expect(
      graph.references.filter((ref) => ref.outcome === "unresolved").map((ref) => ref.specifier),
    ).toEqual(["unknown", "missing-alias", "@repo/unlinked"]);
  });

  test("uses captured package imports and ESM/CommonJS export conditions", () => {
    const graph = analyze({
      "tsconfig.json": '{"compilerOptions":{"module":"NodeNext","moduleResolution":"NodeNext"}}',
      "package.json":
        '{"name":"fixture","type":"module","exports":{".":{"import":"./esm.mts","require":"./cjs.cts"}},"imports":{"#lib":"./esm.mts"}}',
      "a.mts":
        "import 'fixture'; import '#lib'; require('fixture'); const name = 'fixture'; void import(name);",
      "b.cts": "import x = require('fixture');",
      "esm.mts": "export {};",
      "cjs.cts": "export {};",
    });
    expect(edgeNames(graph)).toEqual(["a.mts->cjs.cts", "a.mts->esm.mts", "b.cts->cjs.cts"]);
    expect(graph.references.every((ref) => ref.outcome === "resolved")).toBe(true);
  });

  test("resolves ambient module declarations using compiler symbols", () => {
    const graph = analyze({
      "a.ts": "import type { T } from 'virtual';",
      "virtual.d.ts": "declare module 'virtual' { export interface T {} }",
    });
    expect(edgeNames(graph)).toEqual(["a.ts->virtual.d.ts"]);
  });

  test("reports invalid/missing/cyclic configuration and syntactic errors without discarding valid edges", () => {
    for (const config of [
      '{"extends":"./missing.json"}',
      '{"extends":"./tsconfig.json"}',
      '{"compilerOptions":{"moduleResolution":"invalid"}}',
      "{broken",
    ]) {
      const graph = analyze({
        "tsconfig.json": config,
        "a.ts": "import './b'; const = ;",
        "b.ts": "export {};",
      });
      expect(graph.diagnostics.length).toBeGreaterThan(0);
      expect(edgeNames(graph)).toContain("a.ts->b.ts");
    }
  });

  test("reports conflicting project configurations instead of silently claiming completeness", () => {
    const graph = analyze({
      "tsconfig.json":
        '{"files":[],"references":[{"path":"./tsconfig.a.json"},{"path":"./tsconfig.b.json"}]}',
      "tsconfig.a.json": '{"files":["a.ts"],"compilerOptions":{"module":"commonjs"}}',
      "tsconfig.b.json": '{"files":["a.ts"],"compilerOptions":{"module":"esnext"}}',
      "a.ts": "export {};",
    });
    expect(
      graph.diagnostics.some((diagnostic) =>
        diagnostic.message.includes("Multiple configurations"),
      ),
    ).toBe(true);
  });
});

describe("direct neighborhood", () => {
  test("retains both dependency targets, incoming users and all selected-node edges without recursion", () => {
    const files = {
      "a.ts": "import './b';",
      "b.ts": "import './c';",
      "c.ts": "import './far';",
      "far.ts": "export {};",
      "user.ts": "import './a';",
      "distant.ts": "import './missing';",
      "readme.md": "text",
    };
    const before = analyze(files);
    const after = analyze({ ...files, "a.ts": "import './c';" });
    const review = selectNeighborhood(before, after, [
      change("a.ts", "a.ts"),
      change("readme.md", "readme.md"),
    ]);
    expect(review.selection.paths).toEqual(["a.ts", "b.ts", "c.ts", "user.ts"]);
    expect(review.selection.beforeEdges).toContainEqual({ source: "b.ts", target: "c.ts" });
    expect(review.selection.afterEdges).toContainEqual({ source: "a.ts", target: "c.ts" });
    expect(review.selection.unanalyzedChanges).toHaveLength(1);
    expect(review.incomplete).toBe(true);
    expect(Object.isFrozen(review.before.references)).toBe(true);
  });

  test("preserves old and new rename paths, additions, deletions and unanalyzed nodes", () => {
    const before = analyze({ "old.ts": "import './gone';", "gone.ts": "export {};" });
    const after = analyze({
      "new.ts": "import './added';",
      "added.ts": "export {};",
      "plain.js": "export {};",
    });
    const review = selectNeighborhood(before, after, [
      change("old.ts", "new.ts"),
      change("gone.ts", null),
      change(null, "added.ts"),
      change(null, "plain.js"),
    ]);
    expect(review.selection.paths).toEqual(["added.ts", "gone.ts", "new.ts", "old.ts"]);
    expect(review.selection.beforeEdges).toEqual([{ source: "old.ts", target: "gone.ts" }]);
    expect(review.selection.afterEdges).toEqual([{ source: "new.ts", target: "added.ts" }]);
    expect(review.selection.unanalyzedChanges[0].newPath).toBe("plain.js");
    expect(selectNeighborhood(analyze({}), after, []).selection.paths).toEqual([]);
  });
});

describe("snapshot integration", () => {
  test("analysis failure retains the entire prior snapshot and a retry replaces it", async () => {
    const repo = await repository();
    await repo.write("a.ts", "import './b';");
    await repo.write("b.ts", "export {};");
    const source = new SnapshotSource(repo.root, { mode: ".", target: "." });
    const session = await ReviewSession.create(source);
    const original = session.snapshot;
    await repo.write("a.ts", "export {};");
    const failing = vi.spyOn(analysis, "analyzeTypeScript").mockImplementation(() => {
      throw new Error("analysis fixture failure");
    });
    try {
      await expect(session.refresh()).rejects.toThrow("analysis fixture failure");
      expect(session.snapshot).toBe(original);
      expect(session.status.error).toContain("analysis fixture failure");
    } finally {
      failing.mockRestore();
    }
    await session.refresh();
    expect(session.snapshot.summary.graph.after.edges).toEqual([]);
    expect(session.snapshot.summary.id).not.toBe(original.summary.id);
    await session.stop();
  });

  test("index/worktree/config/untracked analysis stays frozen after subsequent edits", async () => {
    const repo = await repository();
    await repo.write("tsconfig.json", '{"compilerOptions":{"paths":{"target":["./b.ts"]}}}');
    await repo.write("a.ts", "import 'target';");
    await repo.write("b.ts", "export {};");
    await repo.write("c.ts", "export {};");
    await repo.commit();
    await repo.write("tsconfig.json", '{"compilerOptions":{"paths":{"target":["./c.ts"]}}}');
    await repo.git(["add", "tsconfig.json"]);
    await repo.write(
      "tsconfig.json",
      '{"compilerOptions":{"paths":{"target":["./untracked.ts"]}}}',
    );
    await repo.write("untracked.ts", "import './a';");
    const staged = await new SnapshotSource(repo.root, {
      mode: "staged",
      target: "staged",
    }).capture();
    const working = await new SnapshotSource(repo.root, {
      mode: "working",
      target: "working",
    }).capture();
    const combined = await new SnapshotSource(repo.root, { mode: ".", target: "." }).capture();
    await repo.write("a.ts", "import './absent';");
    expect(edgeNames(staged.summary.graph.before)).toEqual(["a.ts->b.ts"]);
    expect(edgeNames(staged.summary.graph.after)).toEqual(["a.ts->c.ts"]);
    expect(edgeNames(working.summary.graph.before)).toEqual(["a.ts->c.ts"]);
    expect(edgeNames(working.summary.graph.after)).toEqual([
      "a.ts->untracked.ts",
      "untracked.ts->a.ts",
    ]);
    expect(edgeNames(combined.summary.graph.before)).toEqual(["a.ts->b.ts"]);
    expect(edgeNames(combined.summary.graph.after)).toEqual([
      "a.ts->untracked.ts",
      "untracked.ts->a.ts",
    ]);
    expect(analyzeTypeScript(working.after)).toEqual(working.summary.graph.after);
  });

  test("commit comparison handles root/add/delete/rename and refresh is atomic on failure", async () => {
    const repo = await repository();
    await repo.write("a.ts", "import './b';");
    await repo.write("b.ts", "export {};");
    const first = await repo.commit();
    const root = await new SnapshotSource(repo.root, { mode: "commit", target: first }).capture();
    expect(root.summary.graph.before.nodes).toEqual([]);
    expect(edgeNames(root.summary.graph.after)).toEqual(["a.ts->b.ts"]);
    await repo.git(["mv", "b.ts", "c.ts"]);
    await repo.write("a.ts", "import './c';");
    const second = await repo.commit();
    const source = new SnapshotSource(repo.root, {
      mode: "compare",
      target: "main",
      compareWith: first,
    });
    const session = await ReviewSession.create(source);
    expect(session.snapshot.summary.graph.selection.paths).toEqual(["a.ts", "b.ts", "c.ts"]);
    const previous = session.snapshot;
    await repo.git(["branch", "-m", "moved"]);
    await expect(session.refresh()).rejects.toThrow();
    expect(session.snapshot).toBe(previous);
    expect(edgeNames(previous.summary.graph.after)).toEqual(["a.ts->c.ts"]);
    await repo.git(["branch", "main", second]);
    await session.refresh();
    expect(session.snapshot).not.toBe(previous);
    await session.stop();
  });
});
