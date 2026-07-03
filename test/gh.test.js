import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePrList, listPrs } from '../lib/gh.js';

const SAMPLE = JSON.stringify([
  { number: 5, title: 'Fix thing', headRefName: 'fix/thing', author: { login: 'alice' }, isCrossRepository: false, url: 'u5' },
  { number: 9, title: 'Add feature #9', headRefName: 'feat', author: { login: 'bob' }, isCrossRepository: true, url: 'u9' },
]);

test('parsePrList maps gh json into records', () => {
  const prs = parsePrList(SAMPLE);
  assert.equal(prs.length, 2);
  assert.deepEqual(prs[0], { number: 5, title: 'Fix thing', headRefName: 'fix/thing', authorLogin: 'alice', isCrossRepository: false, url: 'u5' });
  assert.equal(prs[1].isCrossRepository, true);
  assert.equal(prs[1].authorLogin, 'bob');
});

test('parsePrList returns [] for empty or malformed input', () => {
  assert.deepEqual(parsePrList('[]'), []);
  assert.deepEqual(parsePrList('not json'), []);
  assert.deepEqual(parsePrList('{}'), []);
});

test('listPrs invokes gh with the right args and returns records', () => {
  const calls = [];
  const exec = (cmd, args, opts) => { calls.push({ cmd, args, opts }); return { status: 0, stdout: SAMPLE, stderr: '' }; };
  const prs = listPrs('/repo', 50, exec);
  assert.equal(prs.length, 2);
  assert.equal(calls[0].cmd, 'gh');
  assert.deepEqual(calls[0].args, ['pr', 'list', '--state', 'open', '--json', 'number,title,headRefName,author,isCrossRepository,url', '--limit', '50']);
  assert.equal(calls[0].opts.cwd, '/repo');
});

test('listPrs throws a clear error when gh fails', () => {
  const exec = () => ({ status: 1, stdout: '', stderr: 'gh: not authenticated' });
  assert.throws(() => listPrs('/repo', 50, exec), /gh pr list failed: gh: not authenticated/);
});
