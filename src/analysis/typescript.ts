import { isBuiltin } from "node:module";
import { posix } from "node:path";
import ts from "typescript-api";
import type { CapturedState } from "../shared/review.js";
import type {
  AnalysisDiagnostic,
  DependencyGraph,
  FileDependency,
  ModuleReference,
} from "../graph/model.js";
import { configurationFor, configurations, defaultOptions } from "./config.js";
import { ROOT, SnapshotFileSystem, isExcludedPath, isTypeScript, relative } from "./filesystem.js";

type Candidate = { expression: ts.Node; kind: ModuleReference["kind"] };

function candidate(node: ts.Node, checker: ts.TypeChecker): Candidate | undefined {
  if (ts.isImportDeclaration(node)) return { expression: node.moduleSpecifier, kind: "import" };
  if (ts.isExportDeclaration(node) && node.moduleSpecifier)
    return { expression: node.moduleSpecifier, kind: "export" };
  if (
    ts.isImportEqualsDeclaration(node) &&
    ts.isExternalModuleReference(node.moduleReference) &&
    node.moduleReference.expression
  )
    return { expression: node.moduleReference.expression, kind: "import-equals" };
  if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument))
    return { expression: node.argument.literal, kind: "import-type" };
  if (!ts.isCallExpression(node)) return undefined;
  if (node.expression.kind === ts.SyntaxKind.ImportKeyword)
    return { expression: node.arguments[0] ?? node, kind: "dynamic-import" };
  if (ts.isIdentifier(node.expression) && node.expression.text === "require") {
    // A locally declared function/parameter called require is not the CommonJS loader.
    const declarations = checker.getSymbolAtLocation(node.expression)?.declarations ?? [];
    if (declarations.some((declaration) => !declaration.getSourceFile().isDeclarationFile))
      return undefined;
    return { expression: node.arguments[0] ?? node, kind: "require" };
  }
  return undefined;
}

function declaredPackages(fs: SnapshotFileSystem) {
  const manifests = new Map<string, Set<string>>();
  const internalNames = new Set<string>();
  for (const [path, text] of fs.files) {
    if (posix.basename(path) !== "package.json" || isExcludedPath(path)) continue;
    try {
      const json = JSON.parse(text);
      if (typeof json.name === "string") internalNames.add(json.name);
      manifests.set(
        posix.dirname(path),
        new Set([
          ...Object.keys(json.dependencies ?? {}),
          ...Object.keys(json.devDependencies ?? {}),
          ...Object.keys(json.peerDependencies ?? {}),
          ...Object.keys(json.optionalDependencies ?? {}),
        ]),
      );
    } catch {
      /* TypeScript handles package resolution; malformed manifests confer no exclusion. */
    }
  }
  return (source: string, specifier: string) => {
    const name = specifier.startsWith("@")
      ? specifier.split("/").slice(0, 2).join("/")
      : specifier.split("/")[0];
    if (internalNames.has(name)) return false;
    let dir = posix.dirname(source);
    while (dir === ROOT || dir.startsWith(`${ROOT}/`)) {
      if (manifests.get(dir)?.has(name)) return true;
      dir = posix.dirname(dir);
    }
    return false;
  };
}

export function analyzeTypeScript(state: CapturedState): DependencyGraph {
  const fs = new SnapshotFileSystem(state);
  const paths = [...fs.files.keys()]
    .filter((path) => isTypeScript(path) && !isExcludedPath(path))
    .sort();
  const eligible = new Set(paths);
  const diagnostics: AnalysisDiagnostic[] = [];
  const configs = configurations(fs, diagnostics);
  const groups = new Map<string, { options: ts.CompilerOptions; paths: string[] }>();
  for (const path of paths) {
    const config = configurationFor(path, configs, diagnostics);
    const key = config?.path ?? "";
    let group = groups.get(key);
    if (!group) {
      group = { options: config?.options ?? defaultOptions, paths: [] };
      groups.set(key, group);
    }
    group.paths.push(path);
  }
  const externalPackage = declaredPackages(fs);
  const references: ModuleReference[] = [];
  const analyzed = new Set<string>();
  const edges = new Map<string, FileDependency>();
  for (const group of groups.values()) {
    // Supply all captured eligible files, including cross-project dependencies.
    // noResolve avoids recursively loading long dependency chains. Resolution is
    // still performed by resolveModuleName and the checker; no code is executed.
    const options: ts.CompilerOptions = {
      ...group.options,
      noEmit: true,
      noResolve: true,
      noLib: true,
      types: [],
      incremental: false,
      composite: false,
      traceResolution: false,
    };
    const cache = ts.createModuleResolutionCache(ROOT, (path) => path, options);
    const host: ts.CompilerHost = {
      ...fs,
      getCanonicalFileName: (path) => path,
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => "\n",
      getDefaultLibFileName: () => "",
      writeFile: () => {},
      getSourceFile: (path, languageVersion) => {
        const text = fs.readFile(path);
        if (text === undefined || !eligible.has(path)) return undefined;
        return ts.createSourceFile(path, text, languageVersion, true);
      },
    };
    const program = ts.createProgram(paths, options, host);
    const checker = program.getTypeChecker();
    for (const path of group.paths) {
      const source = program.getSourceFile(path);
      if (!source) {
        diagnostics.push({
          path: relative(path)!,
          message:
            "The compiler could not load this captured path; file dependency analysis is unavailable.",
        });
        continue;
      }
      analyzed.add(path);
      for (const diagnostic of program.getSyntacticDiagnostics(source)) {
        diagnostics.push({
          path: relative(path)!,
          message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
        });
      }
      const stack: ts.Node[] = [source];
      while (stack.length > 0) {
        const node = stack.pop()!;
        ts.forEachChild(node, (child) => {
          stack.push(child);
        });
        const ref = candidate(node, checker);
        if (!ref) continue;
        const { expression, kind } = ref;
        const type = checker.getTypeAtLocation(expression);
        const specifier = ts.isStringLiteralLike(expression)
          ? expression.text
          : type.isStringLiteral()
            ? type.value
            : undefined;
        const location = source.getLineAndCharacterOfPosition(expression.getStart(source));
        const base = {
          source: relative(path)!,
          kind,
          line: location.line + 1,
          column: location.character + 1,
          expression: expression.getText(source),
          ...(specifier !== undefined ? { specifier } : {}),
        };
        if (specifier === undefined) {
          references.push({
            ...base,
            outcome: "unresolved",
            reason:
              "The compiler could not identify a single module specifier without executing code.",
          });
          continue;
        }
        if (isBuiltin(specifier)) {
          references.push({ ...base, outcome: "excluded", reason: "Node.js built-in module." });
          continue;
        }
        const mode = ts.isStringLiteralLike(expression)
          ? program.getModeForUsageLocation(source, expression)
          : kind === "require"
            ? ts.ModuleKind.CommonJS
            : ts.ModuleKind.ESNext;
        const resolved = ts.resolveModuleName(
          specifier,
          path,
          options,
          host,
          cache,
          undefined,
          kind === "require" ? ts.ModuleKind.CommonJS : mode,
        ).resolvedModule;
        // Ambient modules may resolve to captured declaration files without a
        // physical module path. Use the compiler symbol's declarations only.
        const symbolTargets = resolved
          ? []
          : (checker.getSymbolAtLocation(expression)?.declarations ?? [])
              .filter(
                (declaration) =>
                  ts.isModuleDeclaration(declaration) && ts.isStringLiteral(declaration.name),
              )
              .map((declaration) => declaration.getSourceFile().fileName);
        const targets = resolved ? [resolved.resolvedFileName] : [...new Set(symbolTargets)];
        if (targets.length > 0) {
          for (const target of targets) {
            const targetPath = relative(target);
            if (!eligible.has(target)) {
              references.push({
                ...base,
                outcome: "excluded",
                ...(targetPath ? { target: targetPath } : {}),
                reason:
                  !targetPath || isExcludedPath(target)
                    ? "Outside the repository dependency graph."
                    : "Target is not an eligible TypeScript source file.",
              });
            } else {
              const edge = { source: base.source, target: targetPath! };
              edges.set(JSON.stringify([edge.source, edge.target]), edge);
              references.push({ ...base, outcome: "resolved", target: edge.target });
            }
          }
        } else {
          // A paths alias must not be hidden as an external dependency when its
          // captured target is missing. Unknown bare names remain unresolved.
          const alias = Object.keys(options.paths ?? {}).some((pattern) => {
            const star = pattern.indexOf("*");
            return star < 0
              ? specifier === pattern
              : specifier.startsWith(pattern.slice(0, star)) &&
                  specifier.endsWith(pattern.slice(star + 1));
          });
          const external =
            !alias &&
            !specifier.startsWith(".") &&
            !specifier.startsWith("/") &&
            externalPackage(path, specifier);
          references.push({
            ...base,
            outcome: external ? "excluded" : "unresolved",
            reason: external
              ? "Declared external package; installed dependencies are not read."
              : "Module resolution found no target in the captured state.",
          });
        }
      }
    }
  }
  const freezeItems = <T extends object>(items: T[]) =>
    Object.freeze(items.map((item) => Object.freeze(item)));
  return Object.freeze({
    nodes: freezeItems(
      paths.filter((path) => analyzed.has(path)).map((path) => ({ path: relative(path)! })),
    ),
    edges: freezeItems(
      [...edges.values()].sort(
        (a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target),
      ),
    ),
    references: freezeItems(
      references.sort(
        (a, b) => a.source.localeCompare(b.source) || a.line - b.line || a.column - b.column,
      ),
    ),
    diagnostics: freezeItems(diagnostics),
  });
}
