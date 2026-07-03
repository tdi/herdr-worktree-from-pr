import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseContextCwd, resolveRepo } from '../lib/repo.js';

test('parseContextCwd prefers focused_pane_cwd, then workspace_cwd, then fallback', () => {
  assert.equal(parseContextCwd(JSON.stringify({ focused_pane_cwd: '/a', workspace_cwd: '/b' }), '/f'), '/a');
  assert.equal(parseContextCwd(JSON.stringify({ workspace_cwd: '/b' }), '/f'), '/b');
  assert.equal(parseContextCwd(undefined, '/f'), '/f');
  assert.equal(parseContextCwd('not json', '/f'), '/f');
});

test('resolveRepo returns the git toplevel when gh remote is present', () => {
  const env = { HERDR_PLUGIN_CONTEXT_JSON: JSON.stringify({ focused_pane_cwd: '/work/repo/sub' }) };
  const exec = (cmd, args) => {
    if (cmd === 'git' && args.includes('--show-toplevel')) return { status: 0, stdout: '/work/repo\n', stderr: '' };
    if (cmd === 'gh') return { status: 0, stdout: '{"nameWithOwner":"o/r"}', stderr: '' };
    return { status: 1, stdout: '', stderr: '' };
  };
  assert.deepEqual(resolveRepo(env, exec), { repoRoot: '/work/repo' });
});

test('resolveRepo throws when not a git repo', () => {
  const exec = () => ({ status: 1, stdout: '', stderr: 'fatal' });
  assert.throws(() => resolveRepo({}, exec), /not inside a git repository/);
});

test('resolveRepo throws when gh has no repo/remote', () => {
  const exec = (cmd, args) => {
    if (cmd === 'git' && args.includes('--show-toplevel')) return { status: 0, stdout: '/work/repo\n', stderr: '' };
    return { status: 1, stdout: '', stderr: 'no remote' };
  };
  assert.throws(() => resolveRepo({}, exec), /no GitHub repo\/remote/);
});
