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
  "forkBranchPrefix": "pr-"
}
```

## Develop

```bash
npm test
```
