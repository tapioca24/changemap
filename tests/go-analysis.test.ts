import { afterEach, describe, expect, test, vi } from "vitest";
import { analyzeGo, type GoOptions } from "../src/analysis/go.js";
import { analyzeSnapshot } from "../src/analysis/pipeline.js";
import { SnapshotSource } from "../src/git/snapshot.js";
import type { CapturedState } from "../src/shared/review.js";
import { repository } from "./helpers/repository.js";

const state = (files: Record<string, string>): CapturedState => ({
  kind: "worktree",
  label: "fixture",
  files: Object.fromEntries(
    Object.entries(files).map(([path, content]) => [
      path,
      { encoding: "utf8", mode: "100644", content },
    ]),
  ),
});
const analyze = (files: Record<string, string>, options?: GoOptions) =>
  analyzeGo(
    state({
      "go.mod": "module example.com/app\ngo 1.24\n",
      ...files,
    }),
    options,
  );
const edges = (graph: Awaited<ReturnType<typeof analyze>>) =>
  graph.edges.map(({ source, target }) => `${source}->${target}`);
afterEach(() => vi.unstubAllEnvs());

describe("captured Go analysis", () => {
  test("resolves identifiers, aliases, dot imports and generic declarations to their actual files", async () => {
    const graph = await analyze({
      "main.go":
        'package app\nimport svc "example.com/app/service"\nfunc Run() { svc.User(); Helper(); _ = svc.Box[int]{} }',
      "helper.go": "package app\nfunc Helper() {}",
      "service/user.go": "package service\nfunc User() {}\ntype Box[T any] struct { Value T }",
      "service/billing.go": "package service\nfunc Billing() {}",
      "dot.go": 'package app\nimport . "example.com/app/service"\nfunc Dot() { User() }',
    });
    expect(graph.diagnostics).toEqual([]);
    expect(edges(graph)).toEqual([
      "dot.go->service/user.go",
      "main.go->helper.go",
      "main.go->service/user.go",
    ]);
    expect(graph.references.some((ref) => ref.kind === "symbol" && ref.expression === "Box")).toBe(
      true,
    );
  }, 120_000);

  test("resolves receiver methods, promoted fields and interface declarations without implementation guesses", async () => {
    const graph = await analyze({
      "interface.go": "package app\ntype Store interface { Save() }",
      "types.go": "package app\ntype Record struct { ID int }\ntype Concrete struct { Record }",
      "method.go": "package app\nfunc (Concrete) Save() {}",
      "call.go":
        "package app\nfunc Save(s Store) { s.Save() }\nfunc ConcreteSave(c Concrete) { c.Save(); _ = c.ID }",
      "interface-call.go": "package app\nfunc Call(s Store) { s.Save() }",
    });
    expect(graph.diagnostics).toEqual([]);
    expect(edges(graph)).toContain("call.go->method.go");
    expect(edges(graph)).toContain("call.go->types.go");
    expect(edges(graph).filter((edge) => edge.startsWith("interface-call.go"))).toEqual([
      "interface-call.go->interface.go",
    ]);
  });

  test("includes internal and external tests, including test-only exported declarations", async () => {
    const graph = await analyze({
      "main.go": "package app\nfunc Value() int { return 1 }",
      "export_test.go": "package app\nvar Exported = Value",
      "main_test.go": "package app\nfunc check() int { return Value() }",
      "external_test.go":
        'package app_test\nimport app "example.com/app"\nfunc check() int { return app.Value() + app.Exported() }',
    });
    expect(graph.diagnostics).toEqual([]);
    expect(edges(graph)).toEqual([
      "export_test.go->main.go",
      "external_test.go->export_test.go",
      "external_test.go->main.go",
      "main_test.go->main.go",
    ]);
    expect(edges(graph).some((edge) => edge.startsWith("main.go->"))).toBe(false);
  });

  test("handles test-only packages and production packages whose names end in _test", async () => {
    const graph = await analyze({
      "export_test.go": "package app\nfunc Exported() {}",
      "external_test.go":
        'package app_test\nimport app "example.com/app"\nfunc Check() { app.Exported() }',
      "special/main.go": "package special_test\nfunc Value() {}",
      "special/main_test.go": "package special_test\nfunc Check() { Value() }",
    });
    expect(graph.diagnostics).toEqual([]);
    expect(edges(graph)).toEqual([
      "external_test.go->export_test.go",
      "special/main_test.go->special/main.go",
    ]);
  });

  test("excludes cgo sources and reports their reason", async () => {
    const graph = await analyze({
      "plain.go": "package app\nfunc Value() {}",
      "cgo.go": 'package app\nimport "C"\nfunc Native() { Value() }',
    });
    expect(graph.nodes).toEqual([{ path: "plain.go" }]);
    expect(graph.diagnostics).toEqual([]);
    expect(graph.references).toContainEqual(
      expect.objectContaining({
        source: "cgo.go",
        outcome: "excluded",
        reason: expect.stringContaining("Cgo"),
      }),
    );
  });

  test("keeps actual snapshot paths and UTF-16 columns despite line directives and Unicode", async () => {
    const line = "func 呼出() { /*😀*/ 補助() }";
    const graph = await analyze({
      "呼出.go": `package app\n//line /outside/injected.go:400\n${line}`,
      "補助.go": "package app\nfunc 補助() {}",
    });
    expect(graph.diagnostics).toEqual([]);
    expect(edges(graph)).toEqual(["呼出.go->補助.go"]);
    expect(graph.references).toContainEqual(
      expect.objectContaining({
        source: "呼出.go",
        target: "補助.go",
        line: 3,
        column: line.indexOf("補助") + 1,
      }),
    );
  });

  test("applies GOOS/GOARCH, modern and legacy tags, release tags and architecture baselines", async () => {
    const graph = await analyze(
      {
        "main.go": "package app\nfunc Run() { Platform(); Tagged(); Arch(); Baseline() }",
        "platform_linux.go": "package app\nfunc Platform() {}",
        "platform_windows.go": "package app\nfunc Platform() {}",
        "arch_amd64.go": "package app\nfunc Arch() {}",
        "arch_arm64.go": "package app\nfunc Arch() {}",
        "tagged.go": "//go:build feature && go1.24\n\npackage app\nfunc Tagged() {}",
        "baseline.go": "//go:build amd64.v1\n\npackage app\nfunc Baseline() {}",
        "legacy.go": "// +build missing\n\npackage app\nfunc Run() {}",
      },
      { os: "linux", arch: "amd64", tags: ["feature"] },
    );
    expect(graph.diagnostics).toEqual([]);
    expect(edges(graph)).toEqual([
      "main.go->arch_amd64.go",
      "main.go->baseline.go",
      "main.go->platform_linux.go",
      "main.go->tagged.go",
    ]);
    expect(graph.nodes.map(({ path }) => path)).not.toContain("platform_windows.go");
    expect(graph.references.find((ref) => ref.source === "legacy.go")?.outcome).toBe("excluded");
    expect(graph.go).toMatchObject({ os: "linux", arch: "amd64", tags: ["feature"], cgo: false });
  });

  test("keeps resolved edges with missing external, standard-library, internal imports and syntax/type errors", async () => {
    const graph = await analyze({
      "main.go":
        'package app\nimport "fmt"\nimport "outside.example/pkg"\nimport "example.com/app/missing"\nfunc Run() { Helper(); fmt.Println(pkg.Unknown); missing.Call() }',
      "helper.go": "package app\nfunc Helper() {}",
      "broken.go": "package app\nfunc Broken( {",
    });
    expect(edges(graph)).toContain("main.go->helper.go");
    expect(graph.diagnostics.length).toBeGreaterThan(0);
    expect(
      graph.references.filter((ref) => ref.kind === "import" && ref.outcome === "unresolved"),
    ).toHaveLength(3);
  });

  test("reports initialization-only imports rather than inventing all-to-all file edges", async () => {
    const graph = await analyze({
      "main.go": 'package app\nimport _ "example.com/app/plugin"',
      "plugin/init.go": 'package plugin\nfunc init() { panic("never execute snapshot code") }',
    });
    expect(graph.edges).toEqual([]);
    expect(graph.references).toContainEqual(
      expect.objectContaining({
        kind: "import",
        outcome: "unresolved",
        reason: expect.stringContaining("initialization"),
      }),
    );
  });

  test("handles cycles and package name mismatches with diagnostics", async () => {
    const graph = await analyze({
      "a/a.go": 'package a\nimport "example.com/app/b"\nfunc A() { b.B() }',
      "b/b.go": 'package b\nimport "example.com/app/a"\nfunc B() { a.A() }',
      "wrong.go": "package wrong\nfunc Wrong() {}",
      "right.go": "package app\nfunc Right() {}",
    });
    expect(graph.diagnostics.some(({ message }) => message.includes("cycle"))).toBe(true);
    expect(graph.diagnostics.some(({ message }) => message.includes("package"))).toBe(true);
  });

  test("supports a nested single module and quoted module paths with comments", async () => {
    const graph = await analyzeGo(
      state({
        "backend/go.mod": '/* comment */\nmodule "example.com/app" // path\ngo 1.24\n',
        "backend/main.go": 'package app\nimport "example.com/app/lib"\nfunc Run() { lib.Call() }',
        "backend/lib/lib.go": "package lib\nfunc Call() {}",
        "outside.go": "package outside",
      }),
    );
    expect(edges(graph)).toEqual(["backend/main.go->backend/lib/lib.go"]);
    expect(graph.diagnostics).toEqual([
      { path: "outside.go", message: "File is outside the captured Go module." },
    ]);
  });

  test.each<Record<string, string>>([
    {},
    { "go.mod": "invalid" },
    { "go.mod": "module example.com/app\ngo invalid" },
    { "go.mod": "module example.com/app\ngo 1.24\ngo 1.25" },
    { "go.mod": "module example.com/app\nrequire (" },
    { "go.mod": "module example.com/app", "sub/go.mod": "module example.com/other" },
    { "go.mod": "module example.com/app", "go.work": "go 1.24\nuse ." },
  ])("reports unsupported or invalid module layouts: %j", async (files) => {
    const graph = await analyzeGo(state({ ...files, "main.go": "package app" }));
    expect(graph.nodes).toEqual([]);
    expect(graph.diagnostics.length).toBeGreaterThan(0);
  });

  test("honors the go.mod language version, defaulting to Go 1.16 when absent", async () => {
    const graph = await analyze({
      "go.mod": "module example.com/app",
      "main.go": "package app\ntype Box[T any] struct { value T }",
    });
    expect(graph.diagnostics.some(({ message }) => message.includes("go1.18"))).toBe(true);
  });

  test("does not read symlinks, binaries, installed or vendored sources, ignored Go directories", async () => {
    const input = state({
      "go.mod": "module example.com/app",
      "main.go": 'package app\nimport "outside.example/pkg"\nfunc Run() { pkg.Call() }',
      "vendor/outside.example/pkg/pkg.go": "package pkg\nfunc Call() {}",
      "node_modules/pkg/a.go": "package pkg",
      "testdata/a.go": "package app",
      ".hidden/a.go": "package app",
      "_ignored/a.go": "package app",
    });
    const graph = await analyzeGo({
      ...input,
      files: {
        ...input.files,
        "link.go": { encoding: "utf8", mode: "120000", content: "/outside/source.go" },
        "binary.go": { encoding: "base64", mode: "100644", content: "AA==" },
      },
    });
    expect(graph.nodes).toEqual([{ path: "main.go" }]);
    expect(graph.edges).toEqual([]);
    expect(graph.references[0].outcome).toBe("unresolved");
  });

  test("missing Go preserves TypeScript analysis and Go files remain unanalyzed", async () => {
    vi.stubEnv("PATH", "");
    const graph = await analyzeSnapshot(
      state({
        "go.mod": "module example.com/app",
        "main.go": "package app",
        "a.ts": "import './b';",
        "b.ts": "export {};",
      }),
    );
    expect(graph.nodes).toEqual([{ path: "a.ts" }, { path: "b.ts" }]);
    expect(edges(graph)).toEqual(["a.ts->b.ts"]);
    expect(graph.diagnostics).toEqual([
      { path: "main.go", message: expect.stringContaining("Go is not installed") },
    ]);
  });

  test("TypeScript-only snapshots do not need Go", async () => {
    vi.stubEnv("PATH", "");
    const graph = await analyzeSnapshot(state({ "a.ts": "export {};" }));
    expect(graph.diagnostics).toEqual([]);
    expect(graph.go).toBeUndefined();
  });

  test("uses snapshot content, never local replace targets or ambient build flags", async () => {
    const repo = await repository();
    await repo.write("lib/lib.go", "package lib\nfunc Call() {}");
    vi.stubEnv("GOFLAGS", "-overlay=/definitely/not/a/real/file.json");
    vi.stubEnv("GOOS", "windows");
    vi.stubEnv("GOARCH", "arm64");
    const graph = await analyze(
      {
        "go.mod": `module example.com/app\nreplace outside.example/lib => ${repo.root}/lib\n`,
        "main.go": 'package app\nimport "outside.example/lib"\nfunc Run() { lib.Call(); Local() }',
        "local.go": "package app\nfunc Local() {}",
      },
      { os: "linux", arch: "amd64" },
    );
    expect(edges(graph)).toEqual(["main.go->local.go"]);
    expect(
      graph.references.some(
        (ref) => ref.specifier === "outside.example/lib" && ref.outcome === "unresolved",
      ),
    ).toBe(true);
    expect(graph.go).toMatchObject({ os: "linux", arch: "amd64" });
  });

  test("snapshot comparisons merge Go and TS edges and stay frozen after later edits", async () => {
    const repo = await repository();
    await repo.write("go.mod", "module example.com/app");
    await repo.write("main.go", "package app\nfunc Run() { Old() }");
    await repo.write("old.go", "package app\nfunc Old() {}");
    await repo.write("a.ts", "export {};");
    await repo.commit();
    await repo.write("main.go", "package app\nfunc Run() { New() }");
    await repo.write("new.go", "package app\nfunc New() {}");
    await repo.write("a.ts", "import './b';");
    await repo.write("b.ts", "export {};");
    const captured = await new SnapshotSource(
      repo.root,
      { mode: ".", target: "." },
      { go: { os: "linux", arch: "amd64" } },
    ).capture();
    expect(edges(captured.summary.graph.before)).toEqual(["main.go->old.go"]);
    expect(edges(captured.summary.graph.after)).toEqual(["a.ts->b.ts", "main.go->new.go"]);
    expect(captured.summary.graph.merged.edges.map(({ status }) => status).sort()).toEqual([
      "added",
      "added",
      "deleted",
    ]);
    expect(captured.summary.graph.incomplete).toBe(false);
    expect(captured.summary.graph.before.go).toEqual(captured.summary.graph.after.go);
    expect(Object.isFrozen(captured.summary.graph.after.nodes[0])).toBe(true);
    await repo.write("new.go", "package app\nfunc Different() {}");
    expect(edges(captured.summary.graph.after)).toContain("main.go->new.go");
  }, 120_000);
});
