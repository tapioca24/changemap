import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { cpus, platform, release } from "node:os";
import { renderingFixture } from "./rendering/fixture.mjs";

const run = promisify(execFile);
const root = new URL("../dist/ui/", import.meta.url);
const size = Number(process.argv[2] ?? 100);
const shape = process.argv[3] ?? "layered";
const fixture = renderingFixture(size, shape);
const session = `changemap-benchmark-${process.pid}`;
let settings = { theme: "mocha", orientation: "LR" };
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, "http://localhost").pathname;
    if (path.startsWith("/api/")) {
      res.setHeader("Content-Type", "application/json");
      if (path === "/api/settings" && req.method === "POST") {
        let body = "";
        for await (const chunk of req) body += chunk;
        settings = JSON.parse(body);
      }
      const data =
        path === "/api/settings"
          ? { settings, warning: null }
          : path === "/api/status"
            ? { snapshotId: fixture.id, stale: false, refreshing: false, error: null }
            : path === "/api/file"
              ? { encoding: "utf8", content: "export const value = 2;" }
              : fixture;
      res.end(JSON.stringify(data));
    } else if (path === "/observe.js") {
      res.setHeader("Content-Type", "text/javascript");
      res.end(
        `window.renderingExpected = ${JSON.stringify({ nodes: size, edges: fixture.graph.merged.edges.length })};\n` +
          (await readFile(new URL("./rendering/observe.js", import.meta.url), "utf8")),
      );
    } else if (path === "/") {
      res.setHeader("Content-Type", "text/html");
      res.end(
        (await readFile(new URL("index.html", root), "utf8")).replace(
          "<head>",
          '<head><script src="/observe.js"></script>',
        ),
      );
    } else if (/^\/assets\/[\w.-]+$/.test(path)) {
      res.setHeader("Content-Type", path.endsWith(".css") ? "text/css" : "text/javascript");
      res.end(await readFile(new URL(`.${path}`, root)));
    } else {
      res.writeHead(404).end();
    }
  } catch (error) {
    res.writeHead(500).end(String(error));
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}`;
async function browser(...args) {
  const { stdout } = await run("agent-browser", ["--session", session, ...args], {
    timeout: 60_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  return stdout.trim();
}
async function evaluate(code) {
  const result = JSON.parse(await browser("eval", "-b", Buffer.from(code).toString("base64")));
  return typeof result === "string" ? JSON.parse(result) : result;
}
try {
  console.log(
    JSON.stringify({
      size,
      edges: fixture.graph.merged.edges.length,
      shape,
      node: process.version,
      os: `${platform()} ${release()}`,
      cpu: cpus()[0]?.model,
      bundle: fileURLToPath(root),
    }),
  );
  await browser("set", "viewport", "1440", "1000");
  await browser("open", url);
  await browser(
    "wait",
    "--fn",
    "Number.isFinite(window.renderingMeasurement?.initialMs) || !!document.querySelector('[aria-label=\"File to review\"]')",
  );
  const fallback = await evaluate(
    "Boolean(document.querySelector('[aria-label=\"File to review\"]'))",
  );
  if (fallback === true) {
    const fallbackResult = await evaluate(`(async () => {
      const select = document.querySelector('[aria-label="File to review"]');
      const start = performance.now();
      select.value = select.options[1].value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      return JSON.stringify({ fallback: true, files: select.options.length - 1,
        selectionMs: performance.now() - start, codeAvailable: !!document.querySelector('[aria-label="File diff"]') });
    })()`);
    console.log(JSON.stringify(fallbackResult));
    process.exitCode = 1;
  } else {
    const initial = await evaluate(
      "JSON.stringify({ ...window.renderingMeasurement, browser: navigator.userAgent })",
    );
    console.log(JSON.stringify(initial));
    const interactions = await evaluate(`(async () => {
    const paint = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const timings = [];
    for (let i = 0; i < 5; i++) {
      let start = performance.now();
      document.querySelectorAll('.file-node')[i].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await paint();
      if (!document.querySelector('[aria-label="File diff"]')) throw Error('Selection did not open diff');
      const selectMs = performance.now() - start;
      start = performance.now();
      const select = document.querySelector('select');
      select.value = i % 2 ? 'mocha' : 'latte';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await paint();
      if (document.querySelector('.app').dataset.theme !== select.value) throw Error('Theme did not change');
      timings.push({ selectMs, themeMs: performance.now() - start });
    }
    return JSON.stringify({ timings });
  })()`);
    console.log(JSON.stringify(interactions));
    if (size <= 1000) {
      const initialLimit = size <= 100 ? 1000 : 3000;
      const passed =
        initial.initialMs <= initialLimit &&
        interactions.timings.every((sample) => sample.selectMs <= 300 && sample.themeMs <= 300);
      console.log(
        JSON.stringify({
          targetPassed: passed,
          initialLimitMs: initialLimit,
          interactionLimitMs: 300,
        }),
      );
      if (!passed) process.exitCode = 1;
    }
  }
  if (process.argv[4]) await browser("screenshot", process.argv[4]);
  const errors = JSON.parse(await browser("errors", "--json"));
  console.log(JSON.stringify({ browserErrors: errors.data?.errors ?? errors }));
  if (!errors.success || errors.data.errors.length) process.exitCode = 1;
} catch (error) {
  console.error(
    JSON.stringify({
      failure: String(error),
      browserErrors: await browser("errors", "--json").catch(String),
    }),
  );
  process.exitCode = 1;
} finally {
  await browser("close").catch(() => {});
  await new Promise((resolve) => server.close(resolve));
}
