# Worktree from PR Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a herdr plugin that lists the current repo's open GitHub PRs in an overlay picker and creates+focuses a git worktree on the chosen PR's branch.

**Architecture:** A keybindable action (`bin/open.js`) opens an interactive overlay pane (`bin/picker.js`). The picker's orchestration lives in `lib/run.js`, which takes an injected command-runner and selector so the whole flow is testable without live `gh`/`git`/`herdr`/`fzf`. Pure helpers (branch resolution, gh-JSON parsing, line formatting, config, worktree-exists) sit in focused `lib/` modules.

**Tech Stack:** Node.js (ESM), zero runtime deps, `node:test` + `node:assert`, `gh` CLI, `git`, herdr CLI via `HERDR_BIN_PATH`, optional `fzf`.

## Global Constraints

- `id = "tdi.worktree-from-pr"`; manifest is `herdr-plugin.toml`; `min_herdr_version = "0.7.0"`.
- `platforms = ["linux", "macos"]`.
- Node ESM: `package.json` has `"type": "module"`. **Zero** runtime dependencies.
- Call herdr via `HERDR_BIN_PATH` (fallback `"herdr"`). Use `gh` and `git` from PATH.
- Config lives at `$HERDR_PLUGIN_CONFIG_DIR/config.json`; defaults `prLimit = 50`, `forkBranchPrefix = "pr-"`.
- Fork PR → fetch `pull/<N>/head:<prefix><N>`, branch `<prefix><N>`. Same-repo PR → fetch `<headRefName>:<headRefName>`, branch `<headRefName>`.
- No emojis. No co-author trailers in commits. Prefer Node built-ins.
- Test script is `node --test`.

## File Structure

| File | Responsibility |
|------|----------------|
| `herdr-plugin.toml` | manifest: `[[actions]] pick` → `bin/open.js`; `[[panes]] picker` → `bin/picker.js` |
| `package.json` | ESM, no deps, `test` script |
| `lib/exec.js` | `runCmd` — spawnSync wrapper returning `{status,stdout,stderr}` |
| `lib/config.js` | load `config.json`, merge defaults |
| `lib/branch.js` | PR record → `{ fetchRefspec, branchName }` (pure) |
| `lib/gh.js` | parse `gh pr list` JSON; `listPrs` exec wrapper |
| `lib/picker.js` | format lines, map line→PR, fzf-or-Node `select` |
| `lib/pane.js` | `openPickerArgs` (pure) — argv to open the overlay |
| `lib/repo.js` | resolve repo root from context cwd; GitHub-remote check |
| `lib/worktree.js` | worktree-exists check, argv builder, fetch+create/open |
| `lib/run.js` | orchestrator `run({env,exec,select,log})` |
| `bin/open.js` | action: open the picker overlay pane |
| `bin/picker.js` | pane entry: call `run`, map errors to exit code |
| `config.example.json` | sample config |
| `README.md` | install + usage |

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `herdr-plugin.toml`, `.gitignore`, `config.example.json`, `test/smoke.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: runnable project — `npm test` runs `node --test`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "herdr-worktree-from-pr",
  "version": "0.1.0",
  "description": "Create a git worktree from a GitHub PR and open it as a herdr workspace",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Create `herdr-plugin.toml`**

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

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
*.log
```

- [ ] **Step 4: Create `config.example.json`**

```json
{
  "prLimit": 50,
  "forkBranchPrefix": "pr-"
}
```

- [ ] **Step 5: Write `test/smoke.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('node test runner works', () => {
  assert.equal(1 + 1, 2);
});
```

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: PASS (1 test).

- [ ] **Step 7: Commit**

```bash
git add package.json herdr-plugin.toml .gitignore config.example.json test/smoke.test.js
git commit -m "chore: scaffold worktree-from-pr plugin"
```

---

## Task 2: exec + config utilities

**Files:**
- Create: `lib/exec.js`, `lib/config.js`
- Test: `test/exec.test.js`, `test/config.test.js`

**Interfaces:**
- Produces:
  - `runCmd(cmd: string, args: string[], opts?: object) => { status: number, stdout: string, stderr: string }`
  - `loadConfig(configDir?: string) => { prLimit: number, forkBranchPrefix: string, ...overrides }`

- [ ] **Step 1: Write `test/exec.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCmd } from '../lib/exec.js';

test('runCmd returns status and stdout for a simple command', () => {
  const res = runCmd('printf', ['hello']);
  assert.equal(res.status, 0);
  assert.equal(res.stdout, 'hello');
});

test('runCmd reports non-zero status', () => {
  const res = runCmd('sh', ['-c', 'exit 3']);
  assert.equal(res.status, 3);
});
```

- [ ] **Step 2: Write `test/config.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../lib/config.js';

test('loadConfig returns defaults when no dir or file', () => {
  assert.deepEqual(loadConfig(undefined), { prLimit: 50, forkBranchPrefix: 'pr-' });
  const dir = mkdtempSync(join(tmpdir(), 'wfp-'));
  assert.deepEqual(loadConfig(dir), { prLimit: 50, forkBranchPrefix: 'pr-' });
  rmSync(dir, { recursive: true, force: true });
});

test('loadConfig merges a partial config over defaults', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wfp-'));
  writeFileSync(join(dir, 'config.json'), '{"prLimit": 10}');
  assert.deepEqual(loadConfig(dir), { prLimit: 10, forkBranchPrefix: 'pr-' });
  rmSync(dir, { recursive: true, force: true });
});

test('loadConfig throws a clear error on malformed JSON', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wfp-'));
  writeFileSync(join(dir, 'config.json'), '{bad');
  assert.throws(() => loadConfig(dir), /invalid config\.json/);
  rmSync(dir, { recursive: true, force: true });
});
```

- [ ] **Step 3: Run to verify both fail**

Run: `node --test test/exec.test.js test/config.test.js`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement `lib/exec.js`**

```js
import { spawnSync } from 'node:child_process';

export function runCmd(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  return {
    status: res.status ?? 1,
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
  };
}
```

- [ ] **Step 5: Implement `lib/config.js`**

```js
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULTS = { prLimit: 50, forkBranchPrefix: 'pr-' };

export function loadConfig(configDir) {
  if (!configDir) return { ...DEFAULTS };
  let text;
  try {
    text = readFileSync(join(configDir, 'config.json'), 'utf8');
  } catch {
    return { ...DEFAULTS };
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`worktree-from-pr: invalid config.json: ${err.message}`);
  }
  return { ...DEFAULTS, ...parsed };
}
```

- [ ] **Step 6: Run to verify pass**

Run: `node --test test/exec.test.js test/config.test.js`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add lib/exec.js lib/config.js test/exec.test.js test/config.test.js
git commit -m "feat: exec wrapper and config loading"
```

---

## Task 3: Branch resolution

**Files:**
- Create: `lib/branch.js`
- Test: `test/branch.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `resolveBranch(pr: {number, headRefName, isCrossRepository}, config?: {forkBranchPrefix}) => { fetchRefspec: string, branchName: string }`

- [ ] **Step 1: Write `test/branch.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveBranch } from '../lib/branch.js';

test('same-repo PR fetches head branch into a like-named local branch', () => {
  const pr = { number: 12, headRefName: 'feature/x', isCrossRepository: false };
  assert.deepEqual(resolveBranch(pr, { forkBranchPrefix: 'pr-' }), {
    fetchRefspec: 'feature/x:feature/x',
    branchName: 'feature/x',
  });
});

test('fork PR fetches pull/N/head into a prefixed local branch', () => {
  const pr = { number: 542, headRefName: 'their-branch', isCrossRepository: true };
  assert.deepEqual(resolveBranch(pr, { forkBranchPrefix: 'pr-' }), {
    fetchRefspec: 'pull/542/head:pr-542',
    branchName: 'pr-542',
  });
});

test('fork prefix is configurable and defaults to pr-', () => {
  const pr = { number: 7, headRefName: 'x', isCrossRepository: true };
  assert.equal(resolveBranch(pr, { forkBranchPrefix: 'review/' }).branchName, 'review/7');
  assert.equal(resolveBranch(pr).branchName, 'pr-7');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/branch.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/branch.js`**

```js
export function resolveBranch(pr, config = {}) {
  const prefix = config.forkBranchPrefix ?? 'pr-';
  if (pr.isCrossRepository) {
    const branchName = `${prefix}${pr.number}`;
    return { fetchRefspec: `pull/${pr.number}/head:${branchName}`, branchName };
  }
  return { fetchRefspec: `${pr.headRefName}:${pr.headRefName}`, branchName: pr.headRefName };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test test/branch.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/branch.js test/branch.test.js
git commit -m "feat: PR-to-branch resolution (same-repo vs fork)"
```

---

## Task 4: gh PR listing

**Files:**
- Create: `lib/gh.js`
- Test: `test/gh.test.js`

**Interfaces:**
- Consumes: `runCmd` from `lib/exec.js`.
- Produces:
  - `parsePrList(stdout: string) => Array<{number, title, headRefName, authorLogin, isCrossRepository, url}>`
  - `listPrs(repoRoot: string, limit: number, exec?) => Pr[]` (throws with a clear message on gh failure)

- [ ] **Step 1: Write `test/gh.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePrList, listPrs } from '../lib/gh.js';

const SAMPLE = JSON.stringify([
  { number: 5, title: 'Fix thing', headRefName: 'fix/thing', author: { login: 'alice' }, isCrossRepository: false, url: 'u5' },
  { number: 9, title: 'Add feature #9', headRefName: 'feat', author: { login: 'bob' }, isCrossRepository: true, url: 'u9' },
]);

test('parsePrList maps gh json into records', () => {
  const prs = parsePrList(SAMPLE);
  assert.equal(prs.length, 2);
  assert.deepEqual(prs[0], { number: 5, title: 'Fix thing', headRefName: 'fix/thing', authorLogin: 'alice', isCrossRepository: false, url: 'u5' });
  assert.equal(prs[1].isCrossRepository, true);
  assert.equal(prs[1].authorLogin, 'bob');
});

test('parsePrList returns [] for empty or malformed input', () => {
  assert.deepEqual(parsePrList('[]'), []);
  assert.deepEqual(parsePrList('not json'), []);
  assert.deepEqual(parsePrList('{}'), []);
});

test('listPrs invokes gh with the right args and returns records', () => {
  const calls = [];
  const exec = (cmd, args, opts) => { calls.push({ cmd, args, opts }); return { status: 0, stdout: SAMPLE, stderr: '' }; };
  const prs = listPrs('/repo', 50, exec);
  assert.equal(prs.length, 2);
  assert.equal(calls[0].cmd, 'gh');
  assert.deepEqual(calls[0].args, ['pr', 'list', '--state', 'open', '--json', 'number,title,headRefName,author,isCrossRepository,url', '--limit', '50']);
  assert.equal(calls[0].opts.cwd, '/repo');
});

test('listPrs throws a clear error when gh fails', () => {
  const exec = () => ({ status: 1, stdout: '', stderr: 'gh: not authenticated' });
  assert.throws(() => listPrs('/repo', 50, exec), /gh pr list failed: gh: not authenticated/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/gh.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/gh.js`**

```js
import { runCmd } from './exec.js';

export function parsePrList(stdout) {
  let arr;
  try {
    arr = JSON.parse(stdout);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  return arr.map((p) => ({
    number: p.number,
    title: p.title ?? '',
    headRefName: p.headRefName ?? '',
    authorLogin: p.author?.login ?? '',
    isCrossRepository: Boolean(p.isCrossRepository),
    url: p.url ?? '',
  }));
}

export function listPrs(repoRoot, limit, exec = runCmd) {
  const res = exec(
    'gh',
    ['pr', 'list', '--state', 'open', '--json', 'number,title,headRefName,author,isCrossRepository,url', '--limit', String(limit)],
    { cwd: repoRoot },
  );
  if (res.status !== 0) {
    throw new Error(`worktree-from-pr: gh pr list failed: ${res.stderr.trim() || 'unknown error'}`);
  }
  return parsePrList(res.stdout);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test test/gh.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/gh.js test/gh.test.js
git commit -m "feat: gh pr list parsing and fetching"
```

---

## Task 5: Picker (format + select)

**Files:**
- Create: `lib/picker.js`
- Test: `test/picker.test.js`

**Interfaces:**
- Consumes: `runCmd` from `lib/exec.js`.
- Produces:
  - `formatLine(pr) => string`, `formatLines(prs) => string[]`
  - `lineToPr(line: string, prs) => pr | null` (matches leading `#<number>`)
  - `select(prs, { exec? }) => Promise<pr | null>` (fzf if present, else Node numbered prompt; `null` on cancel/empty)

- [ ] **Step 1: Write `test/picker.test.js`** (pure helpers only)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatLine, formatLines, lineToPr } from '../lib/picker.js';

const PRS = [
  { number: 5, title: 'Fix thing', headRefName: 'fix/thing', authorLogin: 'alice', isCrossRepository: false },
  { number: 9, title: 'Add feature #9', headRefName: 'feat', authorLogin: 'bob', isCrossRepository: true },
];

test('formatLine starts with #number and marks forks', () => {
  assert.match(formatLine(PRS[0]), /^#5\s+Fix thing\s+\(fix\/thing\) @alice$/);
  assert.match(formatLine(PRS[1]), /^#9\s+Add feature #9\s+\(feat\) @bob \[fork\]$/);
});

test('lineToPr maps a chosen line back to its PR by leading number', () => {
  const lines = formatLines(PRS);
  assert.equal(lineToPr(lines[0], PRS).number, 5);
  assert.equal(lineToPr(lines[1], PRS).number, 9);           // title contains '#9' but leading token wins
  assert.equal(lineToPr('', PRS), null);
  assert.equal(lineToPr('#404 gone', PRS), null);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/picker.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/picker.js`**

```js
import { createInterface } from 'node:readline';
import { runCmd } from './exec.js';

export function formatLine(pr) {
  const fork = pr.isCrossRepository ? ' [fork]' : '';
  return `#${pr.number}  ${pr.title}  (${pr.headRefName}) @${pr.authorLogin}${fork}`;
}

export function formatLines(prs) {
  return prs.map(formatLine);
}

export function lineToPr(line, prs) {
  const m = /^#(\d+)\b/.exec(line || '');
  if (!m) return null;
  const num = Number(m[1]);
  return prs.find((p) => p.number === num) ?? null;
}

function hasFzf(exec) {
  return exec('sh', ['-c', 'command -v fzf']).status === 0;
}

function nodeSelect(prs, lines) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    lines.forEach((l, i) => process.stdout.write(`  ${i + 1}) ${l}\n`));
    rl.question('Select a PR number (or blank to cancel): ', (answer) => {
      rl.close();
      const idx = Number(answer.trim()) - 1;
      resolve(Number.isInteger(idx) && idx >= 0 && idx < prs.length ? prs[idx] : null);
    });
  });
}

export async function select(prs, { exec = runCmd } = {}) {
  if (!prs.length) return null;
  const lines = formatLines(prs);
  if (hasFzf(exec)) {
    const res = exec('fzf', ['--prompt', 'PR> '], { input: lines.join('\n') });
    if (res.status !== 0) return null;
    return lineToPr(res.stdout.trim(), prs);
  }
  return nodeSelect(prs, lines);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test test/picker.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/picker.js test/picker.test.js
git commit -m "feat: PR picker formatting and fzf/node selection"
```

---

## Task 6: Repo resolution

**Files:**
- Create: `lib/repo.js`
- Test: `test/repo.test.js`

**Interfaces:**
- Consumes: `runCmd` from `lib/exec.js`.
- Produces:
  - `parseContextCwd(contextJson?: string, fallbackCwd: string) => string`
  - `resolveRepo(env, exec?) => { repoRoot: string }` (throws with a clear message)

- [ ] **Step 1: Write `test/repo.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseContextCwd, resolveRepo } from '../lib/repo.js';

test('parseContextCwd prefers focused_pane_cwd, then workspace_cwd, then fallback', () => {
  assert.equal(parseContextCwd(JSON.stringify({ focused_pane_cwd: '/a', workspace_cwd: '/b' }), '/f'), '/a');
  assert.equal(parseContextCwd(JSON.stringify({ workspace_cwd: '/b' }), '/f'), '/b');
  assert.equal(parseContextCwd(undefined, '/f'), '/f');
  assert.equal(parseContextCwd('not json', '/f'), '/f');
});

test('resolveRepo returns the git toplevel when gh remote is present', () => {
  const env = { HERDR_PLUGIN_CONTEXT_JSON: JSON.stringify({ focused_pane_cwd: '/work/repo/sub' }) };
  const exec = (cmd, args) => {
    if (cmd === 'git' && args.includes('--show-toplevel')) return { status: 0, stdout: '/work/repo\n', stderr: '' };
    if (cmd === 'gh') return { status: 0, stdout: '{"nameWithOwner":"o/r"}', stderr: '' };
    return { status: 1, stdout: '', stderr: '' };
  };
  assert.deepEqual(resolveRepo(env, exec), { repoRoot: '/work/repo' });
});

test('resolveRepo throws when not a git repo', () => {
  const exec = () => ({ status: 1, stdout: '', stderr: 'fatal' });
  assert.throws(() => resolveRepo({}, exec), /not inside a git repository/);
});

test('resolveRepo throws when gh has no repo/remote', () => {
  const exec = (cmd, args) => {
    if (cmd === 'git' && args.includes('--show-toplevel')) return { status: 0, stdout: '/work/repo\n', stderr: '' };
    return { status: 1, stdout: '', stderr: 'no remote' };
  };
  assert.throws(() => resolveRepo({}, exec), /no GitHub repo\/remote/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/repo.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/repo.js`**

```js
import { runCmd } from './exec.js';

export function parseContextCwd(contextJson, fallbackCwd) {
  let ctx = null;
  try {
    ctx = contextJson ? JSON.parse(contextJson) : null;
  } catch {
    ctx = null;
  }
  if (ctx) {
    if (typeof ctx.focused_pane_cwd === 'string' && ctx.focused_pane_cwd) return ctx.focused_pane_cwd;
    if (typeof ctx.workspace_cwd === 'string' && ctx.workspace_cwd) return ctx.workspace_cwd;
  }
  return fallbackCwd;
}

export function resolveRepo(env, exec = runCmd) {
  const cwd = parseContextCwd(env.HERDR_PLUGIN_CONTEXT_JSON, env.PWD || process.cwd());
  const top = exec('git', ['-C', cwd, 'rev-parse', '--show-toplevel']);
  if (top.status !== 0) {
    throw new Error('worktree-from-pr: not inside a git repository');
  }
  const repoRoot = top.stdout.trim();
  const gh = exec('gh', ['repo', 'view', '--json', 'nameWithOwner'], { cwd: repoRoot });
  if (gh.status !== 0) {
    throw new Error('worktree-from-pr: no GitHub repo/remote here (is gh authenticated?)');
  }
  return { repoRoot };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test test/repo.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/repo.js test/repo.test.js
git commit -m "feat: resolve repo root and validate GitHub remote"
```

---

## Task 7: Worktree create/open

**Files:**
- Create: `lib/worktree.js`
- Test: `test/worktree.test.js`

**Interfaces:**
- Consumes: `runCmd` from `lib/exec.js`.
- Produces:
  - `worktreeExistsForBranch(porcelain: string, branchName: string) => boolean`
  - `buildWorktreeArgs(exists: boolean, repoRoot: string, branchName: string) => string[]`
  - `createOrOpenWorktree(repoRoot, fetchRefspec, branchName, exec?, herdrBin?) => { exists, branchName, args, stdout }` (throws with a clear message)

- [ ] **Step 1: Write `test/worktree.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { worktreeExistsForBranch, buildWorktreeArgs, createOrOpenWorktree } from '../lib/worktree.js';

const PORCELAIN = [
  'worktree /repo',
  'HEAD abc',
  'branch refs/heads/main',
  '',
  'worktree /repo-wt/pr-9',
  'HEAD def',
  'branch refs/heads/pr-9',
  '',
].join('\n');

test('worktreeExistsForBranch detects an existing branch worktree', () => {
  assert.equal(worktreeExistsForBranch(PORCELAIN, 'pr-9'), true);
  assert.equal(worktreeExistsForBranch(PORCELAIN, 'main'), true);
  assert.equal(worktreeExistsForBranch(PORCELAIN, 'pr-10'), false);
});

test('buildWorktreeArgs picks create vs open', () => {
  assert.deepEqual(buildWorktreeArgs(false, '/repo', 'pr-9'), ['worktree', 'create', '--cwd', '/repo', '--branch', 'pr-9', '--focus', '--json']);
  assert.deepEqual(buildWorktreeArgs(true, '/repo', 'pr-9'), ['worktree', 'open', '--cwd', '/repo', '--branch', 'pr-9', '--focus', '--json']);
});

test('createOrOpenWorktree fetches then creates when no existing worktree', () => {
  const calls = [];
  const exec = (cmd, args) => {
    calls.push([cmd, ...args]);
    if (cmd === 'git' && args.includes('list')) return { status: 0, stdout: 'worktree /repo\nbranch refs/heads/main\n', stderr: '' };
    return { status: 0, stdout: '{}', stderr: '' };
  };
  const res = createOrOpenWorktree('/repo', 'pull/9/head:pr-9', 'pr-9', exec, 'herdr');
  assert.equal(res.exists, false);
  assert.ok(calls.some((c) => c[0] === 'git' && c.includes('fetch') && c.includes('pull/9/head:pr-9')));
  assert.deepEqual(res.args, ['worktree', 'create', '--cwd', '/repo', '--branch', 'pr-9', '--focus', '--json']);
});

test('createOrOpenWorktree opens without fetching when the worktree exists', () => {
  const calls = [];
  const exec = (cmd, args) => {
    calls.push([cmd, ...args]);
    if (cmd === 'git' && args.includes('list')) return { status: 0, stdout: 'worktree /repo\nbranch refs/heads/main\n\nworktree /w/pr-9\nbranch refs/heads/pr-9\n', stderr: '' };
    return { status: 0, stdout: '{}', stderr: '' };
  };
  const res = createOrOpenWorktree('/repo', 'pull/9/head:pr-9', 'pr-9', exec, 'herdr');
  assert.equal(res.exists, true);
  assert.equal(calls.some((c) => c.includes('fetch')), false);
  assert.deepEqual(res.args, ['worktree', 'open', '--cwd', '/repo', '--branch', 'pr-9', '--focus', '--json']);
});

test('createOrOpenWorktree throws when fetch fails', () => {
  const exec = (cmd, args) => {
    if (cmd === 'git' && args.includes('list')) return { status: 0, stdout: 'worktree /repo\n', stderr: '' };
    if (cmd === 'git' && args.includes('fetch')) return { status: 1, stdout: '', stderr: 'could not fetch' };
    return { status: 0, stdout: '', stderr: '' };
  };
  assert.throws(() => createOrOpenWorktree('/repo', 'x:x', 'x', exec, 'herdr'), /git fetch failed: could not fetch/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/worktree.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/worktree.js`**

```js
import { runCmd } from './exec.js';

export function worktreeExistsForBranch(porcelain, branchName) {
  const target = `branch refs/heads/${branchName}`;
  return porcelain.split('\n').some((l) => l.trim() === target);
}

export function buildWorktreeArgs(exists, repoRoot, branchName) {
  const verb = exists ? 'open' : 'create';
  return ['worktree', verb, '--cwd', repoRoot, '--branch', branchName, '--focus', '--json'];
}

export function createOrOpenWorktree(repoRoot, fetchRefspec, branchName, exec = runCmd, herdrBin = 'herdr') {
  const list = exec('git', ['-C', repoRoot, 'worktree', 'list', '--porcelain']);
  const exists = list.status === 0 && worktreeExistsForBranch(list.stdout, branchName);
  if (!exists) {
    const fetch = exec('git', ['-C', repoRoot, 'fetch', 'origin', fetchRefspec]);
    if (fetch.status !== 0) {
      throw new Error(`worktree-from-pr: git fetch failed: ${fetch.stderr.trim() || 'unknown error'}`);
    }
  }
  const args = buildWorktreeArgs(exists, repoRoot, branchName);
  const wt = exec(herdrBin, args);
  if (wt.status !== 0) {
    throw new Error(`worktree-from-pr: herdr worktree ${exists ? 'open' : 'create'} failed: ${wt.stderr.trim() || 'unknown error'}`);
  }
  return { exists, branchName, args, stdout: wt.stdout };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test test/worktree.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/worktree.js test/worktree.test.js
git commit -m "feat: fetch PR branch and create/open worktree"
```

---

## Task 8: Orchestrator + entrypoints

**Files:**
- Create: `lib/run.js`, `lib/pane.js`, `bin/open.js`, `bin/picker.js`
- Test: `test/run.test.js`, `test/pane.test.js`

**Interfaces:**
- Consumes: `loadConfig`, `resolveRepo`, `listPrs`, `resolveBranch`, `createOrOpenWorktree`, `select`, `runCmd`.
- Produces:
  - `run({ env?, exec?, select?, log? }) => Promise<number>` (exit code; throws on hard failure)
  - `openPickerArgs(pluginId?: string) => string[]`

- [ ] **Step 1: Write `test/pane.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openPickerArgs } from '../lib/pane.js';

test('openPickerArgs targets the picker overlay entrypoint', () => {
  assert.deepEqual(openPickerArgs('tdi.worktree-from-pr'), [
    'plugin', 'pane', 'open', '--plugin', 'tdi.worktree-from-pr', '--entrypoint', 'picker', '--placement', 'overlay', '--focus',
  ]);
});

test('openPickerArgs falls back to the default plugin id', () => {
  assert.equal(openPickerArgs()[4], 'tdi.worktree-from-pr');
});
```

- [ ] **Step 2: Write `test/run.test.js`** (whole flow with an injected fake exec + select)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../lib/run.js';

function fakeExec(prsJson) {
  const calls = [];
  const exec = (cmd, args = []) => {
    calls.push([cmd, ...args]);
    if (cmd === 'git' && args.includes('--show-toplevel')) return { status: 0, stdout: '/repo\n', stderr: '' };
    if (cmd === 'gh' && args.includes('repo')) return { status: 0, stdout: '{"nameWithOwner":"o/r"}', stderr: '' };
    if (cmd === 'gh' && args.includes('pr')) return { status: 0, stdout: prsJson, stderr: '' };
    if (cmd === 'git' && args.includes('list')) return { status: 0, stdout: 'worktree /repo\nbranch refs/heads/main\n', stderr: '' };
    if (cmd === 'git' && args.includes('fetch')) return { status: 0, stdout: '', stderr: '' };
    if (args[0] === 'worktree') return { status: 0, stdout: '{"type":"worktree_created"}', stderr: '' };
    return { status: 0, stdout: '', stderr: '' };
  };
  return { exec, calls };
}

test('run creates a worktree for the selected fork PR', async () => {
  const prs = JSON.stringify([{ number: 9, title: 'F', headRefName: 'x', author: { login: 'b' }, isCrossRepository: true, url: 'u' }]);
  const { exec, calls } = fakeExec(prs);
  const select = async (list) => list[0];
  const logs = [];
  const code = await run({ env: { HERDR_PLUGIN_CONTEXT_JSON: '{}', HERDR_BIN_PATH: 'herdr' }, exec, select, log: (m) => logs.push(m) });
  assert.equal(code, 0);
  assert.ok(calls.some((c) => c.includes('fetch') && c.includes('pull/9/head:pr-9')), 'fetches the PR head ref');
  assert.ok(calls.some((c) => c[0] === 'herdr' && c.includes('create') && c.includes('pr-9')), 'creates the worktree');
});

test('run is a no-op (exit 0) when there are no open PRs', async () => {
  const { exec } = fakeExec('[]');
  const logs = [];
  const code = await run({ env: { HERDR_PLUGIN_CONTEXT_JSON: '{}' }, exec, select: async () => null, log: (m) => logs.push(m) });
  assert.equal(code, 0);
  assert.ok(logs.some((m) => /no open PRs/.test(m)));
});

test('run is a no-op when the user cancels the picker', async () => {
  const prs = JSON.stringify([{ number: 9, title: 'F', headRefName: 'x', author: { login: 'b' }, isCrossRepository: false, url: 'u' }]);
  const { exec, calls } = fakeExec(prs);
  const code = await run({ env: { HERDR_PLUGIN_CONTEXT_JSON: '{}' }, exec, select: async () => null, log: () => {} });
  assert.equal(code, 0);
  assert.equal(calls.some((c) => c.includes('fetch')), false);
});
```

- [ ] **Step 3: Run to verify both fail**

Run: `node --test test/run.test.js test/pane.test.js`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement `lib/pane.js`**

```js
export function openPickerArgs(pluginId = 'tdi.worktree-from-pr') {
  return ['plugin', 'pane', 'open', '--plugin', pluginId, '--entrypoint', 'picker', '--placement', 'overlay', '--focus'];
}
```

- [ ] **Step 5: Implement `lib/run.js`**

```js
import { loadConfig } from './config.js';
import { resolveRepo } from './repo.js';
import { listPrs } from './gh.js';
import { resolveBranch } from './branch.js';
import { createOrOpenWorktree } from './worktree.js';
import { select as defaultSelect } from './picker.js';
import { runCmd } from './exec.js';

export async function run({ env = process.env, exec = runCmd, select = defaultSelect, log = (m) => process.stderr.write(`${m}\n`) } = {}) {
  const config = loadConfig(env.HERDR_PLUGIN_CONFIG_DIR);
  const { repoRoot } = resolveRepo(env, exec);
  const prs = listPrs(repoRoot, config.prLimit, exec);
  if (prs.length === 0) {
    log('worktree-from-pr: no open PRs');
    return 0;
  }
  const pr = await select(prs, { exec });
  if (!pr) {
    log('worktree-from-pr: cancelled');
    return 0;
  }
  const { fetchRefspec, branchName } = resolveBranch(pr, config);
  const herdrBin = env.HERDR_BIN_PATH || 'herdr';
  const res = createOrOpenWorktree(repoRoot, fetchRefspec, branchName, exec, herdrBin);
  log(`worktree-from-pr: ${res.exists ? 'opened' : 'created'} worktree for #${pr.number} (${branchName})`);
  return 0;
}
```

- [ ] **Step 6: Implement `bin/open.js`**

```js
#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { openPickerArgs } from '../lib/pane.js';

const herdr = process.env.HERDR_BIN_PATH || 'herdr';
const res = spawnSync(herdr, openPickerArgs(process.env.HERDR_PLUGIN_ID), { stdio: 'inherit' });
process.exit(res.status ?? 1);
```

- [ ] **Step 7: Implement `bin/picker.js`**

```js
#!/usr/bin/env node
import { run } from '../lib/run.js';

run()
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  });
```

- [ ] **Step 8: Run to verify pass**

Run: `node --test test/run.test.js test/pane.test.js`
Expected: PASS (5 tests).

- [ ] **Step 9: Run the full suite**

Run: `npm test`
Expected: PASS (all tests across all files).

- [ ] **Step 10: Commit**

```bash
git add lib/run.js lib/pane.js bin/open.js bin/picker.js test/run.test.js test/pane.test.js
git commit -m "feat: orchestrator wiring and plugin entrypoints"
```

---

## Task 9: README

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: nothing.

- [ ] **Step 1: Write `README.md`**

````markdown
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
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README"
```

---

## Self-Review

**Spec coverage:**
- Manifest action→pane pattern → Task 1 + Task 8 (`openPickerArgs`, `bin/open.js`).
- Resolve repo from context cwd + gh remote check → Task 6.
- `gh pr list` + parse → Task 4.
- fzf-or-Node picker + line↔PR mapping → Task 5.
- Branch resolution (same-repo vs fork) → Task 3.
- Fetch + worktree create/open + exists→open → Task 7.
- Orchestration + no-op/cancel/exit codes → Task 8 (`run`).
- Config defaults + merge → Task 2.
- Errors (clear messages, non-zero) → Tasks 4/6/7 throw; Task 8 `bin/picker.js` catches.
- Docs → Task 1 (`config.example.json`) + Task 9 (README).

**Placeholder scan:** none — every code/test step has full content.

**Type consistency:** PR record shape `{number,title,headRefName,authorLogin,isCrossRepository,url}` consistent across `gh.js`, `picker.js`, `branch.js`, `run.js`. `resolveBranch → {fetchRefspec,branchName}` consumed by `createOrOpenWorktree(repoRoot, fetchRefspec, branchName, ...)`. `resolveRepo → {repoRoot}`. `runCmd → {status,stdout,stderr}` used by all exec wrappers and the injected fakes.
