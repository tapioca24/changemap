# changemap implementation roadmap

## Product goal

Provide a local, Difit-like review UI that makes the relationships around changed files easy to see. The first release focuses on TypeScript dependency graphs and a stable graph-plus-code reading experience.

## Phase 0: project foundation

The detailed Phase 0 plan and subsequent agreements are maintained in [plan.md](plan.md). It specifies a single npm package, Node.js 24 support, three-OS CI, and an early package smoke test; the server and React UI remain in Phase 1.

- Initialize Backlog.md in the repository and record the first milestone.
- Create the pnpm TypeScript workspace and package metadata for npm package `changemap`.
- Use TypeScript as the confirmed implementation language for the CLI, local server, and browser UI.
- Choose and document the supported Node.js range, build output, executable name, and local server lifecycle.
- Add English-only README scaffolding with installation and basic CLI examples.
- Add the test, typecheck, lint, format, and build commands.

Acceptance: a clean checkout installs with pnpm, builds, and exposes a runnable `changemap` binary.

## Phase 1: diff input and local server

- Implement Difit-compatible local Git input modes: default HEAD, target, target plus compare-with, `.`, `staged`, `working`, and `@`.
- For two-argument input, compare the second argument (before) directly with the first argument (after), using branch tips when branches are specified; do not substitute the merge base. Verify that changes present only in the comparison branch appear reversed in the target.
- For single-target input, compare the target's parent (before) with the target commit (after); a branch selects its tip commit. Default input and `@` select HEAD under the same rule. For merge commits, use the first parent and include conflict-resolution changes in the resulting diff. For root commits, compare an empty state with the target commit and mark all files as added.
- Normalize Git status into added, modified, deleted, renamed, and unchanged records.
- Include non-TypeScript changed files in the review model.
- Retain changed binary files in the review model with their paths and change statuses, distinguishing unavailable text diffs from empty diffs.
- Include non-ignored untracked files as added in `.` and `working`; exclude untracked files from `staged` and exclude ignored untracked files from review.
- For `.`, compare HEAD (before) with the current worktree (after), showing the net result of staged and unstaged changes. Verify that a staged edit reverted to its HEAD content in the worktree produces no diff for that content.
- For `staged`, compare HEAD (before) with the index (after). Verify that subsequent unstaged edits do not affect the staged diff or captured contents.
- For `working`, compare the index (before) with the current worktree (after), including non-ignored untracked files as added. Verify that an edit from A to B staged before a further worktree edit to C appears as B to C.
- Before the first commit, use an empty before state for `.` and `staged`; keep the index-to-worktree comparison for `working`. Default input and `@` must explain that no target commit exists and exit.
- Serve the React application (confirmed UI technology) from a local server and open the browser by default, with a no-open option.
- Treat a valid comparison with no changes as an empty review rather than an error; keep the server running and preserve the comparison metadata and update detection.
- Add explicit refresh handling to replace the captured comparison data only when requested; integrate dependency graphs in Phases 2–3 and verify the complete review snapshot in Phase 4.
- Preserve the current captured data when refresh fails and expose the error for retry. Verify that a missing comparison ref does not discard or partially replace the existing data.
- Freeze diffs, full file contents, and analysis settings from the before and after states. Verify that requesting previously unread file contents after a worktree edit still returns the captured contents.
- If comparison inputs change during capture, discard that attempt and retry up to a bounded limit. On exhaustion, report why capture could not complete and preserve any existing snapshot. Verify a successful retry after an interrupted capture and preservation on exhaustion; choose the retry limit and change-validation strategy before implementation.
- Poll Git state and expose stale-state notifications without automatically replacing the captured data; connect these notifications to the refresh UI in Phase 4.
- Notify only when state relevant to the selected comparison changes. For `staged`, detect index or HEAD changes and ignore unstaged-only edits.
- For `.`, detect changes to HEAD and relevant worktree contents, including eligible untracked files and analysis settings. Verify that staging alone does not notify when comparison contents and the reviewed file set remain unchanged, but changes to the reviewed file set do notify.
- For `working`, detect changes to the index and relevant worktree contents, including staging operations, eligible untracked files, and analysis settings. Verify that HEAD-only changes do not notify when the index and worktree comparison inputs remain unchanged.
- For branch or HEAD inputs, detect changes to the referenced commit and notify without altering the current snapshot; re-resolve these refs on explicit refresh. Treat default input and `@` as HEAD inputs, and keep sides specified by commit ID fixed. Verify that either branch moving in a two-branch comparison triggers a notification and refresh uses the updated tips.

Acceptance: each supported mode produces stable comparison data, including non-TypeScript diffs and full contents. Relevant Git changes produce a stale notification without altering captured data; explicit refresh replaces it. These checks do not require the graph or code-pane UI.

## Phase 2: TypeScript dependency graph

- Define the internal graph model for file nodes and directed file dependencies.
- Analyze `.ts`, `.tsx`, `.mts`, `.cts`, and declaration files (`.d.ts`, `.d.mts`, `.d.cts`). Keep JavaScript files outside dependency analysis while allowing changed JavaScript files to be reviewed as unanalyzed diffs; cover these boundaries with fixtures.
- Detect import and re-export dependencies, including type-only references; deduplicate parallel references between the same files.
- Include module references whose target files the selected analysis foundation can identify without executing code, including dynamic imports and CommonJS require where supported. Do not impose a string-literal-only restriction or add custom inference logic. Report references whose targets cannot be identified, and document concrete coverage from prototypes and tests rather than assuming that parsing a construct resolves its target.
- Resolve paths using the repository's TypeScript configuration and handle unresolved, dynamic, and CommonJS references explicitly.
- Limit dependency graph nodes to eligible files within the reviewed repository. Exclude external packages and Node.js built-in modules even when resolved; include eligible files in other packages within the same repository. Verify both external exclusion and internal cross-package inclusion. Preserve the separate review nodes for unanalyzed changed files.
- Use analysis settings captured from the respective before and after states, keeping dependency analysis consistent with the snapshot's file contents.
- Analyze the index for the after side of `staged` and the before side of `working`; include eligible untracked TypeScript files for `.` and `working`. Verify that later worktree edits do not alter analysis of captured states.
- Build the initial subgraph from every changed TypeScript file plus the union of its direct dependencies and direct users from the before and after graphs.
- Preserve all edges between selected nodes from both before and after graphs, without recursively expanding the project. Verify that changing A's dependency from B to C retains A, B, and C and the respective before/after edges; classify those edges in Phase 3.
- Keep deleted and renamed paths available for the merged before/after view.
- Prototype alternative analysis strategies and measure cold and warm performance on small and large repositories before choosing eager indexing versus narrower analysis.
- Keep ts-morph as a candidate until prototypes verify correct before/after snapshot analysis and measure analysis time and memory usage on small and large repositories; decide adoption from those results. Define performance targets before evaluating acceptability.

Acceptance: representative TypeScript fixtures produce the expected direct-neighbor graph, including type imports, re-exports, additions, deletions, and renames.

## Phase 3: graph diff semantics

- Merge before and after graphs into one graph.
- Mark node status as added, modified, deleted, or renamed.
- Mark dependency edges as added, deleted, or unchanged.
- Verify that root commits mark all dependencies as added, and changing A's dependency from B to C marks A-to-B deleted and A-to-C added.
- Match old and new paths of Git-detected renames to the same file identity at both edge endpoints before comparing dependencies. Verify that renaming B to B-prime and updating A's import preserves one unchanged dependency edge, while retaining B's rename status and A's code diff.
- Distinguish unanalyzed non-TypeScript changed nodes from analyzed nodes without dependencies in the graph model.
- Use file nodes throughout the first release; do not abstract directories.

Acceptance: merged graph fixtures classify node and edge statuses correctly, including renames, and preserve the distinction between unanalyzed files and files with no dependencies. Visual verification follows in Phase 4.

## Phase 4: review UI and themes

- Build the React Flow graph view (confirmed graph UI technology) with stable node identity and selection; select the automatic layout engine separately.
- Add the right-hand code pane: diff by default, full-file toggle, full old content for deleted files, and rename metadata.
- For an empty comparison, show the comparison targets and a no-changes message. In uncommitted modes, continue update detection and show the refresh button when changes arise; verify the transition from an empty review to a populated review after explicit refresh.
- Show changed binary files as change nodes; display their paths, statuses, and an explicit text-diff-unavailable message in the right pane. Do not provide image or other format-specific previews in the first release; verify binary rendering states.
- Add graph legend, status labels, orientation control, and basic zoom/pan controls.
- Mark source nodes with unresolved references and show the relevant locations and available reasons in the right pane when selected. Do not create placeholder target nodes or edges. Distinguish unresolved references from intentionally excluded references, such as external packages, and verify these rendering states.
- Allow review to continue with resolved dependencies and code diffs when unresolved references remain. Show a review-wide notice of incomplete dependency analysis, including when detected unresolved references originate outside the displayed nodes; explain that direct users may be missing and verify this case.
- Use LR as the default layout and expose orientation as a setting. Show statuses with both Catppuccin colors and non-color labels/icons, and place unanalyzed changed files in a separate area without dependency edges.
- Show a refresh button on stale-state notifications while preserving the current graph and code. Verify that selecting a previously unselected node still displays captured contents, and that explicit refresh switches diffs, full contents, dependency graphs, and analysis settings together as one review snapshot.
- On refresh failure, retain the current graph and code and show an error with a retry button. Switch the displayed snapshot only after the entire replacement has been generated successfully; verify both failure preservation and successful retry.
- Bundle Catppuccin Latte, Frappé, Macchiato, and Mocha; use Mocha as the initial theme.
- Apply one selected theme consistently to UI, graph, and code; do not support separate graph/code themes.
- Persist UI settings globally in an XDG-compatible `config.toml`, shared across projects. Save theme and orientation changes immediately.
- If the config file does not exist, start with defaults and create it only when the user first changes a UI setting. Verify that starting the application alone does not create the file and that the first setting change is persisted.
- If saving settings fails, keep the changes applied in the current UI and allow review to continue. Show that saving failed and those changes will not persist across restarts. Preserve the existing config file on failure; verify the session behavior and file preservation with a failed-save case.
- If malformed configuration cannot be loaded, warn and start with defaults while preserving the original file. In this mode, apply UI setting changes only for the current session and indicate that they are not saved. Verify that review remains usable and the malformed file is not overwritten; this is an exception to immediate persistence.

Acceptance: selecting any node opens the correct content, switching theme updates the whole screen, settings survive restart, and the graph remains readable in all four flavors. Statuses and unanalyzed files are visually unambiguous. Relevant Git changes show a refresh affordance without replacing the graph or code; explicit refresh switches the complete review snapshot consistently.

## Phase 5: quality and release

- Add fixtures and integration tests for every CLI mode, Git status, dependency extraction, graph diff, refresh detection, settings persistence, and rendering states.
- Test large-graph behavior and record measured limits; keep analysis and rendering responsive enough for the first supported project sizes.
- Verify packaging with `pnpm pack` and an isolated install of the `changemap` binary.
- Publish the first npm package only after the README, license, build, and smoke test are complete.

Acceptance: CI passes on the supported Node versions, the packed artifact runs from a clean temporary directory, and the first release scope is documented in English.

## Deferred backlog

- Image and other format-specific binary previews.
- GitHub PR (`--pr`) and GitLab MR (`--mr`) inputs, including authentication and comment synchronization.
- Line comments and AI prompt copying.
- On-demand graph expansion beyond the initial direct neighborhood.
- User-configurable directory abstraction and other graph filtering policies.
- File watching instead of polling.
- Project-specific configuration overrides and custom themes.
- Go analyzer behind a language-agnostic analyzer interface.

## Open design decisions before implementation

- Exact CLI option compatibility and error messages.
- TOML schema, XDG environment-variable behavior, and CLI override precedence.
- Verify and document the selected analysis foundation's concrete module-reference coverage.
- Graph layout engine and edge style for added/deleted dependencies.
- Browser/server transport for refresh notifications.
- Node.js support range and npm release workflow.
