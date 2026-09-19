import { posix } from "node:path";
import ts from "typescript-api";
import type { AnalysisDiagnostic } from "../graph/model.js";
import { ROOT, relative, isExcludedPath, type SnapshotFileSystem } from "./filesystem.js";

export interface AnalysisConfiguration {
  path: string;
  options: ts.CompilerOptions;
  files: ReadonlySet<string>;
}

export function configurations(fs: SnapshotFileSystem, diagnostics: AnalysisDiagnostic[]) {
  const configs = new Map<string, AnalysisConfiguration>();
  const pending = [...fs.files.keys()].filter(
    (path) => posix.basename(path) === "tsconfig.json" && !isExcludedPath(path),
  );
  const seen = new Set<string>();
  for (let index = 0; index < pending.length; index++) {
    const path = pending[index];
    if (seen.has(path)) continue;
    seen.add(path);
    const diagnostic = (error: ts.Diagnostic) => {
      // Empty solution configs are normal, and all captured TS files are analyzed.
      if (error.code === 18002 || error.code === 18003) return;
      diagnostics.push({
        path: relative(path) ?? path,
        message: ts.flattenDiagnosticMessageText(error.messageText, "\n"),
      });
    };
    const parsed = ts.getParsedCommandLineOfConfigFile(
      path,
      {},
      {
        ...fs,
        useCaseSensitiveFileNames: true,
        onUnRecoverableConfigFileDiagnostic: diagnostic,
      },
    );
    if (!parsed) continue;
    parsed.errors.forEach(diagnostic);
    configs.set(path, { path, options: parsed.options, files: new Set(parsed.fileNames) });
    for (const reference of parsed.projectReferences ?? []) {
      const target = reference.path.endsWith(".json")
        ? reference.path
        : `${reference.path}/tsconfig.json`;
      pending.push(target);
    }
  }
  return configs;
}

export function configurationFor(
  path: string,
  configs: Map<string, AnalysisConfiguration>,
  diagnostics: AnalysisDiagnostic[],
): AnalysisConfiguration | undefined {
  const containing = [...configs.values()].filter((config) => config.files.has(path));
  containing.sort(
    (a, b) =>
      posix.dirname(b.path).length - posix.dirname(a.path).length || a.path.localeCompare(b.path),
  );
  const first = containing[0];
  if (first) {
    const peers = containing.filter(
      (config) => posix.dirname(config.path) === posix.dirname(first.path),
    );
    if (
      peers.length > 1 &&
      peers.some((config) => JSON.stringify(config.options) !== JSON.stringify(first.options))
    ) {
      diagnostics.push({
        path: relative(path)!,
        message: `Multiple configurations include this file; using ${relative(first.path)}. Candidates: ${peers.map((config) => relative(config.path)).join(", ")}.`,
      });
    }
    return first;
  }
  // Untracked/excluded files still need analysis. Use their nearest tsconfig.json.
  let dir = posix.dirname(path);
  while (dir === ROOT || dir.startsWith(`${ROOT}/`)) {
    const config = configs.get(`${dir}/tsconfig.json`);
    if (config) return config;
    dir = posix.dirname(dir);
  }
  return undefined;
}

export const defaultOptions: ts.CompilerOptions = {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
};
