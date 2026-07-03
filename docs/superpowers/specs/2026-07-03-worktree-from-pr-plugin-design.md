# Worktree from PR — Herdr Plugin Design

**Date:** 2026-07-03
**Status:** Approved (design)
**Pattern reference:** [ogulcancelik/herdr-plugin-github-start](https://github.com/ogulcancelik/herdr-plugin-github-start) — action → interactive overlay pane → drive the herdr CLI.

## Problem

Reviewing a GitHub PR means checking it out locally without disturbing the current checkout. Doing this by hand each time (`gh pr view`, fetch the branch, `git worktree add`, open it) is repetitive. Herdr already manages worktrees as first-class workspaces; a plugin can turn "pick a PR" into "worktree open and focused."

## Goal

Keybind → pick an open PR from the current repo → create a git worktree on that PR's branch → open and focus it. Worktree only. Setup steps are out of scope: the separate `tdi.worktree-setup` plugin fires on `worktree.created` and runs per-repo setup, so this plugin composes with it rather than duplicating it.

Non-goals (YAGNI):
- Starting an agent in the new worktree (github-start does this; here we stop at the worktree).
- Teardown / closing worktrees.
- Non-GitHub forges.
- Windows in v0.1.0 (target tooling is `gh` + unix shell; declare `platforms = ["linux", "macos"]`).

## Decisions (from brainstorming)

| Fork | Decision |
|------|----------|
| End state | Worktree only; open + focus. Compose with `tdi.worktree-setup`. |
| Invocation | Keybindable action opens an interactive overlay pane listing open PRs. |
| PR source | Current repo, resolved from `HERDR_PLUGIN_CONTEXT_JSON` (focused pane cwd → workspace cwd). |
| Picker | `fzf` if on PATH, else a zero-dep Node picker; both consume the same formatted lines. |
| Branch (same-repo PR) | Check out the real head branch, tracking origin (pushable). |
| Branch (fork PR) | Fetch `pull/<N>/head` into `pr-<N>` (read-only review branch). |
| Already-exists | If a worktree for that branch exists, open + focus it instead of failing. |
| Language | Node.js (ESM), zero runtime deps (matches github-start's ethos). |

## Plugin manifest (`herdr-plugin.toml`)

```toml
id = "tdi.worktree-from-pr"
name = "Worktree from PR"
version = "0.1.0"
min_herdr_version = "0.7.0"
description = "Create a git worktree from a GitHub PR and open it as a workspace"
platforms = ["linux", "macos"]

[[actions]]
id = "pick"
title = "Worktree from GitHub PR"
contexts = ["workspace", "tab", "pane"]
command = ["node", "bin/open.js"]

[[panes]]
id = "picker"
title = "Pick a PR"
placement = "overlay"
command = ["node", "bin/picker.js"]
```

- `open.js` is the keybindable action; it opens the `picker` overlay pane. Kept separate because the picker needs an interactive TTY overlay (an action command runs headless).

## Runtime flow

**`bin/open.js`** (trivial): runs, via `HERDR_BIN_PATH`,
`herdr plugin pane open --plugin tdi.worktree-from-pr --entrypoint picker --placement overlay --focus`
and exits with that command's status.

**`bin/picker.js`** (orchestrator over the `lib/` modules):

1. **Resolve repo** (`lib/repo.js`) — parse `HERDR_PLUGIN_CONTEXT_JSON`; take `focused_pane_cwd`, else `workspace_cwd`, else `process.cwd()`. Run `git -C <cwd> rev-parse --show-toplevel` → repo root. Verify `gh` is on PATH and the repo has a GitHub remote (`gh repo view` succeeds). On failure, print a clear message and exit non-zero.
2. **List PRs** (`lib/gh.js`) — `gh pr list --state open --json number,title,headRefName,author,isCrossRepository,url --limit <prLimit>` in the repo; parse into records `{ number, title, headRefName, authorLogin, isCrossRepository, url }`.
3. **Pick** (`lib/picker.js`) — format one line per PR (`#<number>  <title>  (<branch>) @<author>`); if `fzf` is on PATH, pipe the lines to `fzf` and read the chosen line; else render a numbered list and read a selection via Node `readline`. Map the chosen line back to its PR record (line↔record index kept alongside).
4. **Resolve branch** (`lib/branch.js`, pure) — given a PR record, return `{ fetchRefspec, branchName }`:
   - same-repo (`isCrossRepository === false`): `{ fetchRefspec: "<headRefName>", branchName: "<headRefName>" }`.
   - fork (`isCrossRepository === true`): `{ fetchRefspec: "pull/<number>/head:<forkBranchPrefix><number>", branchName: "<forkBranchPrefix><number>" }`.
5. **Create/open worktree** (`lib/worktree.js`) —
   - `git -C <repo> fetch origin <fetchRefspec>`.
   - If a worktree for `branchName` already exists (`git -C <repo> worktree list --porcelain` contains it), run `herdr worktree open --cwd <repo> --branch <branchName> --focus --json`.
   - Else `herdr worktree create --cwd <repo> --branch <branchName> --focus --json`.
   - Herdr opens + focuses the new workspace; the overlay closes.

## Module boundaries

| File | Responsibility | Depends on |
|------|----------------|-----------|
| `bin/open.js` | open the picker overlay pane | `HERDR_BIN_PATH` |
| `bin/picker.js` | orchestrate resolve → list → pick → create; own exit codes and user messages | the `lib/` modules |
| `lib/repo.js` | repo root + GitHub-remote validation from context/cwd | `child_process`, `HERDR_PLUGIN_CONTEXT_JSON` |
| `lib/gh.js` | run `gh pr list`, parse JSON → PR records | `child_process`, `gh` |
| `lib/branch.js` | PR record → `{ fetchRefspec, branchName }` (pure) | config (`forkBranchPrefix`) |
| `lib/worktree.js` | fetch + worktree-exists check + `herdr worktree create`/`open` | `child_process`, `HERDR_BIN_PATH`, `git` |
| `lib/picker.js` | fzf-or-Node selection over formatted lines; format + reverse-map | `child_process` (fzf), `readline` |
| `lib/config.js` | load optional `config.json`; defaults | `fs` |

The pure/parse-heavy units (`branch.js`, `gh.js` parsing, `picker.js` format/reverse-map, `config.js`) are testable without herdr, gh, or a TTY. The exec wrappers stay thin.

## Config (optional `config.json` in `HERDR_PLUGIN_CONFIG_DIR`)

```json
{
  "prLimit": 50,
  "forkBranchPrefix": "pr-"
}
```

Both optional; defaults `prLimit = 50`, `forkBranchPrefix = "pr-"`. Works with no config file.

## Error handling

| Condition | Behavior |
|-----------|----------|
| `gh` not on PATH / not authenticated | message, exit non-zero |
| cwd not a git repo, or no GitHub remote | message, exit non-zero |
| no open PRs | message ("no open PRs"), exit 0 |
| user cancels the picker (fzf ESC / empty select) | exit 0, no-op |
| `git fetch` fails | message with the git error, exit non-zero |
| worktree create/open fails | message with the herdr error, exit non-zero |

Messages print to the overlay pane before it closes.

## Testing (node:test + node:assert)

- **branch.test.js** — same-repo PR → `{ fetchRefspec: headRef, branchName: headRef }`; fork PR → `pull/N/head:pr-N` + `pr-N`; custom `forkBranchPrefix` honored.
- **gh.test.js** — sample `gh pr list --json` output → parsed records; empty list → `[]`; malformed JSON → clear error.
- **picker.test.js** — records → formatted lines; a chosen line maps back to the correct record (including titles containing spaces / `#`).
- **config.test.js** — missing file → defaults; partial file → merged with defaults.
- **worktree.test.js** — `git worktree list --porcelain` sample → exists/not-exists decision; correct `herdr worktree create` vs `open` argv built for each case (injected exec).

gh/git/herdr/fzf/TTY interactions are exercised against captured sample outputs or injected fakes, never a live herdr.

## Repository structure

```
herdr-plugin.toml
package.json
config.example.json
README.md
bin/   open.js  picker.js
lib/   repo.js  gh.js  branch.js  worktree.js  picker.js  config.js
test/  branch.test.js  gh.test.js  picker.test.js  config.test.js  worktree.test.js
```

## Open runtime unknowns (handled defensively, not blockers)

- Exact `HERDR_PLUGIN_CONTEXT_JSON` field for the invoking cwd — probe `focused_pane_cwd` then `workspace_cwd` then `process.cwd()` (field names observed on herdr 0.7.1 context payloads).
- `herdr worktree open` flag surface for an existing branch — verified against the live CLI during implementation; fallback to `create` error-handling if `open` differs.
