import { posix } from "node:path";
import ts from "typescript-api";
import type { CapturedState } from "../shared/review.js";

export const ROOT = "/snapshot";
export const absolute = (path: string) => `${ROOT}/${path}`;
export const relative = (path: string) =>
  path.startsWith(`${ROOT}/`) ? path.slice(ROOT.length + 1) : undefined;
export const isTypeScript = (path: string) => /\.(?:ts|tsx|mts|cts)$/.test(path);
export const isExcludedPath = (path: string) => /(^|\/)(node_modules|\.git)(\/|$)/.test(path);

// TypeScript's own config glob matcher is runtime-exported but not in its public
// declaration file. Keep the adapter here and pin the compiler version; fixtures
// cover include/exclude/extends rather than reimplementing TS glob semantics.
const matchFiles = (
  ts as unknown as {
    matchFiles(
      path: string,
      extensions: readonly string[] | undefined,
      excludes: readonly string[] | undefined,
      includes: readonly string[] | undefined,
      caseSensitive: boolean,
      cwd: string,
      depth: number | undefined,
      entries: (path: string) => { files: string[]; directories: string[] },
      realpath: (path: string) => string,
    ): string[];
  }
).matchFiles;

export class SnapshotFileSystem {
  readonly files = new Map<string, string>();
  private directories = new Map<string, { files: string[]; directories: string[] }>();

  constructor(state: CapturedState) {
    this.directories.set("/", { files: [], directories: ["snapshot"] });
    this.directories.set(ROOT, { files: [], directories: [] });
    for (const [path, file] of Object.entries(state.files)) {
      // Symlinks are captured as link text, never source text or live filesystem links.
      if (file.encoding !== "utf8" || !/^100(?:644|755)$/.test(file.mode)) continue;
      const name = absolute(path);
      this.files.set(name, file.content);
      let dir = posix.dirname(name);
      const missing: string[] = [];
      while (!this.directories.has(dir)) {
        missing.push(dir);
        dir = posix.dirname(dir);
      }
      for (const child of missing.reverse()) {
        this.directories.get(posix.dirname(child))!.directories.push(posix.basename(child));
        this.directories.set(child, { files: [], directories: [] });
      }
      this.directories.get(posix.dirname(name))!.files.push(posix.basename(name));
    }
    for (const entry of this.directories.values()) {
      entry.files.sort();
      entry.directories.sort();
    }
  }

  readFile = (path: string) => this.files.get(posix.normalize(path));
  fileExists = (path: string) => this.files.has(posix.normalize(path));
  directoryExists = (path: string) => this.directories.has(posix.normalize(path));
  getDirectories = (path: string) => this.directories.get(posix.normalize(path))?.directories ?? [];
  realpath = (path: string) => posix.normalize(path);
  getCurrentDirectory = () => ROOT;
  readDirectory = (
    path: string,
    extensions?: readonly string[],
    excludes?: readonly string[],
    includes?: readonly string[],
    depth?: number,
  ) =>
    matchFiles(
      path,
      extensions,
      excludes,
      includes,
      true,
      ROOT,
      depth,
      (dir) => this.directories.get(posix.normalize(dir)) ?? { files: [], directories: [] },
      this.realpath,
    );
}
