<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/tapioca24/changemap/main/.github/assets/logo-dark.svg">
    <img src="https://raw.githubusercontent.com/tapioca24/changemap/main/.github/assets/logo-light.svg" alt="changemap" width="500" height="128">
  </picture>
</p>

# changemap

Understand code changes through file dependency maps.

Review local Git changes in your browser. See which TypeScript and Go files depend on
changed code, follow added or removed dependencies, and read diffs alongside the map.

![Current review screen: checkout.ts switches from legacy-discount.ts to discount.ts, with added and deleted dependencies beside its code diff.](https://raw.githubusercontent.com/tapioca24/changemap/main/.github/assets/changemap.png)

## Quick start

You need **Node.js 24.11.0 or later within the 24.x line** and **Git on your PATH**.
macOS, Linux, and Windows are supported.

Inside the Git repository you want to review, run:

```sh
npx changemap .
```

This compares HEAD with your working tree, including staged changes and
non-ignored untracked files. Your browser opens automatically. Select a file to
read its diff or its captured before/after contents.

The server listens on `127.0.0.1`. Press **Ctrl+C in the terminal** to stop it;
closing the browser tab leaves it running.

For repeated use, you can install the command globally:

```sh
npm install --global changemap
changemap .
```

## Choose a comparison

Run these commands inside the repository. With a global installation, replace
`npx changemap` with `changemap`.

| Command                      | Before → after                                                  |
| ---------------------------- | --------------------------------------------------------------- |
| `npx changemap .`            | HEAD → working tree (all local changes)                         |
| `npx changemap staged`       | HEAD → index (staged changes)                                   |
| `npx changemap working`      | Index → working tree (unstaged changes)                         |
| `npx changemap`              | HEAD's first parent → HEAD                                      |
| `npx changemap @`            | Same as the default                                             |
| `npx changemap feature`      | The branch tip's first parent → its tip; a commit ID also works |
| `npx changemap feature main` | `main` → `feature`                                              |

**With two revisions, the second argument is before and the first is after.**
They are compared directly, not from their merge base.

```sh
npx changemap . --no-open    # print the URL without opening a browser
npx changemap . --port 20000 # prefer this port; try the next if occupied
npx changemap . --port 0     # let the OS choose a free port
npx changemap --help
```

By default, changemap prefers port 18473. If it is occupied, changemap tries higher
ports in order (up to 100 ports total) and prints the URL it actually uses.

## Read the map

- Changed TypeScript and Go files appear with their direct dependencies and direct users
  from both sides of the comparison. Arrows point from the referencing file to
  its target. The map does not recursively expand the whole project.
- Go starts in **Packages** view. Select a package to list its changed and related
  files on the right, then select a file to read its diff or code. Use **Go map →
  Files** to inspect individual file relationships. TypeScript stays file-based.
- Other changed files remain accessible under **Outside dependency analysis**.
  PNG, JPEG, GIF, and WebP files show before/after image previews where available;
  other binary files have no preview. The usage guide below lists preview limits.
- **Ignore whitespace** changes only the displayed diff, not file statuses or
  the dependency map.
- The map and code stay fixed after capture. When files change, use **Refresh
  comparison** to replace them; a failed refresh keeps the previous comparison.

### Open files in an editor

Set `VISUAL` or `EDITOR` to an editor command, or pass `--editor` to override
them for one run. The file path is appended as the last argument. Quote an
executable path containing spaces. Commands run without a shell.

```sh
npx changemap . --editor "code --reuse-window"
```

Terminal editors such as `vim` open in the terminal where changemap was
started. If the editor command is missing or fails to start, the code pane
shows the cause. The editor opens the current working tree file, not a
temporary copy of the captured comparison.

## Settings

### Go analysis

Go analysis requires **Go on your PATH** (tested with Go 1.26.5) and exactly one
captured `go.mod`, at the repository root or in a subdirectory. TypeScript and Go
can coexist. If Go is unavailable, TypeScript analysis and code review remain
available, with a diagnostic for unanalyzed Go files.

```sh
npx changemap . --go-os linux --go-arch amd64 --go-tags integration,feature
```

The default target is the host OS and architecture, with no custom tags. Both
sides use the same options. The review shows the target, tags, and Go version.
File suffixes, `//go:build`, and legacy `// +build` constraints select source files;
excluded files remain accessible outside dependency analysis. Architecture
feature tags use the baseline for the selected architecture, and cgo is disabled.

Go package nodes show the number of changed files and files included in the map.
Packages are identified by their repository-relative directory; internal and
external tests in that directory share the node. Only references directly involving
changed files select package connections; unrelated imports in other files do not
expand the map. Connections within a package are hidden in Packages view, including
when only one package is shown. A moved file is listed in both its old and new packages.

Package arrows are marked added or deleted only when that connection appears or
disappears across the captured states. Switching declarations inside a package,
or adding/removing a reference when another file retains the same connection,
leaves the package arrow unchanged. The Go view choice is remembered in the browser.

In Files view, edges connect references to the files declaring the referenced functions, types,
variables, fields, or methods, including references within a package. Both
internal and external `*_test.go` packages are included. Interface calls connect
to the interface declaration; implementations are not enumerated. Imports alone
do not create edges to every file in a package.

Only captured sources are analyzed. Standard-library sources, installed modules,
vendor directories, and local `replace` targets outside the snapshot are not
read. Consequently, standard-library and external imports can leave type
information incomplete; resolved internal edges are retained with diagnostics.
Blank imports are reported as unresolved because package initialization effects
are not represented by declaration references. Multiple modules and `go.work`
are unsupported. `testdata`, directories starting with `.` or `_`, symlinks, and
binary files are excluded. Sources outside the single module are diagnosed.

The bundled helper is compiled using the installed Go toolchain in a temporary
directory, with a build cache under the system temporary directory. Project code
is passed as snapshot data, never built or executed. No dependencies or toolchains
are downloaded. The first Go review can take longer while the helper is compiled.

### Appearance

Choose a theme, map direction, and directory grouping in the toolbar. The 24 themes include Catppuccin
(Latte, Frappé, Macchiato, and Mocha), Tokyo Night, Rosé Pine, Vitesse, Kanagawa,
and Everforest variants. Mocha remains the default; the default direction is left
to right. The additional palettes are bundled with changemap and do not update
automatically. See [theme sources and licenses](THIRD_PARTY_THEME_NOTICES.md).
Settings are shared across projects and saved on the first UI setting change.
With directory grouping off, files share one graph; files from the same directory
are kept close within each dependency layer where possible.

The configuration file is `$XDG_CONFIG_HOME/changemap/config.toml` when
`XDG_CONFIG_HOME` is an absolute path, otherwise `~/.config/changemap/config.toml`
on all supported platforms.

```toml
theme = "catppuccin-mocha" # e.g. tokyo-night-light, rose-pine-dawn, kanagawa-wave
orientation = "LR" # LR | TB | RL | BT
groupByDirectory = true # true | false
```

For manual configuration, the theme values are:

| Family      | Values                                                                                                                                                |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catppuccin  | `catppuccin-latte`, `catppuccin-frappe`, `catppuccin-macchiato`, `catppuccin-mocha`                                                                   |
| Tokyo Night | `tokyo-night`, `tokyo-night-storm`, `tokyo-night-light`                                                                                               |
| Rosé Pine   | `rose-pine`, `rose-pine-moon`, `rose-pine-dawn`                                                                                                       |
| Vitesse     | `vitesse-black`, `vitesse-dark`, `vitesse-dark-soft`, `vitesse-light`, `vitesse-light-soft`                                                           |
| Kanagawa    | `kanagawa-wave`, `kanagawa-dragon`, `kanagawa-lotus`                                                                                                  |
| Everforest  | `everforest-dark-hard`, `everforest-dark-medium`, `everforest-dark-soft`, `everforest-light-hard`, `everforest-light-medium`, `everforest-light-soft` |

## Important limits

- Comparisons use local Git data and leave the source repository unchanged.
  GitHub PR and GitLab MR URLs are not supported.
- Dependency analysis covers TypeScript and Go files. Installed dependencies and files
  outside the captured repository are not read. Missing configuration presets or
  unresolved references can make the map incomplete; check the UI notices.
- Unmerged indexes and working-tree comparisons in sparse checkouts are rejected.
  Missing historical objects must be fetched separately.
- Repository contents are captured in memory. Large repositories and dense maps
  can take substantial time and memory; layout runs synchronously. If layout
  fails, a file selector keeps captured code accessible.

See the [usage guide](https://github.com/tapioca24/changemap/blob/main/backlog/docs/doc-1%20-%20usage.md) for comparison edge cases,
configuration behavior, supported module references, and Git limitations.

## Contributing

See [CONTRIBUTING.md](https://github.com/tapioca24/changemap/blob/main/CONTRIBUTING.md)
for development, testing, packaging, and benchmark instructions.

## License

[MIT](https://github.com/tapioca24/changemap/blob/main/LICENSE). The license text is
in the root `LICENSE` file and is included in the distributed package.
