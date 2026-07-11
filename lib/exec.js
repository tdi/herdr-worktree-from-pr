import { spawnSync } from 'node:child_process';

function shouldUseDirenv(cmd, opts, useDirenv) {
  return useDirenv === true && cmd === 'gh' && typeof opts.cwd === 'string' && opts.cwd.length > 0;
}

function normalizeResult(res) {
  return {
    status: res.status ?? 1,
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? (res.error ? String(res.error.message || res.error) : ''),
  };
}

export function runCmd(cmd, args, opts = {}) {
  const { useDirenv = false, ...spawnOpts } = opts;
  if (shouldUseDirenv(cmd, spawnOpts, useDirenv)) {
    const direnv = spawnSync('direnv', ['exec', spawnOpts.cwd, cmd, ...args], { encoding: 'utf8', ...spawnOpts });
    if (direnv.error?.code !== 'ENOENT') return normalizeResult(direnv);
  }

  return normalizeResult(spawnSync(cmd, args, { encoding: 'utf8', ...spawnOpts }));
}
