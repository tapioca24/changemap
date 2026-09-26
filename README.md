# changemap

Understand code changes through file dependency maps.

Review local Git changes in your browser. See which TypeScript files depend on
changed code, follow added or removed dependencies, and read diffs alongside the map.

![A sample checkout change: checkout.ts switches from legacy-discount.ts to discount.ts, with the dependency map beside its diff.](https://raw.githubusercontent.com/tapioca24/changemap/main/.github/assets/changemap.png)

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
npx changemap . --port 4321  # choose a port; otherwise a free port is selected
npx changemap --help
```

## Read the map

- Changed TypeScript files appear with their direct dependencies and direct users
  from both sides of the comparison. Arrows point from the referencing file to
  its target. The map does not recursively expand the whole project.
- File labels show added, modified, deleted, renamed, or unchanged status.
  Added dependencies have a `+ added` label; removed dependencies have a
  `− deleted` label and a dashed line.
- Select a file to switch between **Diff**, **Before · full file**, and
  **After · full file**, where available. Other changed files are listed under
  **Outside dependency analysis**. Binary files have no text preview.
- Pan, zoom, or fit the map to explore it. File buttons also work with Enter or Space.
- When files change, an update notice appears. Choose **Refresh comparison** to
  replace the captured map and code. Until then, what you are reviewing stays
  fixed. A failed refresh keeps the previous comparison.

## Settings

Choose a theme and map direction in the toolbar. The 24 themes include Catppuccin
(Latte, Frappé, Macchiato, and Mocha), Tokyo Night, Rosé Pine, Vitesse, Kanagawa,
and Everforest variants. Mocha remains the default; the default direction is left
to right. The additional palettes are bundled with changemap and do not update
automatically. See [theme sources and licenses](THIRD_PARTY_THEME_NOTICES.md).
Settings are shared across projects and saved on the first UI setting change.

The configuration file is `$XDG_CONFIG_HOME/changemap/config.toml` when
`XDG_CONFIG_HOME` is an absolute path, otherwise `~/.config/changemap/config.toml`
on all supported platforms.

```toml
theme = "catppuccin-mocha" # e.g. tokyo-night-light, rose-pine-dawn, kanagawa-wave
orientation = "LR" # LR | TB | RL | BT
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
- Dependency analysis covers TypeScript files. Installed dependencies and files
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
