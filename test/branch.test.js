import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveBranch } from '../lib/branch.js';

test('same-repo PR fetches head branch into a like-named local branch', () => {
  const pr = { number: 12, headRefName: 'feature/x', isCrossRepository: false };
  assert.deepEqual(resolveBranch(pr, { forkBranchPrefix: 'pr-' }), {
    fetchRefspec: 'feature/x:feature/x',
    branchName: 'feature/x',
  });
});

test('fork PR fetches pull/N/head into a prefixed local branch', () => {
  const pr = { number: 542, headRefName: 'their-branch', isCrossRepository: true };
  assert.deepEqual(resolveBranch(pr, { forkBranchPrefix: 'pr-' }), {
    fetchRefspec: 'pull/542/head:pr-542',
    branchName: 'pr-542',
  });
});

test('fork prefix is configurable and defaults to pr-', () => {
  const pr = { number: 7, headRefName: 'x', isCrossRepository: true };
  assert.equal(resolveBranch(pr, { forkBranchPrefix: 'review/' }).branchName, 'review/7');
  assert.equal(resolveBranch(pr).branchName, 'pr-7');
});
