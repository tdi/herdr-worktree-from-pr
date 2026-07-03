import { test } from 'node:test';
import assert from 'node:assert/strict';
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
