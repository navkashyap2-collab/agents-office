// agents-office/ceo/delegate.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { delegate, markInitiativeResult } from './delegate.mjs';
import { loadInitiatives, saveInitiatives } from './state.mjs';

function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'ceo-delegate-test-')); }

function fakeOffice({ createResponse, runResponse } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/api/tasks') && (!init || init.method === undefined || init.method === 'POST')) {
      return { ok: true, status: 200, json: async () => createResponse || { id: 'task-1', dept: 'sales', state: 'next' } };
    }
    if (/\/api\/tasks\/[^/]+\/run$/.test(String(url))) {
      return { ok: true, status: 200, json: async () => runResponse || { id: 'task-1', state: 'doing' } };
    }
    return { ok: false, status: 404, json: async () => ({ error: 'unexpected-call' }) };
  };
  return { fetchImpl, calls };
}

export async function testCreatesAndRecordsInitiative() {
  const dataDir = tmpDir();
  const { fetchImpl, calls } = fakeOffice();
  const out = await delegate({
    dept: 'sales', text: 'Investigate strata portfolio wave 2 outreach', dedupeKey: 'sales:strata-wave2',
    hypothesis: 'h', evidence: 'e', owner: 'lexi', nextAction: 'n', expectedBenefit: 'b', actionClass: 'internal',
    dataDir, fetchImpl,
  });
  assert.equal(out.status, 'created');
  assert.equal(out.autoRan, true);
  assert.equal(out.taskId, 'task-1');
  assert.ok(calls.some(c => c.url.endsWith('/api/tasks') && c.init.method === 'POST'));
  assert.ok(calls.some(c => /\/api\/tasks\/task-1\/run$/.test(c.url) && c.init.method === 'POST'));
  const doc = loadInitiatives(dataDir);
  assert.equal(doc.initiatives.length, 1);
  assert.equal(doc.initiatives[0].dedupeKey, 'sales:strata-wave2');
  assert.equal(doc.initiatives[0].taskIds[0], 'task-1');
  fs.rmSync(dataDir, { recursive: true, force: true });
  console.log('ok: delegate creates a task, auto-runs it for actionClass "internal", and records an initiative');
}

export async function testRoutineOutboundAutoRuns() {
  const dataDir = tmpDir();
  const { fetchImpl, calls } = fakeOffice();
  const out = await delegate({ dept: 'emails', text: 'Send the scheduled check-in to an existing client', dedupeKey: 'emails:checkin-1', hypothesis: 'h', evidence: 'e', owner: 'elead', nextAction: 'n', expectedBenefit: 'b', actionClass: 'routine-outbound', dataDir, fetchImpl });
  assert.equal(out.autoRan, true);
  assert.ok(calls.some(c => /\/run$/.test(c.url)), 'routine-outbound must auto-run');
  fs.rmSync(dataDir, { recursive: true, force: true });
  console.log('ok: "routine-outbound" auto-runs, same as "internal"');
}

export async function testFirstContactOrCommittingWaitsForNav() {
  // 2026-09-19: this is the real fix. serve.mjs's immediate /run path never checks task.needsOk,
  // so this classification in delegate.mjs is the only thing standing between the CEO and
  // silently emailing a brand-new prospect or committing a price with no chance for NAV to see
  // it first. A task in this class must be created but NEVER auto-run.
  const dataDir = tmpDir();
  const { fetchImpl, calls } = fakeOffice();
  const out = await delegate({ dept: 'sales', text: 'Email the new prospect at GFA Griffiths introducing Reset', dedupeKey: 'sales:gfa-first-contact', hypothesis: 'h', evidence: 'e', owner: 'lexi', nextAction: 'n', expectedBenefit: 'b', actionClass: 'first-contact-or-committing', dataDir, fetchImpl });
  assert.equal(out.status, 'created');
  assert.equal(out.autoRan, false);
  assert.equal(out.awaitingRun, true);
  assert.ok(calls.some(c => c.url.endsWith('/api/tasks') && c.init.method === 'POST'), 'the task must still be created, visible on the board');
  assert.ok(!calls.some(c => /\/run$/.test(c.url)), 'a first-contact-or-committing task must NEVER be auto-run by the CEO');
  fs.rmSync(dataDir, { recursive: true, force: true });
  console.log('ok: "first-contact-or-committing" is created but held for NAV to run himself, never auto-run');
}

export async function testMissingActionClassFailsClosed() {
  // Whatever produced this delegation (an older caller, a bug, a model that omitted the field)
  // must never be treated as safe-to-auto-run by default.
  const dataDir = tmpDir();
  const { fetchImpl, calls } = fakeOffice();
  const out = await delegate({ dept: 'sales', text: 'do something', dedupeKey: 'sales:no-class', hypothesis: 'h', evidence: 'e', owner: 'lexi', nextAction: 'n', expectedBenefit: 'b', dataDir, fetchImpl });
  assert.equal(out.autoRan, false);
  assert.ok(!calls.some(c => /\/run$/.test(c.url)));
  fs.rmSync(dataDir, { recursive: true, force: true });
  console.log('ok: a missing actionClass fails closed (never auto-run)');
}

export async function testSkipsDuplicate() {
  const dataDir = tmpDir();
  let doc = loadInitiatives(dataDir);
  doc.initiatives.push({ id: 'i1', dedupeKey: 'sales:strata-wave2', dept: 'sales', hypothesis: 'h', evidence: 'e', owner: 'lexi', nextAction: 'n', expectedBenefit: 'b', status: 'open', taskIds: ['task-0'], createdAtMs: Date.now(), updatedAtMs: Date.now(), result: null });
  saveInitiatives(dataDir, doc);
  const { fetchImpl, calls } = fakeOffice();
  const out = await delegate({ dept: 'sales', text: 'same idea again', dedupeKey: 'sales:strata-wave2', hypothesis: 'h', evidence: 'e', owner: 'lexi', nextAction: 'n', expectedBenefit: 'b', actionClass: 'internal', dataDir, fetchImpl });
  assert.equal(out.status, 'skipped-duplicate');
  assert.equal(out.taskId, 'task-0');
  assert.equal(calls.length, 0, 'no HTTP call should be made when an open duplicate initiative exists');
  fs.rmSync(dataDir, { recursive: true, force: true });
  console.log('ok: delegate skips a duplicate open initiative without creating a new task');
}

export async function testNoApproveFunctionExists() {
  const mod = await import('./delegate.mjs');
  const names = Object.keys(mod).join(',').toLowerCase();
  assert.ok(!names.includes('approve'), 'delegate.mjs must not export anything approval-shaped');
  console.log('ok: delegate.mjs has no approve/reject capability');
}

export async function testMarkInitiativeResult() {
  const dataDir = tmpDir();
  let doc = loadInitiatives(dataDir);
  doc.initiatives.push({ id: 'i1', dedupeKey: 'k', dept: 'sales', hypothesis: 'h', evidence: 'e', owner: 'lexi', nextAction: 'n', expectedBenefit: 'b', status: 'open', taskIds: ['t1'], createdAtMs: Date.now(), updatedAtMs: Date.now(), result: null });
  saveInitiatives(dataDir, doc);
  markInitiativeResult({ dataDir, initiativeId: 'i1', status: 'done', result: 'Found 3 qualified strata contacts.' });
  const reloaded = loadInitiatives(dataDir);
  assert.equal(reloaded.initiatives[0].status, 'done');
  assert.equal(reloaded.initiatives[0].result, 'Found 3 qualified strata contacts.');
  fs.rmSync(dataDir, { recursive: true, force: true });
  console.log('ok: markInitiativeResult updates the ledger');
}

await testCreatesAndRecordsInitiative();
await testRoutineOutboundAutoRuns();
await testFirstContactOrCommittingWaitsForNav();
await testMissingActionClassFailsClosed();
await testSkipsDuplicate();
await testNoApproveFunctionExists();
await testMarkInitiativeResult();
