import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
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

test('runCmd runs gh through direnv exec for cwd-scoped repo env', () => {
  const root = mkdtempSync(join(tmpdir(), 'wfp-direnv-'));
  const bin = join(root, 'bin');
  const repo = join(root, 'repo');
  const log = join(root, 'direnv.log');
  mkdirSync(bin);
  mkdirSync(repo);
  writeFileSync(join(bin, 'direnv'), '#!/bin/sh\nprintf "%s\\n" "$@" > "$DIRENV_LOG"\nif [ "$1" = "exec" ]; then shift; shift; exec "$@"; fi\nexit 64\n', { mode: 0o755 });
  writeFileSync(join(bin, 'gh'), '#!/bin/sh\nprintf "gh ok"\n', { mode: 0o755 });

  const res = runCmd('gh', ['pr', 'list'], {
    cwd: repo,
    useDirenv: true,
    env: { PATH: `${bin}:${process.env.PATH}`, DIRENV_LOG: log },
  });

  assert.equal(res.status, 0);
  assert.equal(res.stdout, 'gh ok');
  assert.equal(readFileSync(log, 'utf8'), `exec\n${repo}\ngh\npr\nlist\n`);
});

test('runCmd skips direnv by default', () => {
  const root = mkdtempSync(join(tmpdir(), 'wfp-skip-direnv-'));
  const bin = join(root, 'bin');
  const repo = join(root, 'repo');
  const log = join(root, 'direnv.log');
  mkdirSync(bin);
  mkdirSync(repo);
  writeFileSync(join(bin, 'direnv'), '#!/bin/sh\necho called > "$DIRENV_LOG"\nexit 1\n', { mode: 0o755 });
  writeFileSync(join(bin, 'gh'), '#!/bin/sh\nprintf "gh direct"\n', { mode: 0o755 });

  const res = runCmd('gh', ['pr', 'list'], {
    cwd: repo,
    env: { PATH: `${bin}:${process.env.PATH}`, DIRENV_LOG: log },
  });

  assert.equal(res.status, 0);
  assert.equal(res.stdout, 'gh direct');
  assert.equal(existsSync(log), false);
});

test('runCmd does not run non-gh commands through direnv', () => {
  const root = mkdtempSync(join(tmpdir(), 'wfp-no-direnv-'));
  const bin = join(root, 'bin');
  const log = join(root, 'direnv.log');
  mkdirSync(bin);
  writeFileSync(join(bin, 'direnv'), '#!/bin/sh\necho called > "$DIRENV_LOG"\nexit 1\n', { mode: 0o755 });

  const res = runCmd('printf', ['hello'], {
    cwd: root,
    env: { PATH: `${bin}:${process.env.PATH}`, DIRENV_LOG: log },
  });

  assert.equal(res.status, 0);
  assert.equal(res.stdout, 'hello');
  assert.equal(existsSync(log), false);
});
