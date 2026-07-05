import { loadConfig } from './config.js';
import { resolveRepo } from './repo.js';
import { listPrs } from './gh.js';
import { resolveBranch } from './branch.js';
import { createOrOpenWorktree } from './worktree.js';
import { select as defaultSelect } from './picker.js';
import { runCmd } from './exec.js';

export async function run({ env = process.env, exec = runCmd, select = defaultSelect, log = (m) => process.stdout.write(`${m}\n`) } = {}) {
  const config = loadConfig(env.HERDR_PLUGIN_CONFIG_DIR);
  const { repoRoot } = resolveRepo(env, exec, { useDirenv: config.useDirenv });
  const prs = listPrs(repoRoot, config.prLimit, exec, { useDirenv: config.useDirenv });
  if (prs.length === 0) {
    log('worktree-from-pr: no open PRs');
    return 0;
  }
  const pr = await select(prs, { exec, layout: config.fzfLayout });
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
