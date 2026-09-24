# Contributing to changemap

## Development setup

Use Node.js **>=24.11.0 <25**, **pnpm 10.33.0** (pinned in `package.json`), and Git.
Development and CI cover macOS, Linux, and Windows.

```sh
git clone https://github.com/tapioca24/changemap.git
cd changemap
pnpm install --frozen-lockfile
pnpm build
node dist/cli.mjs --help
node dist/cli.mjs . --no-open
```

To review another repository, run `node /absolute/path/to/changemap/dist/cli.mjs .`
from that repository. Use the equivalent absolute path on Windows.

## Source layout and conventions

- `src/git/`: Git comparisons and captured file contents.
- `src/analysis/`: TypeScript dependency analysis.
- `src/graph/`: Graph merging and neighborhood selection.
- `src/review/` and `src/server/`: Review sessions and the local HTTP server.
- `src/ui/`: React UI; `src/cli/`: CLI startup.
- `src/shared/` and `src/config/`: Shared types and persisted settings.
- `tests/`: Vitest tests, with temporary Git repository helpers in `tests/helpers/`.
- `scripts/`: Package checks and benchmarks. `dist/` is generated output.

Keep compared repositories read only. Dependency analysis must use captured
files, never installed dependencies or files outside the snapshot.
Internal data structures are documented by the TypeScript definitions in source.

Use strict TypeScript, ESM, two-space indentation, double quotes, and semicolons.
Relative imports use `.js`; type-only imports use `import type`. Run Oxfmt for
formatting. Follow nearby code and use kebab-case filenames.

## Verification

| Command                             | Purpose                                                       |
| ----------------------------------- | ------------------------------------------------------------- |
| `pnpm build`                        | Build the CLI and bundled React app into `dist/`              |
| `pnpm test`                         | Build, then run all Vitest tests                              |
| `pnpm typecheck`                    | Check TypeScript without emitting files                       |
| `pnpm lint`                         | Run Oxlint, treating warnings as errors                       |
| `pnpm format` / `pnpm format:check` | Apply / check Oxfmt formatting                                |
| `pnpm test:pack`                    | Install a tarball in isolation and test the installed package |
| `pnpm benchmark:layout 1000`        | Check a 1,000-node layout                                     |

After building, run a focused test with, for example:

```sh
pnpm exec vitest run tests/graph.test.ts
```

Add regression tests for behavior changes. Tests normally use Node; UI behavior
uses jsdom and Testing Library. Use temporary repositories for Git operations.

Before submitting, run typecheck, lint, format:check, test, benchmark:layout, and
test:pack. Report failures and any checks you could not run. CI checks Linux,
macOS, and Windows with Node.js 24.11.0 and the latest 24.x patch.

## Packaging and license

```sh
pnpm pack
```

Packing builds the CLI and UI automatically. In a separate directory, install
the generated archive using its actual filename and absolute path:

```sh
pnpm add /absolute/path/to/changemap/changemap-<version>.tgz
pnpm exec changemap --help
pnpm exec changemap --version
```

Replace `<version>` before running the command. The package contains `dist/`,
`package.json`, `README.md`, and `LICENSE`. The UI build includes third-party
notices in `dist/ui/.vite/license.md`. Runtime dependencies are installed from
the package metadata; development sources and tools are not needed to run it.

`pnpm test:pack` uses empty package and metadata caches and needs registry access.
It checks package contents, the installed executable, React assets, settings,
analysis, captured code, and refresh. The root [LICENSE](LICENSE) is the project's
MIT license text; `package.json` declares `MIT`. Preserve both and the bundled
third-party notices when changing the build or distribution.

## Benchmarks

After `pnpm build`:

```sh
pnpm benchmark:analysis 100 10000
pnpm benchmark:layout 1000
pnpm benchmark:rendering 100
pnpm benchmark:rendering 1000
pnpm benchmark:rendering 1000 chain
pnpm benchmark:rendering 1000 hub
pnpm benchmark:rendering 10000
```

Rendering benchmarks additionally need `agent-browser` and its Chromium installation.
The runner starts a loopback fixture server using the production UI and a dedicated
browser session, then closes both. An optional argument after the graph shape
writes a screenshot, for example:

```sh
pnpm benchmark:rendering 1000 layered /absolute/path/to/map.png
```

The runner emits JSON lines. For up to 1,000 nodes it checks provisional targets
of 1 second (100 nodes) / 3 seconds (1,000 nodes) for initial display and 300 ms
for selection/theme changes. Layout fallback or browser errors also fail the run.
The 10,000-node layered case is a known layout limit and is expected to fail.
CI runs the layout check without timing thresholds; browser timings are a separate
local measurement.

[Analysis measurements](<backlog/docs/doc-3 - analysis-performance.md>) and
[rendering measurements](<backlog/docs/doc-4 - rendering-performance.md>) retain
measurement conditions, reproduction details, and limits. The rendering document
also preserves the raw results in a JSON block. These synthetic results are not performance guarantees.
Repository analysis size and displayed graph size measure different workloads.
Browser timings exclude Git capture and analysis, and Node RSS excludes browser
memory. Do not present historical results as measurements of a new change.

## Documentation and tasks

The [README](README.md) covers first use. Detailed user behavior lives in the
[usage guide](<backlog/docs/doc-1 - usage.md>); keep it aligned with implementation.
Design rationale lives in [architecture](<backlog/docs/doc-2 - architecture.md>).
Ongoing work belongs in Backlog tasks; uncommitted ideas belong in drafts.
The former MVP documents were consolidated under `backlog/docs/`; TASK-16 records
the old-to-new mapping, including historical references in completed milestones.
The README screenshot is a real capture of a small TypeScript checkout example,
stored at `.github/assets/changemap.png`.

Search existing Backlog tasks before planning work. Use the Backlog CLI to create
and update tasks and documents; do not edit its generated Markdown directly.
See [AGENTS.md](AGENTS.md) for the task workflow and repository guidelines.

Use Conventional Commits with Japanese descriptions. Pull requests should explain
the problem, resulting behavior, related task or issue, and verification. Include
screenshots for UI changes. Publishing and release version changes require the
maintainer's explicit instruction; package smoke tests do not publish anything.
