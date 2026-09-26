import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const metadata = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
// pnpm may be installed as a JS entry point or a standalone executable (mise).
const pnpm = process.env.npm_execpath;
assert.ok(pnpm, "Run this script with pnpm test:pack");
const temporary = mkdtempSync(join(tmpdir(), "changemap-pack-"));

function runPnpm(args, cwd) {
  const isJavaScript = /\.[cm]?js$/i.test(pnpm);
  const result = spawnSync(
    isJavaScript ? process.execPath : pnpm,
    isJavaScript ? [pnpm, ...args] : args,
    {
      cwd,
      encoding: "utf8",
      timeout: 120_000,
    },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  return result;
}

async function testServer(installed) {
  const init = spawnSync("git", ["init", "--quiet", "--template="], {
    cwd: temporary,
    encoding: "utf8",
  });
  assert.ifError(init.error);
  assert.equal(init.status, 0, init.stderr);
  writeFileSync(
    join(temporary, ".gitignore"),
    "node_modules/\n*.tgz\n.pnpm-store/\n.pnpm-cache/\n",
  );
  writeFileSync(join(temporary, "example.ts"), "import 'target';\nexport const value = 1;\n");
  writeFileSync(join(temporary, "dependency.ts"), "export {};\n");
  writeFileSync(join(temporary, "alternate.ts"), "export {};\n");
  writeFileSync(
    join(temporary, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { paths: { target: ["./dependency.ts"] } } }),
  );
  // The installed bin shim is covered above. Use its declared target to manage the
  // server child directly on all three OSes, without an intermediate pnpm process.
  const child = spawn(
    process.execPath,
    [join(installed, metadata.bin.changemap), ".", "--no-open"],
    {
      cwd: temporary,
      env: { ...process.env, XDG_CONFIG_HOME: join(temporary, ".git", "config-home") },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const exited = new Promise((resolve) => child.once("exit", (code) => resolve(code)));
  let stdout = "";
  let stderr = "";
  child.stderr.on("data", (data) => {
    stderr += data.toString();
  });
  try {
    const url = await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Server startup timed out: ${stderr}`)),
        15_000,
      );
      child.stdout.on("data", (data) => {
        stdout += data.toString();
        const match = stdout.match(/http:\/\/127\.0\.0\.1:\d+/);
        if (match) {
          clearTimeout(timer);
          resolve(match[0]);
        }
      });
      child.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once("exit", () => {
        clearTimeout(timer);
        reject(new Error(`Server exited: ${stderr}`));
      });
    });
    const html = await fetch(url).then((response) => response.text());
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]);
    assert.equal(assets.length, 2);
    for (const asset of assets) {
      const response = await fetch(`${url}${asset}`);
      assert.equal(response.status, 200);
      assert.ok((await response.text()).length > 100);
    }
    const config = join(temporary, ".git", "config-home", "changemap", "config.toml");
    const settings = await fetch(`${url}/api/settings`).then((response) => response.json());
    assert.deepEqual(settings.settings, { theme: "catppuccin-mocha", orientation: "LR" });
    assert.equal(existsSync(config), false);
    const saved = await fetch(`${url}/api/settings`, {
      method: "POST",
      headers: { "X-Changemap-Request": "1", "Content-Type": "application/json" },
      body: JSON.stringify({ theme: "catppuccin-latte", orientation: "BT" }),
    }).then((response) => response.json());
    assert.equal(saved.warning, null);
    assert.match(readFileSync(config, "utf8"), /theme = "catppuccin-latte"/);
    const snapshot = await fetch(`${url}/api/snapshot`).then((response) => response.json());
    assert.ok(snapshot.changes.some((change) => change.newPath === "example.ts"));
    assert.deepEqual(snapshot.graph.after.edges, [
      { source: "example.ts", target: "dependency.ts" },
    ]);
    assert.deepEqual(snapshot.graph.merged.edges, [
      { source: "after:example.ts", target: "after:dependency.ts", status: "added" },
    ]);
    assert.equal(snapshot.graph.incomplete, false);
    writeFileSync(join(temporary, "example.ts"), "import 'target';\nexport const value = 2;\n");
    writeFileSync(
      join(temporary, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { paths: { target: ["./alternate.ts"] } } }),
    );
    const frozen = await fetch(`${url}/api/snapshot`).then((response) => response.json());
    assert.deepEqual(frozen.graph, snapshot.graph);
    const old = await fetch(
      `${url}/api/file?side=after&path=example.ts&snapshot=${snapshot.id}`,
    ).then((response) => response.json());
    assert.equal(old.content, "import 'target';\nexport const value = 1;\n");
    const refreshedResponse = await fetch(`${url}/api/refresh`, {
      method: "POST",
      headers: { "X-Changemap-Request": "1" },
    });
    assert.equal(refreshedResponse.status, 200);
    const refreshed = await refreshedResponse.json();
    assert.notEqual(refreshed.id, snapshot.id);
    assert.deepEqual(refreshed.graph.merged.edges, [
      { source: "after:example.ts", target: "after:alternate.ts", status: "added" },
    ]);
    assert.deepEqual(refreshed.graph.after.edges, [
      { source: "example.ts", target: "alternate.ts" },
    ]);
    const updated = await fetch(
      `${url}/api/file?side=after&path=example.ts&snapshot=${refreshed.id}`,
    ).then((response) => response.json());
    assert.equal(updated.content, "import 'target';\nexport const value = 2;\n");
    assert.equal(stderr, "");
  } finally {
    child.kill("SIGTERM");
    const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
    try {
      await exited;
    } finally {
      clearTimeout(timer);
    }
  }
}

try {
  runPnpm(["pack", "--pack-destination", temporary], root);
  const archives = readdirSync(temporary).filter((name) => name.endsWith(".tgz"));
  assert.equal(archives.length, 1);
  writeFileSync(join(temporary, "package.json"), JSON.stringify({ private: true }));
  // A frozen-lockfile checkout does not populate registry metadata for a fresh
  // consumer. Install online with empty caches so developer state cannot hide
  // missing runtime dependencies or an invalid published dependency specifier.
  runPnpm(
    [
      "add",
      "--prod",
      "--ignore-scripts",
      `--config.store-dir=${join(temporary, ".pnpm-store")}`,
      `--config.cache-dir=${join(temporary, ".pnpm-cache")}`,
      join(temporary, archives[0]),
    ],
    temporary,
  );
  const installed = join(temporary, "node_modules", "changemap");
  assert.deepEqual(
    readdirSync(installed)
      .filter((name) => name !== "node_modules")
      .sort(),
    ["LICENSE", "README.md", "THIRD_PARTY_THEME_NOTICES.md", "dist", "package.json"],
  );
  assert.match(
    readFileSync(join(installed, "THIRD_PARTY_THEME_NOTICES.md"), "utf8"),
    /## Tokyo Night[\s\S]*## Rosé Pine[\s\S]*## Vitesse[\s\S]*## Kanagawa[\s\S]*## Everforest/,
  );
  for (const dependency of Object.keys(metadata.devDependencies)) {
    assert.equal(existsSync(join(temporary, "node_modules", dependency)), false);
    assert.equal(existsSync(join(installed, "node_modules", dependency)), false);
  }
  assert.deepEqual(readdirSync(join(installed, "dist")).sort(), ["cli.mjs", "ui"]);
  assert.ok(existsSync(join(installed, "dist", "ui", ".vite", "license.md")));
  // pnpm exec resolves the installed bin shim, including changemap.cmd on Windows.
  const help = runPnpm(["exec", "changemap", "--help"], temporary);
  assert.match(help.stdout, /Usage:/);
  assert.equal(help.stderr, "");
  const version = runPnpm(["exec", "changemap", "--version"], temporary);
  assert.equal(version.stdout.trim(), metadata.version);
  assert.equal(version.stderr, "");
  await testServer(installed);
  console.log(
    `Packed CLI, React assets, settings, dependency analysis, full contents and refresh passed in an isolated directory (${process.platform}, ${process.version}).`,
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
