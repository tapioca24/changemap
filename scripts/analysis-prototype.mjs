// Reproducible strategy comparison. Run each size/strategy in a fresh process.
import { performance } from "node:perf_hooks";
import { Project, ts } from "ts-morph";
const count = Number(process.argv[2] ?? 100);
const strategy = process.argv[3] ?? "compiler";
const files = new Map();
for (let i = 0; i < count; i++) {
  files.set(
    `/repo/f${i}.ts`,
    `import type { T } from './f${(i + 1) % count}';\nexport type U = T;\nexport interface T { value: number }\nconst target = './f${(i + 2) % count}';\nvoid import(target);\n`,
  );
}
const options = {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.CommonJS,
  moduleResolution: ts.ModuleResolutionKind.Node10,
  noLib: true,
  noResolve: process.argv[4] !== "recursive",
  types: [],
};
function analyze() {
  let project;
  let program;
  const host = {
    fileExists: (p) => files.has(p),
    readFile: (p) => files.get(p),
    directoryExists: (p) => p === "/repo" || p === "/",
    getDirectories: () => [],
    getCurrentDirectory: () => "/repo",
    getCanonicalFileName: (p) => p,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
    getDefaultLibFileName: () => "",
    writeFile: () => {},
    getSourceFile: (p, lang) =>
      files.has(p) ? ts.createSourceFile(p, files.get(p), lang, true) : undefined,
  };
  if (strategy === "morph") {
    project = new Project({ useInMemoryFileSystem: true, compilerOptions: options });
    for (const [path, text] of files) project.createSourceFile(path, text);
    program = project.getProgram().compilerObject;
  } else if (strategy === "compiler") {
    program = ts.createProgram([...files.keys()], options, host);
  }
  const checker = program?.getTypeChecker();
  let edges = 0;
  let unresolved = 0;
  const cache = ts.createModuleResolutionCache("/repo", (p) => p, options);
  for (const [path, text] of files) {
    const source =
      program?.getSourceFile(path) ?? ts.createSourceFile(path, text, ts.ScriptTarget.ESNext, true);
    function visit(node) {
      const ref = ts.isImportDeclaration(node)
        ? node.moduleSpecifier
        : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
          ? node.arguments[0]
          : undefined;
      if (ref) {
        const type = checker?.getTypeAtLocation(ref);
        const name = ts.isStringLiteralLike(ref)
          ? ref.text
          : type?.isStringLiteral()
            ? type.value
            : undefined;
        if (name && ts.resolveModuleName(name, path, options, host, cache).resolvedModule) edges++;
        else unresolved++;
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  return { edges, unresolved };
}
const results = [];
for (let run = 0; run < 2; run++) {
  const start = performance.now();
  const before = analyze();
  const after = analyze();
  // This prototype compares parsing/type resolution only; the production benchmark
  // also measures configuration loading and direct-neighborhood selection.
  if (before.edges !== after.edges) throw new Error("inconsistent snapshots");
  results.push({ milliseconds: Math.round(performance.now() - start), ...after });
}
console.log(
  JSON.stringify({
    strategy,
    count,
    bytesPerState: [...files.values()].reduce((n, s) => n + Buffer.byteLength(s), 0),
    node: process.version,
    platform: process.platform,
    typescript: ts.version,
    results,
    peakRssMiB: Math.round(process.resourceUsage().maxRSS / 1024),
  }),
);
