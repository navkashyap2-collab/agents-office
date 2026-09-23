// agents-office/ceo/state.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  loadCeoState, saveCeoState, loadInitiatives, saveInitiatives,
  findOpenInitiative, acquireCycleLock, todayLocal,
} from './state.mjs';

function tmpDir() { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ceo-state-test-')); return d; }

export async function testStateRoundtrip() {
  const dir = tmpDir();
  const empty = loadCeoState(dir);
  assert.equal(empty.lastMorningCycleDateLocal, null);
  saveCeoState(dir, { lastMorningCycleDateLocal: '2026-09-18', lastCycleAtMs: 123, lastCycleSummary: { priorities: [] }, cyclesRun: 1 });
  const reloaded = loadCeoState(dir);
  assert.equal(reloaded.lastMorningCycleDateLocal, '2026-09-18');
  assert.equal(reloaded.cyclesRun, 1);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('ok: ceo state roundtrip');
}

export async function testDedup() {
  const dir = tmpDir();
  let doc = loadInitiatives(dir);
  assert.deepEqual(doc.initiatives, []);
  doc.initiatives.push({ id: 'i1', dedupeKey: 'sales:perth-strata-wave2', dept: 'sales', hypothesis: 'h', evidence: 'e', owner: 'lexi', nextAction: 'n', expectedBenefit: 'b', status: 'open', taskIds: ['t1'], createdAtMs: Date.now(), updatedAtMs: Date.now(), result: null });
  saveInitiatives(dir, doc);
  const reloaded = loadInitiatives(dir);
  const hit = findOpenInitiative(reloaded, 'sales:perth-strata-wave2');
  assert.ok(hit, 'should find the open initiative by dedupeKey');
  const miss = findOpenInitiative(reloaded, 'sales:some-other-key');
  assert.equal(miss, null);
  reloaded.initiatives[0].status = 'done';
  saveInitiatives(dir, reloaded);
  const afterDone = findOpenInitiative(loadInitiatives(dir), 'sales:perth-strata-wave2');
  assert.equal(afterDone, null, 'a done initiative should no longer count as open');
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('ok: initiative dedup by key + status');
}

export async function testLock() {
  const dir = tmpDir();
  const first = acquireCycleLock(dir);
  assert.equal(first.acquired, true);
  const second = acquireCycleLock(dir);
  assert.equal(second.acquired, false, 'a second lock attempt while the first is held must be refused');
  first.release();
  const third = acquireCycleLock(dir);
  assert.equal(third.acquired, true, 'after release, the lock is available again');
  third.release();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('ok: cycle lock prevents overlap and releases cleanly');
}

export async function testTodayLocal() {
  const s = todayLocal(new Date(2026, 8, 18, 3, 0, 0).getTime()); // 18 Sep 2026, local
  assert.equal(s, '2026-09-18');
  console.log('ok: todayLocal formats correctly');
}

await testStateRoundtrip();
await testDedup();
await testLock();
await testTodayLocal();
