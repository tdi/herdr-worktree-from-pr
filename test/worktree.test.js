import { test } from 'node:test';
import assert from 'node:assert/strict';
import { worktreeExistsForBranch, buildWorktreeArgs, createOrOpenWorktree, localBranchExists } from '../lib/worktree.js';

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
    if (cmd === 'git' && args.includes('rev-parse')) return { status: 1, stdout: '', stderr: '' };
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
    if (cmd === 'git' && args.includes('rev-parse')) return { status: 0, stdout: '', stderr: '' };
    return { status: 0, stdout: '{}', stderr: '' };
  };
  const res = createOrOpenWorktree('/repo', 'pull/9/head:pr-9', 'pr-9', exec, 'herdr');
  assert.equal(res.exists, true);
  assert.equal(calls.some((c) => c.includes('fetch')), false);
  assert.deepEqual(res.args, ['worktree', 'open', '--cwd', '/repo', '--branch', 'pr-9', '--focus', '--json']);
});

test('createOrOpenWorktree creates without fetching when the branch exists locally but no worktree', () => {
  const calls = [];
  const exec = (cmd, args) => {
    calls.push([cmd, ...args]);
    if (cmd === 'git' && args.includes('list')) return { status: 0, stdout: 'worktree /repo\nbranch refs/heads/main\n', stderr: '' };
    if (cmd === 'git' && args.includes('rev-parse')) return { status: 0, stdout: '', stderr: '' };
    return { status: 0, stdout: '{}', stderr: '' };
  };
  const res = createOrOpenWorktree('/repo', 'pull/9/head:pr-9', 'pr-9', exec, 'herdr');
  assert.equal(calls.some((c) => c.includes('fetch')), false);
  assert.deepEqual(res.args, ['worktree', 'create', '--cwd', '/repo', '--branch', 'pr-9', '--focus', '--json']);
  assert.equal(res.exists, false);
});

test('createOrOpenWorktree throws when fetch fails', () => {
  const exec = (cmd, args) => {
    if (cmd === 'git' && args.includes('list')) return { status: 0, stdout: 'worktree /repo\n', stderr: '' };
    if (cmd === 'git' && args.includes('rev-parse')) return { status: 1, stdout: '', stderr: '' };
    if (cmd === 'git' && args.includes('fetch')) return { status: 1, stdout: '', stderr: 'could not fetch' };
    return { status: 0, stdout: '', stderr: '' };
  };
  assert.throws(() => createOrOpenWorktree('/repo', 'x:x', 'x', exec, 'herdr'), /git fetch failed: could not fetch/);
});

test('localBranchExists returns true when rev-parse succeeds', () => {
  const exec = () => ({ status: 0, stdout: 'abc123\n', stderr: '' });
  assert.equal(localBranchExists('/repo', 'pr-9', exec), true);
});

test('localBranchExists returns false when rev-parse fails', () => {
  const exec = () => ({ status: 1, stdout: '', stderr: '' });
  assert.equal(localBranchExists('/repo', 'pr-9', exec), false);
});
