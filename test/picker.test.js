import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatLine, formatLines, lineToPr } from '../lib/picker.js';

const PRS = [
  { number: 5, title: 'Fix thing', headRefName: 'fix/thing', authorLogin: 'alice', isCrossRepository: false },
  { number: 9, title: 'Add feature #9', headRefName: 'feat', authorLogin: 'bob', isCrossRepository: true },
];

test('formatLine starts with #number and marks forks', () => {
  assert.match(formatLine(PRS[0]), /^#5\s+Fix thing\s+\(fix\/thing\) @alice$/);
  assert.match(formatLine(PRS[1]), /^#9\s+Add feature #9\s+\(feat\) @bob \[fork\]$/);
});

test('lineToPr maps a chosen line back to its PR by leading number', () => {
  const lines = formatLines(PRS);
  assert.equal(lineToPr(lines[0], PRS).number, 5);
  assert.equal(lineToPr(lines[1], PRS).number, 9);           // title contains '#9' but leading token wins
  assert.equal(lineToPr('', PRS), null);
  assert.equal(lineToPr('#404 gone', PRS), null);
});
