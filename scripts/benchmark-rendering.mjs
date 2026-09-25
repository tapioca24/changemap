import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { cpus, platform, release } from "node:os";
import { renderingFixture } from "./rendering/fixture.mjs";

const run = promisify(execFile);
const root = new URL("../dist/ui/", import.meta.url);
const mixedEdges = process.argv.includes("--mixed-edges");
const args = process.argv.slice(2).filter((arg) => arg !== "--mixed-edges");
const size = Number(args[0] ?? 100);
const shape = args[1] ?? "layered";
const fixture = renderingFixture(size, shape, { mixedEdges });
const directories = new Set();
for (const node of fixture.graph.merged.nodes) {
  const parts = node.newPath.split("/");
  for (let depth = 1; depth < parts.length; depth++) {
    directories.add(parts.slice(0, depth).join("/"));
  }
}
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
        `window.renderingExpected = ${JSON.stringify({ nodes: size, directories: directories.size, edges: fixture.graph.merged.edges.length })};\n` +
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
      directories: directories.size,
      shape,
      mixedEdges,
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
      const selectedEdges = document.querySelectorAll('.react-flow__edge.edge-active').length;
      const selectedDots = document.querySelectorAll('.react-flow__edge.edge-active .edge-dots').length;
      if (!selectedEdges || selectedDots !== selectedEdges)
        throw Error('Selection did not animate every related edge');
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
    const hover = await evaluate(`(async () => {
      const paint = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const node = document.querySelector('.file-node');
      const edge = document.querySelector('.react-flow__edge-interaction');
      const selectedDotGroups = document.querySelectorAll('.edge-dots').length;
      let start = performance.now();
      node.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      await paint();
      const nodeDeadline = performance.now() + 10000;
      while (!document.querySelector('.edge-dots') && performance.now() < nodeDeadline)
        await paint();
      const nodeMs = performance.now() - start;
      const nodeEdges = document.querySelectorAll('.react-flow__edge.edge-active').length;
      const nodeDotGroups = document.querySelectorAll('.react-flow__edge.edge-active .edge-dots').length;
      node.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
      await paint();
      const clearDeadline = performance.now() + 10000;
      while (document.querySelectorAll('.edge-dots').length !== selectedDotGroups && performance.now() < clearDeadline)
        await paint();
      start = performance.now();
      edge.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      await paint();
      const edgeDeadline = performance.now() + 10000;
      while (!document.querySelector('.edge-dots') && performance.now() < edgeDeadline)
        await paint();
      const edgeMs = performance.now() - start;
      const edgeCount = document.querySelectorAll('.react-flow__edge.edge-active').length;
      if (!nodeEdges || nodeDotGroups !== nodeEdges || edgeCount !== 1)
        throw Error('Hover did not highlight and animate all related dependency edges: ' +
          JSON.stringify({ nodeEdges, nodeDotGroups, edgeCount }));
      return JSON.stringify({ nodeMs, nodeEdges, edgeMs, edgeCount });
    })()`);
    console.log(JSON.stringify({ hover }));
    const dots = await evaluate(`(async () => {
      const active = document.querySelector('.react-flow__edge.edge-active');
      const line = active.querySelector('.react-flow__edge-path');
      const dots = active.querySelector('.edge-dots');
      if (!dots || dots.getAttribute('stroke-width') !== '5' || dots.getAttribute('stroke-dasharray') !== '0 120')
        throw Error('Moving dots are missing');
      if (line.style.strokeLinecap !== 'round' || line.style.strokeWidth !== '2') throw Error('Edge appearance is wrong');
      const normal = document.querySelector('.react-flow__edge:not(.edge-active) .react-flow__edge-path');
      if (normal?.style.strokeWidth !== '2' || !line.getAttribute('marker-end'))
        throw Error('Normal edge width or arrowhead is wrong');
      if (getComputedStyle(dots).stroke !== getComputedStyle(line).stroke)
        throw Error('Dots do not match the edge color');
      const mask = active.querySelector('mask');
      if (!mask || mask.querySelectorAll('circle').length !== 2 || !dots.getAttribute('mask')?.includes(mask.id))
        throw Error('Dots do not fade at both endpoints');
      if (getComputedStyle(dots).animationDuration !== '1.5s')
        throw Error('Dot speed is wrong');
      const first = Number.parseFloat(getComputedStyle(dots).strokeDashoffset);
      await new Promise(r => setTimeout(r, 120));
      const next = Number.parseFloat(getComputedStyle(dots).strokeDashoffset);
      const moved = Math.abs(next - first);
      if (moved < 1) throw Error('Dot did not move along the edge');
      return JSON.stringify({ moved });
    })()`);
    console.log(JSON.stringify({ dots }));
    if (size <= 100) {
      const longEdge = await evaluate(`(async () => {
      const all = [...document.querySelectorAll('.react-flow__edge')];
      const longest = all.reduce((best, edge) =>
        edge.querySelector('.react-flow__edge-path').getTotalLength() >
        best.querySelector('.react-flow__edge-path').getTotalLength() ? edge : best);
      const interaction = longest.querySelector('.react-flow__edge-interaction');
      interaction.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const dots = longest.querySelector('.edge-dots');
      if (!dots || dots.getAttribute('stroke-dasharray') !== '0 120')
        throw Error('Long edge did not receive evenly spaced dots');
      return JSON.stringify({ length: longest.querySelector('.react-flow__edge-path').getTotalLength() });
      })()`);
      console.log(JSON.stringify({ longEdge }));
    }
    const appearance = await evaluate(
      await readFile(new URL("./rendering/appearance.js", import.meta.url), "utf8"),
    );
    if (mixedEdges && appearance.statuses.length !== 3)
      throw Error("Mixed edge appearance was not checked for every status");
    console.log(JSON.stringify({ appearance }));
    if (args[2]) {
      await evaluate(`(async () => {
        const zoom = document.querySelector('.react-flow__controls-zoomin');
        for (let i = 0; i < 2; i++) zoom.click();
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        return JSON.stringify('zoomed');
      })()`);
      await browser("screenshot", args[2]);
    }
    await browser("set", "media", "light", "reduced-motion");
    const reducedMotion = await evaluate(`JSON.stringify({
      enabled: matchMedia('(prefers-reduced-motion: reduce)').matches,
      dotsHidden: getComputedStyle(document.querySelector('.react-flow__edge.edge-active .edge-dots')).display === 'none',
      edgeStillActive: !!document.querySelector('.react-flow__edge.edge-active')
    })`);
    if (!reducedMotion.enabled || !reducedMotion.dotsHidden || !reducedMotion.edgeStillActive)
      throw Error("Reduced motion did not hide dots and preserve the highlighted edge");
    console.log(JSON.stringify({ reducedMotion }));
    if (size <= 1000) {
      const initialLimit = size <= 100 ? 1000 : 3000;
      const passed =
        initial.initialMs <= initialLimit &&
        interactions.timings.every((sample) => sample.selectMs <= 300 && sample.themeMs <= 300) &&
        hover.nodeMs <= 300 &&
        hover.edgeMs <= 300;
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
