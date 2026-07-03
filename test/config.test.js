import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../lib/config.js';

test('loadConfig returns defaults when no dir or file', () => {
  assert.deepEqual(loadConfig(undefined), { prLimit: 50, forkBranchPrefix: 'pr-', fzfLayout: 'down' });
  const dir = mkdtempSync(join(tmpdir(), 'wfp-'));
  assert.deepEqual(loadConfig(dir), { prLimit: 50, forkBranchPrefix: 'pr-', fzfLayout: 'down' });
  rmSync(dir, { recursive: true, force: true });
});

test('loadConfig merges a partial config over defaults', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wfp-'));
  writeFileSync(join(dir, 'config.json'), '{"prLimit": 10}');
  assert.deepEqual(loadConfig(dir), { prLimit: 10, forkBranchPrefix: 'pr-', fzfLayout: 'down' });
  rmSync(dir, { recursive: true, force: true });
});

test('loadConfig throws a clear error on malformed JSON', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wfp-'));
  writeFileSync(join(dir, 'config.json'), '{bad');
  assert.throws(() => loadConfig(dir), /invalid config\.json/);
  rmSync(dir, { recursive: true, force: true });
});
