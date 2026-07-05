import { runCmd } from './exec.js';

function firstString(...vals) {
  for (const v of vals) {
    if (typeof v === 'string' && v) return v;
  }
  return null;
}

// herdr's HERDR_PLUGIN_CONTEXT_JSON shape varies by invocation (action vs pane
// vs event) and across versions. Probe every cwd-bearing key we have observed
// on herdr 0.7.x — flat and nested — before falling back to the process cwd.
export function parseContextCwd(contextJson, fallbackCwd) {
  let ctx = null;
  try {
    ctx = contextJson ? JSON.parse(contextJson) : null;
  } catch {
    ctx = null;
  }
  if (ctx && typeof ctx === 'object') {
    const pane = ctx.focused_pane && typeof ctx.focused_pane === 'object' ? ctx.focused_pane : {};
    const workspace = ctx.workspace && typeof ctx.workspace === 'object' ? ctx.workspace : {};
    const worktree = ctx.worktree && typeof ctx.worktree === 'object' ? ctx.worktree : {};
    const found = firstString(
      ctx.focused_pane_cwd, pane.cwd, pane.working_directory,
      ctx.workspace_cwd, workspace.cwd, workspace.path,
      worktree.checkout_path, worktree.path, worktree.workspace_cwd,
      ctx.cwd, ctx.repo_root,
    );
    if (found) return found;
  }
  return fallbackCwd;
}

export function resolveRepo(env, exec = runCmd, { useDirenv = false } = {}) {
  // open.js resolves the invoking repo from its own (reliable) action context and
  // passes it as HERDR_WFP_CWD to the picker pane. Prefer it: the picker pane's own
  // HERDR_PLUGIN_CONTEXT_JSON can point at the plugin install dir, not the repo.
  const cwd = (typeof env.HERDR_WFP_CWD === 'string' && env.HERDR_WFP_CWD)
    || parseContextCwd(env.HERDR_PLUGIN_CONTEXT_JSON, env.PWD || process.cwd());
  const top = exec('git', ['-C', cwd, 'rev-parse', '--show-toplevel']);
  if (top.status !== 0) {
    throw new Error('worktree-from-pr: not inside a git repository');
  }
  const repoRoot = top.stdout.trim();
  const ghOpts = { cwd: repoRoot };
  if (useDirenv) ghOpts.useDirenv = true;
  const gh = exec('gh', ['repo', 'view', '--json', 'nameWithOwner'], ghOpts);
  if (gh.status !== 0) {
    throw new Error('worktree-from-pr: no GitHub repo/remote here (is gh authenticated?)');
  }
  return { repoRoot };
}
