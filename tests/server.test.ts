import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { get } from "node:http";
import { afterEach, expect, test, vi } from "vitest";
import { SnapshotSource } from "../src/git/snapshot.js";
import { parseInput } from "../src/git/input.js";
import { ReviewSession } from "../src/review/session.js";
import { startServer, type LocalServer } from "../src/server/server.js";
import { repository } from "./helpers/repository.js";

const servers: LocalServer[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});
const assets = fileURLToPath(new URL("../dist/ui/", import.meta.url));
async function serve(root: string, args = ["."]) {
  const session = await ReviewSession.create(new SnapshotSource(root, parseInput(args)));
  const server = await startServer(session, {
    assets,
    pollIntervalMs: 25,
    configPath: join(root, ".git", "changemap-config.toml"),
  });
  servers.push(server);
  const request = (path: string, init?: RequestInit) => fetch(`${server.url}${path}`, init);
  return { session, server, request };
}

test("serves HTML and its JS/CSS assets from the built distribution", async () => {
  const repo = await repository();
  const { request } = await serve(repo.root);
  const response = await request("/");
  expect(response.headers.get("content-type")).toContain("text/html");
  expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  const html = await response.text();
  const paths = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]);
  expect(paths).toHaveLength(2);
  for (const path of paths) {
    const asset = await request(path);
    expect(asset.status).toBe(200);
    expect((await asset.text()).length).toBeGreaterThan(100);
  }
  expect((await request("/package.json")).status).toBe(404);
  expect((await request("/assets/../../package.json")).status).toBe(404);
});

test("polling notifies without replacing an empty review; explicit refresh replaces it", async () => {
  const repo = await repository();
  const { request, session } = await serve(repo.root);
  const original = await request("/api/snapshot").then((response) => response.json());
  expect(original.changes).toEqual([]);
  expect(original.graph.merged).toEqual({ nodes: [], edges: [] });
  await repo.write("added.css", "body {}\n");
  await vi.waitFor(() => expect(session.status.stale).toBe(true));
  expect((await request("/api/status").then((response) => response.json())).stale).toBe(true);
  expect((await request("/api/snapshot").then((response) => response.json())).id).toBe(original.id);
  const updated = await request("/api/refresh", {
    method: "POST",
    headers: { "X-Changemap-Request": "1" },
  }).then((response) => response.json());
  expect(updated.id).not.toBe(original.id);
  expect(updated.changes[0]).toMatchObject({ newPath: "added.css", status: "added" });
  expect(updated.graph.merged.nodes).toMatchObject([
    { newPath: "added.css", status: "added", analyzed: { before: false, after: false } },
  ]);
  expect(session.status.stale).toBe(false);
});

test("requesting unread full contents after an edit returns captured data; snapshot IDs prevent mixed reads", async () => {
  const repo = await repository();
  await repo.write("file.ts", "A\n");
  await repo.commit();
  const { request, session } = await serve(repo.root);
  const id = session.snapshot.summary.id;
  await repo.write("file.ts", "B\n");
  const path = `/api/file?side=after&path=file.ts&snapshot=${id}`;
  expect((await request(path).then((response) => response.json())).content).toBe("A\n");
  expect((await request(`/api/file?side=after&path=../../etc/passwd&snapshot=${id}`)).status).toBe(
    404,
  );
  expect((await request(`/api/file?side=bad&path=file.ts&snapshot=${id}`)).status).toBe(400);
  await session.refresh();
  expect((await request(path)).status).toBe(409);
});

test("image endpoint serves captured bytes and dimensions with the selected snapshot only", async () => {
  const repo = await repository();
  const png = Buffer.alloc(24);
  Buffer.from("89504e470d0a1a0a", "hex").copy(png);
  png.writeUInt32BE(13, 8);
  png.write("IHDR", 12);
  png.writeUInt32BE(32, 16);
  png.writeUInt32BE(16, 20);
  await repo.write("picture.bin", png);
  await repo.commit();
  const { request, session } = await serve(repo.root);
  const id = session.snapshot.summary.id;
  const url = `/api/image?${new URLSearchParams({ snapshot: id, side: "after", path: "picture.bin" })}`;
  const head = await request(url, { method: "HEAD" });
  expect(head.status).toBe(200);
  expect(head.headers.get("content-type")).toBe("image/png");
  expect(head.headers.get("x-changemap-image-width")).toBe("32");
  expect(head.headers.get("x-changemap-image-height")).toBe("16");
  expect(head.headers.get("x-content-type-options")).toBe("nosniff");
  expect(head.headers.get("cross-origin-resource-policy")).toBe("same-origin");
  expect(await head.text()).toBe("");
  await repo.write("picture.bin", "replaced");
  expect(Buffer.from(await (await request(url)).arrayBuffer())).toEqual(png);
  expect((await request(url, { headers: { Origin: "https://example.com" } })).status).toBe(403);
  expect((await request(url.replace("picture.bin", "../../etc/passwd"))).status).toBe(404);
  await session.refresh();
  expect((await request(url)).status).toBe(409);
  const next = `/api/image?${new URLSearchParams({ snapshot: session.snapshot.summary.id, side: "after", path: "picture.bin" })}`;
  const unsupported = await request(next, { method: "HEAD" });
  expect(unsupported.status).toBe(415);
  expect(unsupported.headers.get("x-changemap-preview-reason")).toContain("Unsupported");
});

test("failed HTTP refresh keeps the old summary and full contents available for retry", async () => {
  const repo = await repository();
  await repo.write("file.ts", "A\n");
  await repo.commit();
  await repo.git(["branch", "compare"]);
  const { request, session } = await serve(repo.root, ["main", "compare"]);
  const original = session.snapshot;
  await repo.git(["branch", "-D", "compare"]);
  const failed = await request("/api/refresh", {
    method: "POST",
    headers: { "X-Changemap-Request": "1" },
  });
  expect(failed.status).toBe(503);
  expect((await failed.json()).error).toContain("compare");
  expect((await request("/api/snapshot").then((response) => response.json())).id).toBe(
    original.summary.id,
  );
  expect(
    (
      await request(`/api/file?side=after&path=file.ts&snapshot=${original.summary.id}`).then(
        (response) => response.json(),
      )
    ).content,
  ).toBe("A\n");
});

test("cross-origin, forged Host, and simple POST requests cannot access or mutate reviews", async () => {
  const repo = await repository();
  const { request, server } = await serve(repo.root);
  expect(
    (await request("/api/snapshot", { headers: { Origin: "https://example.com" } })).status,
  ).toBe(403);
  // fetch rewrites Host; use the raw HTTP client to exercise Host validation.
  const forgedStatus = await new Promise<number | undefined>((resolve, reject) => {
    get(`${server.url}/api/snapshot`, { headers: { Host: "example.com" } }, (response) => {
      response.resume();
      resolve(response.statusCode);
    }).on("error", reject);
  });
  expect(forgedStatus).toBe(403);
  expect((await request("/api/refresh", { method: "POST" })).status).toBe(403);
  expect(
    (
      await request("/api/refresh", {
        method: "POST",
        headers: { Origin: server.url, "X-Changemap-Request": "1" },
      })
    ).status,
  ).toBe(200);
});

test("shutdown releases its listening port and stops polling", async () => {
  const repo = await repository();
  const { session, server } = await serve(repo.root);
  await server.close();
  await expect(fetch(server.url)).rejects.toThrow();
  const check = vi.spyOn(session, "check");
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(check).not.toHaveBeenCalled();
});

test("occupied ports produce an actionable error without replacing the existing server", async () => {
  const repo = await repository();
  const { session, server } = await serve(repo.root);
  await expect(
    startServer(session, { assets, port: Number(new URL(server.url).port) }),
  ).rejects.toMatchObject({ code: "EADDRINUSE" });
  expect((await fetch(server.url)).status).toBe(200);
});

test("settings API validates requests, saves explicitly, and restores on server restart", async () => {
  const repo = await repository();
  const { request, server } = await serve(repo.root);
  const path = join(repo.root, ".git", "changemap-config.toml");
  const initial = await request("/api/settings").then((response) => response.json());
  expect(initial.settings).toEqual({ theme: "catppuccin-mocha", orientation: "LR" });
  await expect(readFile(path)).rejects.toMatchObject({ code: "ENOENT" });
  const settings = { theme: "kanagawa-lotus", orientation: "RL" };
  expect(
    (await request("/api/settings", { method: "POST", body: JSON.stringify(settings) })).status,
  ).toBe(403);
  const headers = { "X-Changemap-Request": "1" };
  expect((await request("/api/settings", { method: "POST", headers, body: "{" })).status).toBe(400);
  expect(
    (
      await request("/api/settings", {
        method: "POST",
        headers,
        body: JSON.stringify({ theme: "bad" }),
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await request("/api/settings", {
        method: "POST",
        headers: { ...headers, Origin: "https://example.com" },
        body: JSON.stringify(settings),
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await request("/api/settings", {
        method: "POST",
        headers,
        body: JSON.stringify(settings),
      }).then((response) => response.json())
    ).warning,
  ).toBeNull();
  await server.close();
  const restarted = await serve(repo.root);
  expect(
    (await restarted.request("/api/settings").then((response) => response.json())).settings,
  ).toEqual(settings);
});
