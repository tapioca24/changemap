import { createServer, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReviewSession } from "../review/session.js";
import { SettingsStore } from "../config/settings.js";
import { validSettings } from "../shared/settings.js";

export interface LocalServer {
  url: string;
  close(): Promise<void>;
}

export async function startServer(
  session: ReviewSession,
  options: { port?: number; assets?: string; pollIntervalMs?: number; configPath?: string } = {},
): Promise<LocalServer> {
  const assets = options.assets ?? fileURLToPath(new URL("./ui/", import.meta.url));
  // Validate the packaged entry before announcing a working URL.
  const html = await readFile(join(assets, "index.html"));
  const settings = await SettingsStore.load(options.configPath);
  let origin = "";
  const json = (response: ServerResponse, status: number, value: unknown) => {
    response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(value));
  };
  const server = createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'",
    );
    try {
      if (
        `http://${request.headers.host}` !== origin ||
        (request.headers.origin && request.headers.origin !== origin) ||
        request.headers["sec-fetch-site"] === "cross-site"
      ) {
        json(response, 403, { error: "Only same-origin local requests are allowed." });
        return;
      }
      const url = new URL(request.url ?? "/", origin);
      if (request.method === "GET" && url.pathname === "/api/settings") {
        json(response, 200, settings.state);
      } else if (request.method === "POST" && url.pathname === "/api/settings") {
        if (request.headers["x-changemap-request"] !== "1") {
          json(response, 403, { error: "A same-origin settings request is required." });
          return;
        }
        let body = "";
        for await (const chunk of request) {
          body += chunk.toString();
          if (body.length > 4096) {
            json(response, 413, { error: "Settings request too large." });
            return;
          }
        }
        let value: unknown;
        try {
          value = JSON.parse(body);
        } catch {
          json(response, 400, { error: "Invalid JSON." });
          return;
        }
        if (!validSettings(value)) {
          json(response, 400, { error: "Invalid settings." });
          return;
        }
        json(response, 200, await settings.save(value));
      } else if (request.method === "GET" && url.pathname === "/api/snapshot") {
        json(response, 200, session.snapshot.summary);
      } else if (request.method === "GET" && url.pathname === "/api/status") {
        json(response, 200, session.status);
      } else if (request.method === "GET" && url.pathname === "/api/file") {
        const snapshot = session.snapshot;
        const side = url.searchParams.get("side");
        const path = url.searchParams.get("path");
        if (url.searchParams.get("snapshot") !== snapshot.summary.id) {
          json(response, 409, {
            error: "This snapshot is no longer available. Refresh to use the current comparison.",
          });
        } else if ((side !== "before" && side !== "after") || path === null) {
          json(response, 400, { error: "Specify side=before|after and path." });
        } else if (!Object.hasOwn(snapshot[side].files, path)) {
          json(response, 404, { error: "File is absent from this captured state." });
        } else {
          json(response, 200, {
            snapshotId: snapshot.summary.id,
            path,
            ...snapshot[side].files[path],
          });
        }
      } else if (request.method === "POST" && url.pathname === "/api/refresh") {
        if (request.headers["x-changemap-request"] !== "1") {
          json(response, 403, { error: "A same-origin refresh request is required." });
          return;
        }
        try {
          json(response, 200, (await session.refresh()).summary);
        } catch {
          json(response, 503, {
            error: session.status.error,
            snapshotId: session.snapshot.summary.id,
          });
        }
      } else if (request.method === "GET" && url.pathname === "/") {
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end(html);
      } else if (
        request.method === "GET" &&
        /^\/assets\/[a-zA-Z0-9_.-]+\.(js|css)$/.test(url.pathname)
      ) {
        try {
          const body = await readFile(join(assets, url.pathname.slice(1)));
          response.writeHead(200, {
            "Content-Type": url.pathname.endsWith(".js")
              ? "text/javascript; charset=utf-8"
              : "text/css; charset=utf-8",
          });
          response.end(body);
        } catch {
          json(response, 404, { error: "Asset not found." });
        }
      } else {
        json(response, 404, { error: "Not found." });
      }
    } catch (error) {
      json(response, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 0, "127.0.0.1", () => {
      server.off("error", reject);
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("No listening address."));
        return;
      }
      origin = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
  session.startPolling(options.pollIntervalMs);
  let closing: Promise<void> | undefined;
  return {
    url: origin,
    close() {
      closing ??= (async () => {
        const closed = new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
        server.closeAllConnections();
        await Promise.all([closed, session.stop()]);
      })();
      return closing;
    },
  };
}
