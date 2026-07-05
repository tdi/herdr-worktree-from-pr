import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULTS = { prLimit: 50, forkBranchPrefix: 'pr-', fzfLayout: 'down', useDirenv: false };

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
