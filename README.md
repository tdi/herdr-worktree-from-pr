# Worktree from PR — herdr plugin

Keybind, pick an open GitHub PR from the current repo, and herdr opens a git
worktree checked out to that PR's branch. Worktree only — pair it with
[worktree-setup](https://github.com/tdi/herdr-worktree-setup) to run per-repo
setup steps automatically on `worktree.created`.

## Install

```bash
herdr plugin install tdi/herdr-worktree-from-pr
```

### Prerequisites

- **`fzf`** — the fuzzy picker (`brew install fzf`). Required for the intended
  overlay experience. Without it the plugin falls back to a plain numbered
  prompt, but `fzf` is what you want.
- **`gh`** — the GitHub CLI, authenticated (`gh auth login`).
- **`git`**.
- **Node.js** — to run the plugin (herdr invokes `node`).

## Use

Bind the `Worktree from GitHub PR` action to a key, or invoke it from the
plugin action menu. It opens an overlay listing the current repo's open PRs;
pick one and herdr creates + focuses the worktree.

- Same-repo PR: checks out its real head branch (tracking origin).
- Fork PR: fetches `pull/<N>/head` into a local `pr-<N>` branch (review copy).
- If a worktree for that branch already exists, it is opened instead of recreated.

## Configure (optional)

`config.json` in the plugin config dir (`herdr plugin config-dir tdi.worktree-from-pr`):

```json
{
  "prLimit": 50,
  "forkBranchPrefix": "pr-",
  "placement": "right",
  "fzfLayout": "down",
  "popupWidth": "80%",
  "popupHeight": "70%"
}
```

- `prLimit` — max PRs listed (default 50).
- `forkBranchPrefix` — local branch prefix for fork PRs (default `pr-`).
- `placement` — where the picker pane opens: `"right"` (default), `"left"`,
  `"top"`, `"down"` (splits, so your work stays visible), `"overlay"`
  (full-screen), or `"popup"` (centered floating window). `left`/`top` open a
  right/down split then swap into place.
- `fzfLayout` — `"down"` (default, search bar at the bottom) or `"top"` (search bar at the top). The picker renders as a compact window either way.
- `popupWidth` / `popupHeight` — size of the `popup` placement, as a percentage
  (`"80%"`) or a terminal-cell count (`120`). Only used when `placement` is
  `popup`. Defaults `80%` × `70%`.

`popup` opens the picker as a centered floating window that doesn't disturb your
pane layout — it requires **herdr ≥ 0.7.4** (older servers reject it; the plugin
still works with the other placements).

## Develop

```bash
npm test
```
