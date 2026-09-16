# changemap implementation plan

## Product goal

Provide a local, Difit-like review UI that makes the relationships around changed files easy to see. The first release focuses on TypeScript dependency graphs and a stable graph-plus-code reading experience.

## Phase 0: project foundation

- Initialize Backlog.md in the repository and record the first milestone.
- Create the pnpm TypeScript workspace and package metadata for npm package `changemap`.
- Choose and document the supported Node.js range, build output, executable name, and local server lifecycle.
- Add English-only README scaffolding with installation and basic CLI examples.
- Add the test, typecheck, lint, format, and build commands.

Acceptance: a clean checkout installs with pnpm, builds, and exposes a runnable `changemap` binary.

## Phase 1: diff input and local server

- Implement Difit-compatible local Git input modes: default HEAD, target, target plus compare-with, `.`, `staged`, `working`, and `@`.
- Normalize Git status into added, modified, deleted, renamed, and unchanged records.
- Include non-TypeScript changed files in the review model.
- Serve the React application from a local server and open the browser by default, with a no-open option.
- Add explicit refresh handling so a refresh recomputes the whole review snapshot.
- Poll Git state and show a refresh button when the snapshot is stale; do not replace the current view automatically.

Acceptance: each supported mode produces a stable snapshot, non-TypeScript files can be opened as diffs, and a later worktree change produces a refresh affordance without moving the current graph.

## Phase 2: TypeScript dependency graph

- Define the internal graph model for file nodes and directed file dependencies.
- Detect import and re-export dependencies, including type-only references; deduplicate parallel references between the same files.
- Resolve paths using the repository's TypeScript configuration and handle unresolved, dynamic, and CommonJS references explicitly.
- Build the initial subgraph from every changed TypeScript file plus its direct dependencies and direct users.
- Preserve edges between selected surrounding nodes, without recursively expanding the project.
- Keep deleted and renamed paths available for the merged before/after view.
- Prototype alternative analysis strategies and measure cold and warm performance on small and large repositories before choosing eager indexing versus narrower analysis.

Acceptance: representative TypeScript fixtures produce the expected direct-neighbor graph, including type imports, re-exports, additions, deletions, and renames.

## Phase 3: graph diff semantics

- Merge before and after graphs into one graph.
- Mark node status as added, modified, deleted, or renamed.
- Mark dependency edges as added, deleted, or unchanged.
- Make status visible with both Catppuccin colors and non-color labels/icons.
- Represent non-TypeScript changed files in a separate unanalyzed area with no dependency edges.
- Use file nodes throughout the first release; do not abstract directories.
- Use LR as the default layout and expose orientation as a setting.

Acceptance: a fixture with changed edges and a rename makes every status unambiguous in one graph and does not imply that an unanalyzed file has no dependencies.

## Phase 4: review UI and themes

- Build the React Flow graph view with stable node identity and selection.
- Add the right-hand code pane: diff by default, full-file toggle, full old content for deleted files, and rename metadata.
- Add graph legend, status labels, orientation control, and basic zoom/pan controls.
- Bundle Catppuccin Latte, Frappé, Macchiato, and Mocha; use Mocha as the initial theme.
- Apply one selected theme consistently to UI, graph, and code; do not support separate graph/code themes.
- Persist UI settings globally in an XDG-compatible `config.toml`, shared across projects. Save theme and orientation changes immediately.

Acceptance: selecting any node opens the correct content, switching theme updates the whole screen, settings survive restart, and the graph remains readable in all four flavors.

## Phase 5: quality and release

- Add fixtures and integration tests for every CLI mode, Git status, dependency extraction, graph diff, refresh detection, settings persistence, and rendering states.
- Test large-graph behavior and record measured limits; keep analysis and rendering responsive enough for the first supported project sizes.
- Verify packaging with `pnpm pack` and an isolated install of the `changemap` binary.
- Publish the first npm package only after the README, license, build, and smoke test are complete.

Acceptance: CI passes on the supported Node versions, the packed artifact runs from a clean temporary directory, and the first release scope is documented in English.

## Deferred backlog

- GitHub PR (`--pr`) and GitLab MR (`--mr`) inputs, including authentication and comment synchronization.
- Line comments and AI prompt copying.
- On-demand graph expansion beyond the initial direct neighborhood.
- User-configurable directory abstraction and other graph filtering policies.
- File watching instead of polling.
- Project-specific configuration overrides and custom themes.
- Go analyzer behind a language-agnostic analyzer interface.

## Open design decisions before implementation

- Exact CLI option compatibility and error messages.
- TOML schema, XDG environment-variable behavior, and malformed-config recovery.
- Supported TypeScript syntax and treatment of dynamic import, CommonJS, external packages, and unresolved paths.
- Graph layout engine and edge style for added/deleted dependencies.
- Browser/server transport for refresh notifications.
- Node.js support range and npm release workflow.
