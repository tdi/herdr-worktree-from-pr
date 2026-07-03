# Worktree from PR — herdr plugin

Keybind, pick an open GitHub PR from the current repo, and herdr opens a git
worktree checked out to that PR's branch. Worktree only — pair it with
[worktree-setup](https://github.com/tdi/herdr-worktree-setup) to run per-repo
setup steps automatically on `worktree.created`.

## Install

```bash
herdr plugin install tdi/herdr-worktree-from-pr
```

Requires the `gh` CLI (authenticated) and `git`. `fzf` is used for the picker
if present; otherwise a built-in numbered prompt is used.

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
