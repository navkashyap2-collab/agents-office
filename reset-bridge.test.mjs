import assert from 'node:assert/strict';
import { buildResetStatus, perthDayStartMs } from './reset-bridge.mjs';

const now = Date.parse('2026-09-22T01:00:00.000Z'); // 09:00 AWST
const today = perthDayStartMs(now);
assert.equal(today, Date.parse('2026-09-21T16:00:00.000Z'));

const status = buildResetStatus({
  generatedAtMs: now,
  gmail: { outbox: [{ completedAtMs: today - 1 }, { completedAtMs: today + 1 }], signalCounts: { pending: 4 } },
  discovery: { byStatus: { qualified: 7 }, recent: [
    { status: 'qualified', vettedAtMs: today + 1 }, { status: 'duplicate', vettedAtMs: today + 2 },
    { status: 'qualified', vettedAtMs: today - 1 },
  ] },
  vaFloor: { recentCalls: [
    { startedAtMs: today + 1, disposition: null },
    { startedAtMs: today + 2, disposition: 'Callback booked' },
    { startedAtMs: today - 1, disposition: 'Completed' },
  ] },
  agentRuns: [], wave1: [], funnel: [],
});
assert.deepEqual(status.departments.emails, { EMAILS_SENT_TODAY: 1, GMAIL_SIGNALS: 4 });
assert.deepEqual(status.departments.sales, { CANDIDATES_VETTED_TODAY: 2, QUALIFIED_TODAY: 1 });
assert.deepEqual(status.departments.ops, { PROPOSALS_MADE: 0, CALL_OUTCOMES_TODAY: 1 });
console.log('ok: Reset dashboard reports only completed call outcomes from today');
