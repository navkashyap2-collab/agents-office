import assert from 'node:assert/strict';
import { perthDayStartMs, todayWork } from './daily-work.js';

const now = Date.parse('2026-09-22T01:00:00.000Z'); // 09:00 AWST
const today = perthDayStartMs(now);
assert.equal(today, Date.parse('2026-09-21T16:00:00.000Z'));
assert.deepEqual(todayWork([
  { state: 'done', doneAt: today + 1 },
  { state: 'done', doneAt: today + 2, error: true },
  { state: 'done', doneAt: today + 3, piece: true },
  { state: 'done', doneAt: today - 1 },
], now), { completed: 2, failed: 1 });
console.log('ok: daily work separates completed top-level tasks from outcome counters');
