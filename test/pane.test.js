import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openPickerArgs } from '../lib/pane.js';

test('openPickerArgs targets the picker overlay entrypoint', () => {
  assert.deepEqual(openPickerArgs('tdi.worktree-from-pr'), [
    'plugin', 'pane', 'open', '--plugin', 'tdi.worktree-from-pr', '--entrypoint', 'picker', '--placement', 'overlay', '--focus',
  ]);
});

test('openPickerArgs falls back to the default plugin id', () => {
  assert.equal(openPickerArgs()[4], 'tdi.worktree-from-pr');
});
