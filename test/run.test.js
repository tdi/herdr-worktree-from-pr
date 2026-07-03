import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../lib/run.js';

function fakeExec(prsJson) {
  const calls = [];
  const exec = (cmd, args = []) => {
    calls.push([cmd, ...args]);
    if (cmd === 'git' && args.includes('--show-toplevel')) return { status: 0, stdout: '/repo\n', stderr: '' };
    if (cmd === 'gh' && args.includes('repo')) return { status: 0, stdout: '{"nameWithOwner":"o/r"}', stderr: '' };
    if (cmd === 'gh' && args.includes('pr')) return { status: 0, stdout: prsJson, stderr: '' };
    if (cmd === 'git' && args.includes('list')) return { status: 0, stdout: 'worktree /repo\nbranch refs/heads/main\n', stderr: '' };
    if (cmd === 'git' && args.includes('fetch')) return { status: 0, stdout: '', stderr: '' };
    if (args[0] === 'worktree') return { status: 0, stdout: '{"type":"worktree_created"}', stderr: '' };
    return { status: 0, stdout: '', stderr: '' };
  };
  return { exec, calls };
}

test('run creates a worktree for the selected fork PR', async () => {
  const prs = JSON.stringify([{ number: 9, title: 'F', headRefName: 'x', author: { login: 'b' }, isCrossRepository: true, url: 'u' }]);
  const { exec, calls } = fakeExec(prs);
  const select = async (list) => list[0];
  const logs = [];
  const code = await run({ env: { HERDR_PLUGIN_CONTEXT_JSON: '{}', HERDR_BIN_PATH: 'herdr' }, exec, select, log: (m) => logs.push(m) });
  assert.equal(code, 0);
  assert.ok(calls.some((c) => c.includes('fetch') && c.includes('pull/9/head:pr-9')), 'fetches the PR head ref');
  assert.ok(calls.some((c) => c[0] === 'herdr' && c.includes('create') && c.includes('pr-9')), 'creates the worktree');
});

test('run is a no-op (exit 0) when there are no open PRs', async () => {
  const { exec } = fakeExec('[]');
  const logs = [];
  const code = await run({ env: { HERDR_PLUGIN_CONTEXT_JSON: '{}' }, exec, select: async () => null, log: (m) => logs.push(m) });
  assert.equal(code, 0);
  assert.ok(logs.some((m) => /no open PRs/.test(m)));
});

test('run is a no-op when the user cancels the picker', async () => {
  const prs = JSON.stringify([{ number: 9, title: 'F', headRefName: 'x', author: { login: 'b' }, isCrossRepository: false, url: 'u' }]);
  const { exec, calls } = fakeExec(prs);
  const code = await run({ env: { HERDR_PLUGIN_CONTEXT_JSON: '{}' }, exec, select: async () => null, log: () => {} });
  assert.equal(code, 0);
  assert.equal(calls.some((c) => c.includes('fetch')), false);
});
