import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openPickerArgs, normalizePlacement, swapDirectionFor, parsePaneId, readPlacement } from '../lib/pane.js';

test('openPickerArgs defaults to a right split', () => {
  assert.deepEqual(openPickerArgs('tdi.worktree-from-pr'), [
    'plugin', 'pane', 'open', '--plugin', 'tdi.worktree-from-pr', '--entrypoint', 'picker', '--placement', 'split', '--direction', 'right', '--focus',
  ]);
});

test('openPickerArgs falls back to the default plugin id', () => {
  assert.equal(openPickerArgs()[4], 'tdi.worktree-from-pr');
});

test('openPickerArgs maps each placement to herdr flags', () => {
  const tail = (p) => openPickerArgs('id', undefined, p).slice(7); // drop the fixed prefix
  assert.deepEqual(tail('overlay'), ['--placement', 'overlay', '--focus']);
  assert.deepEqual(tail('right'), ['--placement', 'split', '--direction', 'right', '--focus']);
  assert.deepEqual(tail('down'), ['--placement', 'split', '--direction', 'down', '--focus']);
  // left/top open as a right/down split and swap afterwards
  assert.deepEqual(tail('left'), ['--placement', 'split', '--direction', 'right', '--focus']);
  assert.deepEqual(tail('top'), ['--placement', 'split', '--direction', 'down', '--focus']);
  // unknown placement falls back to the default (right)
  assert.deepEqual(tail('sideways'), ['--placement', 'split', '--direction', 'right', '--focus']);
});

test('normalizePlacement keeps known values and defaults the rest to right', () => {
  for (const p of ['overlay', 'right', 'left', 'down', 'top']) assert.equal(normalizePlacement(p), p);
  assert.equal(normalizePlacement('bogus'), 'right');
  assert.equal(normalizePlacement(undefined), 'right');
});

test('swapDirectionFor only returns a direction for left/top', () => {
  assert.equal(swapDirectionFor('left'), 'left');
  assert.equal(swapDirectionFor('top'), 'up');
  assert.equal(swapDirectionFor('right'), null);
  assert.equal(swapDirectionFor('down'), null);
  assert.equal(swapDirectionFor('overlay'), null);
});

test('parsePaneId reads the opened pane id, null on junk', () => {
  assert.equal(parsePaneId('{"result":{"plugin_pane":{"pane":{"pane_id":"wR:pF"}}}}'), 'wR:pF');
  assert.equal(parsePaneId('not json'), null);
  assert.equal(parsePaneId('{"result":{}}'), null);
});

test('openPickerArgs passes the repo via HERDR_WFP_CWD env, never --cwd', () => {
  assert.deepEqual(openPickerArgs('tdi.worktree-from-pr', '/work/repo').slice(-2), ['--env', 'HERDR_WFP_CWD=/work/repo']);
  // --cwd would break `node bin/picker.js` resolution (relative to plugin root)
  assert.equal(openPickerArgs('tdi.worktree-from-pr', '/work/repo').includes('--cwd'), false);
  assert.equal(openPickerArgs('tdi.worktree-from-pr').includes('--env'), false);
  assert.equal(openPickerArgs('tdi.worktree-from-pr', '').includes('--env'), false);
});

test('readPlacement reads config.json, tolerant of missing/invalid', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wfp-pane-'));
  writeFileSync(join(dir, 'config.json'), '{"placement":"top"}');
  assert.equal(readPlacement(dir), 'top');
  writeFileSync(join(dir, 'config.json'), '{"placement":"nonsense"}');
  assert.equal(readPlacement(dir), 'right'); // invalid value -> default
  writeFileSync(join(dir, 'config.json'), '{bad');
  assert.equal(readPlacement(dir), 'right'); // unparseable -> default
  rmSync(dir, { recursive: true, force: true });
  assert.equal(readPlacement(dir), 'right'); // missing file -> default
  assert.equal(readPlacement(undefined), 'right'); // no dir -> default
});
