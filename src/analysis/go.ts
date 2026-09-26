import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DependencyGraph } from "../graph/model.js";
import type { CapturedState } from "../shared/review.js";

export interface GoOptions {
  readonly os?: string;
  readonly arch?: string;
  readonly tags?: readonly string[];
}

const excluded = /(^|\/)(?:node_modules|vendor|\.git|testdata|[._][^/]+)(\/|$)/;

async function run(
  executable: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  input?: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd,
      env,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let bytes = 0;
    let failure: string | undefined;
    const stop = (message: string) => {
      failure = message;
      child.kill("SIGKILL");
    };
    const timer = setTimeout(() => stop("Go analysis timed out."), 120_000);
    const collect = (chunks: Buffer[]) => (data: Buffer) => {
      bytes += data.length;
      if (bytes > 64 * 1024 * 1024) stop("Go analysis output exceeded 64 MiB.");
      else chunks.push(data);
    };
    child.stdout.on("data", collect(stdout));
    child.stderr.on("data", collect(stderr));
    child.stdin.on("error", () => {});
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 && !failure) resolve(Buffer.concat(stdout).toString("utf8"));
      else
        reject(
          new Error(
            failure ?? (Buffer.concat(stderr).toString("utf8").trim() || `Go exited with ${code}.`),
          ),
        );
    });
    child.stdin.end(input);
  });
}

export async function analyzeGo(
  state: CapturedState,
  options: GoOptions = {},
): Promise<DependencyGraph> {
  const files = Object.fromEntries(
    Object.entries(state.files)
      .filter(
        ([path, file]) =>
          file.encoding === "utf8" &&
          /^100(?:644|755)$/.test(file.mode) &&
          !excluded.test(path) &&
          (path.endsWith(".go") || /(^|\/)go\.(mod|work)$/.test(path)),
      )
      .map(([path, file]) => [path, file.content]),
  );
  const paths = Object.keys(files)
    .filter((path) => path.endsWith(".go"))
    .sort();
  const empty: DependencyGraph = { nodes: [], edges: [], references: [], diagnostics: [] };
  if (!paths.length) return empty;
  let directory: string | undefined;
  try {
    directory = await mkdtemp(join(tmpdir(), "changemap-go-"));
    const cache = join(tmpdir(), "changemap-go-build-cache");
    await mkdir(cache, { recursive: true, mode: 0o700 });
    // Only our helper is compiled. Repository sources stay in JSON on stdin.
    // Disable module/workspace discovery, toolchain downloads and ambient Go flags.
    const environment = {
      ...process.env,
      GOENV: "off",
      GOFLAGS: "",
      GOWORK: "off",
      GO111MODULE: "off",
      GOPROXY: "off",
      GOSUMDB: "off",
      GOTOOLCHAIN: "local",
      CGO_ENABLED: "0",
      GOOS: "",
      GOARCH: "",
      GOEXPERIMENT: "",
      GOCACHEPROG: "",
      GOCACHE: cache,
    };
    const executable = join(directory, process.platform === "win32" ? "analyze.exe" : "analyze");
    await run(
      "go",
      ["build", "-o", executable, fileURLToPath(new URL("./go-helper/main.go", import.meta.url))],
      directory,
      environment,
    );
    // Run directly, so timeout cancellation kills the analyzer itself rather than a go-run parent.
    const output = await run(
      executable,
      [],
      directory,
      environment,
      JSON.stringify({ files, ...options }),
    );
    const graph = JSON.parse(output) as DependencyGraph;
    if (graph.go) Object.freeze(graph.go.tags);
    if (graph.go) Object.freeze(graph.go);
    return graph;
  } catch (error) {
    const message =
      (error as NodeJS.ErrnoException).code === "ENOENT"
        ? "Go is not installed or is not on PATH. Install Go to analyze these files."
        : `Go analysis is unavailable: ${error instanceof Error ? error.message : String(error)}`;
    return { ...empty, diagnostics: paths.map((path) => ({ path, message })) };
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true });
  }
}
