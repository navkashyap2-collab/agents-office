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
    hypothesis: 'h', evidence: 'e', owner: 'lexi', nextAction: 'n', expectedBenefit: 'b',
    dataDir, fetchImpl,
  });
  assert.equal(out.status, 'created');
  assert.equal(out.taskId, 'task-1');
  assert.ok(calls.some(c => c.url.endsWith('/api/tasks') && c.init.method === 'POST'));
  assert.ok(calls.some(c => /\/api\/tasks\/task-1\/run$/.test(c.url) && c.init.method === 'POST'));
  const doc = loadInitiatives(dataDir);
  assert.equal(doc.initiatives.length, 1);
  assert.equal(doc.initiatives[0].dedupeKey, 'sales:strata-wave2');
  assert.equal(doc.initiatives[0].taskIds[0], 'task-1');
  fs.rmSync(dataDir, { recursive: true, force: true });
  console.log('ok: delegate creates a task and records an initiative');
}

export async function testSkipsDuplicate() {
  const dataDir = tmpDir();
  let doc = loadInitiatives(dataDir);
  doc.initiatives.push({ id: 'i1', dedupeKey: 'sales:strata-wave2', dept: 'sales', hypothesis: 'h', evidence: 'e', owner: 'lexi', nextAction: 'n', expectedBenefit: 'b', status: 'open', taskIds: ['task-0'], createdAtMs: Date.now(), updatedAtMs: Date.now(), result: null });
  saveInitiatives(dataDir, doc);
  const { fetchImpl, calls } = fakeOffice();
  const out = await delegate({ dept: 'sales', text: 'same idea again', dedupeKey: 'sales:strata-wave2', hypothesis: 'h', evidence: 'e', owner: 'lexi', nextAction: 'n', expectedBenefit: 'b', dataDir, fetchImpl });
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
await testSkipsDuplicate();
await testNoApproveFunctionExists();
await testMarkInitiativeResult();
