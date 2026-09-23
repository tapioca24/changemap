# changemap

Understand code changes through file dependency maps.

This project is in development and has not been published to npm. Phase 1 provides
local Git comparisons, captured file contents, and a React review page with explicit
refresh. Dependency graphs, the full code pane, and theme settings are planned.

## Requirements

- Node.js 24.11.0 or later within the 24.x line (Node.js 22 and 26 are not supported).
- pnpm 10.33.0, pinned in `package.json`.
- Git on `PATH` (development is verified with Git 2.55).
- macOS, Linux, or Windows. CI is configured for each OS with Node.js 24.11.0 and the latest 24.x patch.

## Develop

```sh
git clone https://github.com/tapioca24/changemap.git
cd changemap
pnpm install --frozen-lockfile
pnpm build
node dist/cli.mjs --help
node dist/cli.mjs --version
```

| Command                               | Purpose                                                       |
| ------------------------------------- | ------------------------------------------------------------- |
| `pnpm test`                           | Build and run Git, CLI, and HTTP integration tests once       |
| `pnpm typecheck`                      | Check TypeScript without emitting files                       |
| `pnpm lint`                           | Run Oxlint                                                    |
| `pnpm format`                         | Format with Oxfmt                                             |
| `pnpm format:check`                   | Check formatting without writing                              |
| `pnpm build`                          | Build the ESM CLI and bundled React app into `dist/`          |
| `pnpm test:pack`                      | Pack, install in isolation, and test CLI, assets, and refresh |
| `pnpm exec backlog task list --plain` | View project tasks                                            |

## Install locally

Create a tarball from the checkout (packing builds the CLI and UI automatically):

```sh
pnpm pack
```

In a separate directory, install the generated tarball using its absolute path:

```sh
pnpm add /absolute/path/to/changemap/changemap-0.0.0.tgz
pnpm exec changemap --help
pnpm exec changemap --version
```

Use the equivalent absolute path on Windows. The tarball includes the built CLI,
React assets, bundled dependency notices, package metadata, README, and MIT license.
No npm runtime dependencies or development sources are needed after installation.

## Review local changes

Run the installed `changemap` command inside a Git working tree, or use
`node /absolute/path/to/changemap/dist/cli.mjs` from a source checkout.

```sh
changemap                       # HEAD against its first parent
changemap @                     # same as the default
changemap feature               # the branch tip against its first parent
changemap feature main          # main (before) -> feature (after), not merge-base
changemap .                     # HEAD -> working tree, including staged changes
changemap staged                # HEAD -> index
changemap working               # index -> working tree
changemap . --no-open            # print the URL without opening a browser
changemap . --port 4321          # choose a port instead of the default free port
```

The server binds to `127.0.0.1` and opens your browser by default. Press Ctrl+C to
stop it. Closing a tab keeps the server running. If browser launch fails, the URL
remains usable. Unknown options and invalid comparisons produce explanatory errors.

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

The page shows the comparison targets and expandable text diffs, including an
empty state when there are no changes. The server retains full before/after file
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

## Current boundaries

- Source repositories are read only. Git diff generation writes objects into a
  separate temporary repository that is removed after each attempt.
- Repository files are currently captured in memory. Large-repository time and
  memory targets, together with dependency analysis, are Phase 2 work.
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
- GitHub PR/GitLab MR inputs, dependency graphs, a full code pane, theme switching,
  and configuration persistence are not implemented in Phase 1.

See [the roadmap](docs/roadmap.md) and [Phase 1 implementation notes](docs/phase-1.md).

## License

[MIT](LICENSE)
