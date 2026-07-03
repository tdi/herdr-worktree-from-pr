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
