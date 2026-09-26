---
id: doc-1
title: usage
type: guide
created_date: '2026-09-23 15:07'
updated_date: '2026-09-26 08:44'
---
# Usage guide

See the [README](../../README.md) for requirements, installation, and a first review.
Run changemap inside the Git working tree you want to inspect.

## Comparisons

| Input after `npx changemap` | Before | After |
| --- | --- | --- |
| none or `@` | HEAD's first parent | HEAD |
| `<revision>` | Revision's first parent | Revision |
| `<target> <compare-with>` | compare-with | target |
| `.` | HEAD | Working tree |
| `staged` | HEAD | Index |
| `working` | Index | Working tree |

A revision can be a commit ID, branch, tag, or Git revision expression.
Two-revision comparisons use the tips directly, not their merge base.
Use `.`, `staged`, and `working` alone; they cannot be combined with a second input.

### Options and server lifecycle

- `--no-open` prints the URL without launching a browser.
- `--port <number>` (or `--port=<number>`) selects a port from 0 to 65535.
  The default, 0, chooses a free port.
- `--help` / `-h` and `--version` / `-v` are standalone commands.

The server binds to `127.0.0.1`. If browser launch fails, open the printed URL
manually. Press Ctrl+C in the terminal to stop the server; closing a browser tab
does not stop it. Invalid comparisons and unknown options produce errors.

### Working trees and commit boundaries

Single merge commits use the first parent. Root commits compare against an empty
state. Before the first commit, `.` and `staged` use an empty before state, while
`working` still compares the index to the working tree. Default and `@` require a
commit. Two-revision comparisons use the specified tips directly, so changes only
on the comparison branch appear reversed.

`.` and `working` include non-ignored untracked files. `staged` excludes them and
intent-to-add placeholders. Staging A -> B and then editing B -> C produces A -> B
in `staged` and B -> C in `working`. Returning the working file to A yields no net
change in `.`. Non-TypeScript files and Git-detected renames are included; binary
changes have an explicit text-diff-unavailable state.

The page shows the comparison targets, a dependency map, and a code pane, including
an empty state when there are no changes. The server retains full before/after file
contents, including unchanged files and repository analysis settings. Editing a
file after capture does not change the stored content.

Relevant changes are polled every 1.5 seconds after the previous check completes.
The page shows an update notice; **Refresh comparison** replaces the captured
comparison only after the entire replacement succeeds. Capture validates contents
before and after diff generation and tries at most three times. A failed refresh
keeps the old comparison and offers a retry.

`staged` observes HEAD and the index, `.` observes HEAD and eligible working files,
and `working` observes the index and eligible working files. Staging alone does not
invalidate `.` if contents and the reviewed file set stay the same. HEAD-only
changes do not invalidate `working`. Branch and HEAD inputs are re-resolved on
refresh; explicit commit IDs remain fixed.

## Git and performance limits

- Source repositories are read only. Git diff generation writes objects into a
  separate temporary repository that is removed after each attempt.
- Repository files are captured in memory. Large repositories can require substantial
  time and memory. Layout is synchronous and cannot be cancelled; if it throws,
  a file selector keeps captured code available. Synthetic benchmarks do not
  guarantee performance for your repository.
- Worktree bytes are compared as captured; custom clean/smudge filters, textconv,
  attributes-based diff drivers, and automatic line-ending conversion are not
  applied. UTF-8 text and arbitrary binary contents are retained; paths must be
  UTF-8. External programs from repository configuration are not used for diffs.
- Unmerged indexes produce an error. Worktree comparisons in sparse checkouts
  are rejected instead of treating absent files as deletions. Missing historical
  objects must be fetched separately; changemap does not fetch them automatically.
- Submodule gitlink changes can be captured. Submodule contents are not expanded;
  dirty initialized submodules cause a worktree capture error rather than being
  silently omitted. Symlink targets are stored without reading the target file.
- Before/after validation detects observed changes; it is not an atomic filesystem
  snapshot and cannot guarantee detection of edits reverted between reads.
- GitHub PR/GitLab MR inputs, comments, graph expansion, and previews for
  formats beyond PNG, JPEG, GIF, and WebP are not implemented.

## Review UI and settings

Select a file in the change map to read its diff or captured before/after contents.
Deleted files initially show their old full contents; unchanged neighbors show
full contents. Renames retain both paths. Supported images show a preview instead
of a text diff. Other binary files show why a preview is unavailable. Files outside
dependency analysis appear in a separate area. On wide screens, the code pane is
limited to the smaller of 55% of the workspace or 1440px.

PNG, JPEG, GIF, and WebP are identified from their bytes, even when the filename
has another extension. Animated GIF and WebP play normally. Diff shows the old
and new images side by side; Before and After show one image. If only one side can
be previewed, that image remains visible and the other side shows a reason. Images
fit within the pane with their original pixel dimensions shown. Click an image
to enlarge it; use Close, Escape, or the background to return to the preview.
Preview is limited to 10 MiB per image, 8,192 pixels per edge, and 24 million
pixels total. Symlinks and submodules are never previewed.

Text diffs and full files use syntax colors for TypeScript, JavaScript, JSON, CSS,
HTML, Markdown, Python, Go, Rust, Java, C/C++, C#, Ruby, PHP, shell scripts,
SQL, YAML, TOML, XML, and Dockerfiles. File extensions and common filenames
select the language; unknown languages remain plain text. Added and deleted
diff lines have distinct backgrounds, without `+` or `-` code prefixes. The
code appears immediately while highlighting loads. Files over 300,000 characters
or 5,000 lines, and files whose highlighting fails, remain readable without
syntax colors and show a short reason.

The code pane has display settings above the Diff, Before, and After tabs.
Diff starts in unified mode with whitespace ignore off. Switch to split mode
to compare old and new lines side by side with line numbers. Ignore whitespace
regenerates the displayed diff with Git `-w` from the captured states. It does
not change file statuses or the dependency map. Long lines always wrap in diffs
and both full-file views. The two display settings follow file changes and are
saved in the browser's `changemap.workspace` cookie so they survive the CLI's
changing port.

The graph uses Dagre layout with left-to-right, top-to-bottom, right-to-left, and
bottom-to-top orientations. Arrows always point from the referencing file to its
target. Node labels supplement status colors. Added edges have a `+ added` label;
deleted edges have a `− deleted` label and a dashed line. Use the zoom and fit
controls or pan the canvas. Select file buttons with Enter or Space.

Unresolved references mark source nodes and show locations and reasons in the
code pane, separately from intentionally excluded external references. A global
notice also covers incomplete analysis outside the displayed neighborhood.

New changes trigger a notification while the current graph and code remain
fixed. Refresh replaces the entire captured comparison and clears file selection;
a failed refresh preserves it and provides a retry action.

Theme and direction changes apply immediately and are shared across projects.
The bundled themes are Latte, Frappé, Macchiato, and Mocha (default); the default
direction is LR. Settings are saved at `$XDG_CONFIG_HOME/changemap/config.toml`
when `XDG_CONFIG_HOME` is an absolute path, otherwise at
`~/.config/changemap/config.toml` on all supported platforms. Starting the CLI
does not create the file; the first UI setting change does.

```toml
theme = "mocha" # latte | frappe | macchiato | mocha
orientation = "LR" # LR | TB | RL | BT
```

Missing keys use defaults. Invalid TOML or unsupported values cause a warning and
start with defaults; settings then apply only to that server session and the
original file is preserved. Saving failures also preserve the existing file and
keep changes active in the UI with a warning. Writes use a temporary file and
rename; unknown keys are retained, but comments and formatting are not. There are
no project-specific overrides or theme/direction CLI flags.

## TypeScript dependency analysis

Analysis covers `.ts`, `.tsx`, `.mts`, `.cts`, `.d.ts`, `.d.mts`, and `.d.cts`.
JavaScript, binaries, symlinks, submodule contents, and `node_modules` are not graph
sources. Changed files outside analysis remain available as diffs, and the graph
selection identifies unanalyzed changes separately.

Supported references include imports, type-only imports, re-exports, import types,
`import = require()`, dynamic imports, and unshadowed CommonJS `require()` calls.
The compiler's single string-literal types can resolve expressions such as
`const target = './b.js'; import(target)`, imported constants, and `as const`
properties. String unions and expressions the compiler cannot identify, such as
runtime strings or string concatenation, are reported as unresolved. There is no
custom expression evaluator. Arbitrary loader aliases, `module.require`,
`require.resolve`, triple-slash directives, and generated runtime imports are not
recognized module-reference forms in this version.

Both states use their captured TypeScript configuration and `package.json` files.
The analyzer supports config inheritance, `paths`, `baseUrl`, `rootDirs`, project
references, and TypeScript's module-resolution modes (including NodeNext package
imports/exports). It discovers `tsconfig.json` files and their referenced configs.
Configuration membership chooses the deepest matching project; ambiguous configs
are reported, with a deterministic fallback. Files outside configured include
patterns, including new untracked files, use the nearest `tsconfig.json`. With no
config, the default is NodeNext. A standalone custom-named config must be reached
through project references to be selected.

All file access is confined to the captured state. Installed dependencies, global
TypeScript libraries, and files outside the repository are never read. Missing
external config presets therefore produce diagnostics. Internal packages resolve
through captured relative paths, aliases, or package self-references; installed
workspace symlinks are not reconstructed. Node builtins and resolved out-of-scope
targets are excluded. An unresolved bare import of a declared external dependency
is also excluded; unknown names and unresolved internal package names are reported.

Every reference records its source location and resolved, excluded, or unresolved
outcome. Configuration and syntax diagnostics also mark the analysis incomplete.
The review-wide incomplete-analysis notice includes problems outside the displayed
neighborhood, since those may hide direct users. No placeholder edges are added.
Syntax diagnostics do not replace a full TypeScript type check.

The selection includes all changed TypeScript paths and their direct dependencies
and users from both states, preserving all edges between selected paths. It does
not recursively expand the project. Explicit refresh replaces graphs, settings,
diffs, and full contents together; a failed capture retains the previous snapshot.

Git-detected renames retain both paths. Updating an import to follow a rename
preserves an unchanged dependency when both endpoints match. Reusing the old
path for a new file creates a separate file in the comparison.

## Development and measurements

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for benchmark reproduction and
links to recorded measurements.
