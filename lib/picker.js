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

// fzfLayout "top" puts the search bar at the top (--layout=reverse); anything else
// (default "down") uses fzf's default bottom layout. --height=~40% keeps the picker
// a compact window that auto-shrinks to the list, capped at 40% of the pane.
export function fzfArgs(layout) {
  const args = [];
  if (layout === 'top') args.push('--layout=reverse');
  args.push('--height=~40%', '--prompt', 'PR> ');
  return args;
}

export async function select(prs, { exec = runCmd, layout = 'down' } = {}) {
  if (!prs.length) return null;
  const lines = formatLines(prs);
  if (hasFzf(exec)) {
    const res = exec('fzf', fzfArgs(layout), { input: lines.join('\n') });
    if (res.status !== 0) return null;
    return lineToPr(res.stdout.trim(), prs);
  }
  return nodeSelect(prs, lines);
}
