# changemap

Understand code changes through file dependency maps.

This project is in development and has not been published to npm. Phase 0 provides
the CLI and development foundation. Only `--help` and `--version` are implemented.
Git comparisons, dependency analysis, the local server, and the browser UI are planned.

## Requirements

- Node.js 24.11.0 or later within the 24.x line (Node.js 22 and 26 are not supported).
- pnpm 10.33.0, pinned in `package.json`.
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

| Command                               | Purpose                                                          |
| ------------------------------------- | ---------------------------------------------------------------- |
| `pnpm test`                           | Build and run CLI integration tests once                         |
| `pnpm typecheck`                      | Check TypeScript without emitting files                          |
| `pnpm lint`                           | Run Oxlint                                                       |
| `pnpm format`                         | Format with Oxfmt                                                |
| `pnpm format:check`                   | Check formatting without writing                                 |
| `pnpm build`                          | Build the Node.js ESM CLI into `dist/cli.mjs`                    |
| `pnpm test:pack`                      | Pack, install outside the repository, and test the installed CLI |
| `pnpm exec backlog task list --plain` | View project tasks                                               |

## Install locally

Create a tarball from the checkout (packing builds the CLI automatically):

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
package metadata, README, and MIT license; it needs no runtime dependencies.
Bare `changemap`, review arguments, unknown options, and extra arguments currently
print an explanatory error and exit with status 1.

## Planned review workflow

The planned application compares Git states and displays file dependencies beside
code in a browser. The CLI will run the local server in the foreground; Ctrl+C will
stop it. Closing a browser tab will leave the server running. Background operation
and automatic shutdown on tab closure are outside the initial scope.

These server behaviors are not implemented in Phase 0. See [the roadmap](docs/roadmap.md)
for the subsequent phases and [the Phase 0 plan](docs/plan.md) for validation status.

## License

[MIT](LICENSE)
