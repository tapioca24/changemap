<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/tapioca24/changemap/main/.github/assets/logo-dark.svg">
    <img src="https://raw.githubusercontent.com/tapioca24/changemap/main/.github/assets/logo-light.svg" alt="changemap" width="500" height="128">
  </picture>
</p>

# changemap

Understand code changes through file dependency maps.

Code review means understanding how changes affect related files. A file tree
organizes files by location; dependency relationships can cross those directories.

changemap visualizes code changes through their relationships with other files,
helping you understand them quickly. Currently supports TypeScript and Go.

![Checkout review with 12 connected files: pricing.ts switches discount modules and adds tax calculation, with added and deleted dependencies beside its code diff.](https://raw.githubusercontent.com/tapioca24/changemap/main/.github/assets/changemap.png)

## Quick start

You need **Node.js 24.11.0 or later within the 24.x line** and **Git on your PATH**.
macOS, Linux, and Windows are supported.

Inside the Git repository you want to review, run:

```sh
npx changemap
```

Your browser opens with the latest commit's changes. Select a file to read its diff.
Press **Ctrl+C in the terminal** to stop changemap.

Alternatively, install changemap globally:

```sh
npm install --global changemap
changemap
```

## Choose a comparison

Run these commands inside the repository:

| Command                               | Before → after                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| `changemap`                           | HEAD's first parent → HEAD                                                     |
| `changemap @`                         | Same as the default                                                            |
| `changemap feature`                   | The branch tip's first parent → its tip; a commit ID also works                |
| `changemap feature main`              | `main` → `feature`                                                             |
| `changemap feature main --merge-base` | Merge base of `feature` and `main` → `feature`                                 |
| `changemap .`                         | HEAD → working tree (all local changes, including non-ignored untracked files) |
| `changemap staged`                    | HEAD → index (staged changes)                                                  |
| `changemap working`                   | Index → working tree (unstaged changes, including non-ignored untracked files) |

**With two revisions, the second argument is before and the first is after.**
For a GitHub pull request or GitLab merge request review, add `--merge-base` to
compare the source branch with the branches' common ancestor. Fetch remote branches
before comparing them locally:

```sh
changemap origin/feature origin/main --merge-base
```

The default port is **18473**. If it is in use, changemap tries higher ports in
order (up to 100 ports total) and prints the URL it uses.

## Read the map

- Changed files appear with their direct dependencies and the files that directly
  depend on them, including unchanged files. The map does not expand recursively.
- Changed files outside dependency analysis appear under **Other files**.
- When files change, use **Refresh comparison** to update the captured map and code.

### Open files in an editor

changemap opens files with the editor specified by `VISUAL`, falling back to
`EDITOR`. Use `--editor` to override it:

```sh
changemap --editor "code --reuse-window"
```

The editor opens the current working tree file.

## Settings

Settings are shared across projects and saved when you change them in the UI.
The configuration file is `$XDG_CONFIG_HOME/changemap/config.toml` when
`XDG_CONFIG_HOME` is an absolute path, otherwise `~/.config/changemap/config.toml`
on all supported platforms.

You can also edit the file directly. This example shows the defaults; omitted
settings use their defaults:

```toml
theme = "catppuccin-mocha"
orientation = "LR" # LR | TB | RL | BT
groupByDirectory = true
codeFontSize = 12 # 10–24 px
```

### Themes

| Theme                   | Configuration value       |
| ----------------------- | ------------------------- |
| Catppuccin Latte        | `catppuccin-latte`        |
| Catppuccin Frappé       | `catppuccin-frappe`       |
| Catppuccin Macchiato    | `catppuccin-macchiato`    |
| Catppuccin Mocha        | `catppuccin-mocha`        |
| Tokyo Night             | `tokyo-night`             |
| Tokyo Night Storm       | `tokyo-night-storm`       |
| Tokyo Night Light       | `tokyo-night-light`       |
| Vitesse Black           | `vitesse-black`           |
| Vitesse Dark            | `vitesse-dark`            |
| Vitesse Dark Soft       | `vitesse-dark-soft`       |
| Vitesse Light           | `vitesse-light`           |
| Vitesse Light Soft      | `vitesse-light-soft`      |
| Rosé Pine               | `rose-pine`               |
| Rosé Pine Moon          | `rose-pine-moon`          |
| Rosé Pine Dawn          | `rose-pine-dawn`          |
| Kanagawa Wave           | `kanagawa-wave`           |
| Kanagawa Dragon         | `kanagawa-dragon`         |
| Kanagawa Lotus          | `kanagawa-lotus`          |
| Everforest Dark Hard    | `everforest-dark-hard`    |
| Everforest Dark Medium  | `everforest-dark-medium`  |
| Everforest Dark Soft    | `everforest-dark-soft`    |
| Everforest Light Hard   | `everforest-light-hard`   |
| Everforest Light Medium | `everforest-light-medium` |
| Everforest Light Soft   | `everforest-light-soft`   |

See [theme sources and licenses](THIRD_PARTY_THEME_NOTICES.md).

### Go analysis

Go analysis requires **Go on your PATH** and exactly one `go.mod` in the captured
repository, at the root or in a subdirectory. Without Go, you can still review
code and use TypeScript dependency maps.

The default analysis target is your host OS and architecture, with no custom build
tags. To review a different target:

```sh
changemap --go-os linux --go-arch amd64 --go-tags integration,feature
```

These options apply to both sides of the comparison. cgo is disabled.

## Known limitations

- Comparisons use local Git history. GitHub PR and GitLab MR URLs are unsupported;
  missing history must be fetched separately.
- Dependency analysis covers TypeScript and Go sources captured from the repository.
  External dependencies are not analyzed, and unresolved references can leave the
  map incomplete. Check the notices in the UI.
- Go multi-module repositories and `go.work` workspaces are unsupported.
- Unmerged indexes and working-tree comparisons in sparse checkouts are unsupported.
- Large repositories and dense maps can take substantial time and memory.

## Development

See [CONTRIBUTING.md](https://github.com/tapioca24/changemap/blob/main/CONTRIBUTING.md)
for development, testing, packaging, and benchmark instructions.
