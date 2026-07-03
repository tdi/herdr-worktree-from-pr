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
