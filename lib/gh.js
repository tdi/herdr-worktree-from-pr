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

export function listPrs(repoRoot, limit, exec = runCmd, { useDirenv = false } = {}) {
  const opts = { cwd: repoRoot };
  if (useDirenv) opts.useDirenv = true;
  const res = exec(
    'gh',
    ['pr', 'list', '--state', 'open', '--json', 'number,title,headRefName,author,isCrossRepository,url', '--limit', String(limit)],
    opts,
  );
  if (res.status !== 0) {
    throw new Error(`worktree-from-pr: gh pr list failed: ${res.stderr.trim() || 'unknown error'}`);
  }
  return parsePrList(res.stdout);
}
