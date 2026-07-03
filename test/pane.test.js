import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openPickerArgs } from '../lib/pane.js';

test('openPickerArgs targets the picker overlay entrypoint', () => {
  assert.deepEqual(openPickerArgs('tdi.worktree-from-pr'), [
    'plugin', 'pane', 'open', '--plugin', 'tdi.worktree-from-pr', '--entrypoint', 'picker', '--placement', 'split', '--direction', 'right', '--focus',
  ]);
});

test('openPickerArgs falls back to the default plugin id', () => {
  assert.equal(openPickerArgs()[4], 'tdi.worktree-from-pr');
});

test('openPickerArgs passes the repo via HERDR_WFP_CWD env, never --cwd', () => {
  assert.deepEqual(openPickerArgs('tdi.worktree-from-pr', '/work/repo').slice(-2), ['--env', 'HERDR_WFP_CWD=/work/repo']);
  // --cwd would break `node bin/picker.js` resolution (relative to plugin root)
  assert.equal(openPickerArgs('tdi.worktree-from-pr', '/work/repo').includes('--cwd'), false);
  assert.equal(openPickerArgs('tdi.worktree-from-pr').includes('--env'), false);
  assert.equal(openPickerArgs('tdi.worktree-from-pr', '').includes('--env'), false);
});
