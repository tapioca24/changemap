import { expect, test } from "vitest";
import { selectNeighborhood } from "../src/graph/select.js";
import type { DependencyGraph } from "../src/graph/model.js";
import type { FileChange } from "../src/shared/review.js";
import { createMapModel } from "../src/ui/map-model.js";
import { layoutMap } from "../src/ui/layout.js";

const state = (paths: string[], edges: string[][] = []): DependencyGraph => ({
  nodes: paths.map((path) => ({ path })),
  edges: edges.map(([source, target]) => ({ source, target })),
  references: [],
  diagnostics: [],
});
const change = (oldPath: string | null, newPath = oldPath): FileChange => ({
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
  oldMode: oldPath === null ? null : "100644",
  newMode: newPath === null ? null : "100644",
  binary: false,
  patch: "@@ -1 +1 @@\n-old\n+new",
});
const pkgId = (path: string) => `go-package:${path}`;

test("summarizes direct changed-file relations without bringing in the entire package", () => {
  const full = state(
    [
      "service/user.go",
      "service/helpers.go",
      "service/user_test.go",
      "service/billing.go",
      "domain/user.go",
      "payment/pay.go",
      "other/a.go",
    ],
    [
      ["service/user.go", "domain/user.go"],
      ["service/user.go", "service/helpers.go"],
      ["service/user_test.go", "service/user.go"],
      ["service/billing.go", "payment/pay.go"],
      ["domain/user.go", "other/a.go"],
    ],
  );
  const graph = selectNeighborhood(full, full, [change("service/user.go")]);
  const map = createMapModel(graph, "packages");
  expect(map.nodes.map((node) => node.id).sort()).toEqual([pkgId("domain"), pkgId("service")]);
  const service = map.nodes.find((node) => node.id === pkgId("service"));
  expect(service).toMatchObject({ kind: "package", changedCount: 1, status: "modified" });
  if (service?.kind !== "package") throw new Error("Missing package");
  expect(service.files.map((file) => file.newPath)).toEqual([
    "service/user.go",
    "service/helpers.go",
    "service/user_test.go",
  ]);
  expect(map.edges).toEqual([
    { source: pkgId("service"), target: pkgId("domain"), status: "unchanged" },
  ]);
});

test("changing declarations inside the same target package leaves its connection unchanged", () => {
  const paths = ["service/user.go", "domain/a.go", "domain/b.go"];
  const graph = selectNeighborhood(
    state(paths, [["service/user.go", "domain/a.go"]]),
    state(paths, [["service/user.go", "domain/b.go"]]),
    [change("service/user.go")],
  );
  expect(graph.merged.edges.map((edge) => edge.status).sort()).toEqual(["added", "deleted"]);
  expect(createMapModel(graph, "packages").edges).toEqual([
    { source: pkgId("service"), target: pkgId("domain"), status: "unchanged" },
  ]);
});

test.each([true, false])(
  "package connection stays unchanged when an unselected file retains it (%s)",
  (adding) => {
    const paths = ["service/user.go", "service/untouched.go", "domain/a.go", "domain/b.go"];
    const baseline = [["service/untouched.go", "domain/b.go"]];
    const expanded = [...baseline, ["service/user.go", "domain/a.go"]];
    const graph = selectNeighborhood(
      state(paths, adding ? baseline : expanded),
      state(paths, adding ? expanded : baseline),
      [change("service/user.go")],
    );
    expect(graph.merged.nodes.some((file) => file.newPath === "service/untouched.go")).toBe(false);
    expect(createMapModel(graph, "packages").edges[0].status).toBe("unchanged");
  },
);

test("only actual new and lost package connections receive added/deleted statuses", () => {
  const paths = ["service/user.go", "domain/a.go", "payment/pay.go"];
  const map = createMapModel(
    selectNeighborhood(
      state(paths, [["service/user.go", "domain/a.go"]]),
      state(paths, [["service/user.go", "payment/pay.go"]]),
      [change("service/user.go")],
    ),
    "packages",
  );
  expect(map.edges).toEqual([
    { source: pkgId("service"), target: pkgId("domain"), status: "deleted" },
    { source: pkgId("service"), target: pkgId("payment"), status: "added" },
  ]);
});

test("root and isolated packages remain packages, with added/deleted status based on all captured files", () => {
  const graph = selectNeighborhood(
    state(["main.go", "old/only.go", "existing/untouched.go"]),
    state(["main.go", "existing/untouched.go", "existing/new.go"]),
    [change("main.go"), change("old/only.go", null), change(null, "existing/new.go")],
  );
  const map = createMapModel(graph, "packages");
  expect(map.edges).toEqual([]);
  expect(map.nodes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: pkgId("."),
        kind: "package",
        changedCount: 1,
        status: "modified",
      }),
      expect.objectContaining({ id: pkgId("old"), kind: "package", status: "deleted" }),
      expect.objectContaining({ id: pkgId("existing"), kind: "package", status: "modified" }),
    ]),
  );
  expect(map.nodes).toHaveLength(3);
});

test("moving a file across packages retains both memberships and side-specific connections", () => {
  const graph = selectNeighborhood(
    state(["old/a.go", "domain/b.go"], [["old/a.go", "domain/b.go"]]),
    state(["new/a.go", "domain/b.go"], [["new/a.go", "domain/b.go"]]),
    [change("old/a.go", "new/a.go")],
  );
  const map = createMapModel(graph, "packages");
  for (const path of ["old", "new"]) {
    expect(map.nodes.find((node) => node.id === pkgId(path))).toMatchObject({
      changedCount: 1,
      files: [expect.objectContaining({ oldPath: "old/a.go", newPath: "new/a.go" })],
    });
  }
  expect(map.edges).toEqual([
    { source: pkgId("new"), target: pkgId("domain"), status: "added" },
    { source: pkgId("old"), target: pkgId("domain"), status: "deleted" },
  ]);
});

test("mixed languages and extension renames preserve TypeScript files and their connections", () => {
  const before = state(["main.go", "a.ts", "b.ts"], [["a.ts", "b.ts"]]);
  const after = state(
    ["main.ts", "a.ts", "b.ts"],
    [
      ["a.ts", "b.ts"],
      ["main.ts", "b.ts"],
    ],
  );
  const graph = selectNeighborhood(before, after, [change("main.go", "main.ts"), change("a.ts")]);
  const map = createMapModel(graph, "packages");
  expect(map.nodes.filter((node) => node.kind === "file").map((node) => node.id)).toEqual([
    "before:a.ts",
    "before:b.ts",
    "before:main.go",
  ]);
  expect(map.nodes.find((node) => node.kind === "package")).toMatchObject({
    id: pkgId("."),
    status: "deleted",
  });
  expect(map.edges).toEqual(graph.merged.edges);
  const files = createMapModel(graph, "files");
  expect(files.nodes.every((node) => node.kind === "file")).toBe(true);
  expect(files.edges).toEqual(graph.merged.edges);
});

test.each(["LR", "RL", "TB", "BT"] as const)(
  "package layout %s keeps similarly named packages distinct and routes every edge",
  (direction) => {
    const full = state(
      ["api/shared/a.go", "web/shared/b.go"],
      [["api/shared/a.go", "web/shared/b.go"]],
    );
    const map = createMapModel(
      selectNeighborhood(full, full, [change("api/shared/a.go")]),
      "packages",
    );
    for (const grouped of [true, false]) {
      const { nodes, routes, fileBounds } = layoutMap(map, direction, grouped);
      expect(nodes.filter((node) => node.type === "package")).toHaveLength(2);
      expect(fileBounds.size).toBe(2);
      expect(routes).toHaveLength(1);
      expect(
        routes.flat().every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
      ).toBe(true);
      const source = fileBounds.get(pkgId("api/shared"))!;
      const target = fileBounds.get(pkgId("web/shared"))!;
      const axis = direction === "LR" || direction === "RL" ? "x" : "y";
      expect(
        (target.position[axis] - source.position[axis]) *
          (direction === "LR" || direction === "TB" ? 1 : -1),
      ).toBeGreaterThan(0);
    }
  },
);

test("a TypeScript-to-Go rename displays the old TypeScript endpoint beside the new package", () => {
  const graph = selectNeighborhood(
    state(["main.ts", "lib.ts"], [["main.ts", "lib.ts"]]),
    state(["main.go", "lib.ts"]),
    [change("main.ts", "main.go")],
  );
  const map = createMapModel(graph, "packages");
  expect(map.nodes.find((node) => node.id === "before:main.ts")).toMatchObject({
    kind: "file",
    path: "main.ts",
  });
  expect(map.nodes.find((node) => node.id === pkgId("."))).toMatchObject({
    kind: "package",
    status: "added",
  });
  expect(map.edges).toEqual([
    { source: "before:main.ts", target: "before:lib.ts", status: "deleted" },
  ]);
});

test("edges between unchanged neighbors do not add extra package connections", () => {
  const full = state(
    ["service/user.go", "api/handler.go", "domain/a.go"],
    [
      ["api/handler.go", "service/user.go"],
      ["service/user.go", "domain/a.go"],
      ["api/handler.go", "domain/a.go"],
    ],
  );
  const graph = selectNeighborhood(full, full, [change("service/user.go")]);
  expect(graph.merged.edges).toHaveLength(3);
  const map = createMapModel(graph, "packages");
  expect(map.edges).toHaveLength(2);
  expect(
    map.edges.some((edge) => edge.source === pkgId("api") && edge.target === pkgId("domain")),
  ).toBe(false);
});
