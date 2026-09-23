// agents-office/ceo/cycle.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { runCycle } from './cycle.mjs';
import { loadCeoState, saveCeoState, todayLocal } from './state.mjs';

function tmpDataDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'ceo-cycle-test-')); }
function tmpBrainDir() { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ceo-cycle-brain-')); fs.mkdirSync(path.join(d, '90-Operations', 'ceo'), { recursive: true }); return d; }

function fakeReasoningSpawn(resultObj) {
  return () => {
    const p = new EventEmitter(); p.stdout = new EventEmitter(); p.stderr = new EventEmitter();
    p.stdin = { write() {}, end() {} }; // reason.mjs writes the prompt to stdin, not argv (Windows argv-length limit)
    setImmediate(() => { p.stdout.emit('data', Buffer.from(JSON.stringify({ type: 'result', result: JSON.stringify(resultObj), modelUsage: { 'claude-sonnet': {} } }) + '\n')); p.emit('close', 0); });
    return p;
  };
}

function fakeOfficeAndGateway({ tasksBody = [] } = {}) {
  return async (url, init) => {
    const u = String(url);
    if (u.endsWith('/health')) return { ok: true, status: 200, json: async () => ({ status: 'ok' }) };
    if (u.includes('/view/')) return { ok: true, status: 200, json: async () => ({ view: 'x', data: [] }) };
    if (u.endsWith('/api/health')) return { ok: true, status: 200, json: async () => ({ ok: true }) };
    if (u.endsWith('/api/tasks') && (!init || init.method === undefined)) return { ok: true, status: 200, json: async () => tasksBody };
    if (u.endsWith('/api/tasks') && init.method === 'POST') return { ok: true, status: 200, json: async () => ({ id: 'task-x', dept: 'sales', state: 'next' }) };
    if (/\/run$/.test(u)) return { ok: true, status: 200, json: async () => ({ id: 'task-x', state: 'doing' }) };
    return { ok: false, status: 404, json: async () => ({}) };
  };
}

export async function testMorningCycleIsIdempotentPerDay() {
  const dataDir = tmpDataDir(), brainPath = tmpBrainDir();
  const noWork = { priorities: [], delegations: [], noAction: [], risks: [], brainNotes: [], escalateForDeepReasoning: false, escalationReason: '' };
  const fetchImpl = fakeOfficeAndGateway();
  const spawnImpl = fakeReasoningSpawn(noWork);
  const first = await runCycle({ mode: 'morning', dataDir, brainPath, fetchImpl, spawnImpl });
  assert.equal(first.ran, true);
  const second = await runCycle({ mode: 'morning', dataDir, brainPath, fetchImpl, spawnImpl });
  assert.equal(second.ran, false);
  assert.match(second.reason, /already ran today/);
  fs.rmSync(dataDir, { recursive: true, force: true }); fs.rmSync(brainPath, { recursive: true, force: true });
  console.log('ok: morning cycle runs once per local day, second call is a clean no-op');
}

export async function testNoEligibleWorkIsHonestOutcome() {
  const dataDir = tmpDataDir(), brainPath = tmpBrainDir();
  const noWork = { priorities: [], delegations: [], noAction: [], risks: [], brainNotes: [], escalateForDeepReasoning: false, escalationReason: '' };
  const out = await runCycle({ mode: 'reassess', dataDir, brainPath, fetchImpl: fakeOfficeAndGateway(), spawnImpl: fakeReasoningSpawn(noWork) });
  assert.equal(out.ran, true);
  assert.equal(out.summary.noEligibleWork, true);
  assert.equal(out.summary.delegationsCreated.length, 0);
  fs.rmSync(dataDir, { recursive: true, force: true }); fs.rmSync(brainPath, { recursive: true, force: true });
  console.log('ok: no-eligible-work is a valid, non-fabricated outcome');
}

export async function testDelegatesRealWork() {
  const dataDir = tmpDataDir(), brainPath = tmpBrainDir();
  const withWork = { priorities: [{ headline: 'h', evidence: 'e', severity: 'attention' }], delegations: [{ dept: 'sales', text: 'do it', dedupeKey: 'sales:k1', hypothesis: 'h', evidence: 'e', owner: 'lexi', nextAction: 'n', expectedBenefit: 'b', actionClass: 'internal', needsOkHint: false, complexity: 'reasoning' }], noAction: [], risks: [], brainNotes: ['a durable lesson'], escalateForDeepReasoning: false, escalationReason: '' };
  const out = await runCycle({ mode: 'morning', dataDir, brainPath, fetchImpl: fakeOfficeAndGateway(), spawnImpl: fakeReasoningSpawn(withWork) });
  assert.equal(out.summary.delegationsCreated.length, 1);
  assert.equal(out.summary.delegationsCreated[0].dept, 'sales');
  assert.equal(out.summary.delegationsAwaitingRun.length, 0);
  const lessons = fs.readFileSync(path.join(brainPath, '90-Operations', 'ceo', 'lessons.md'), 'utf8');
  assert.match(lessons, /a durable lesson/);
  fs.rmSync(dataDir, { recursive: true, force: true }); fs.rmSync(brainPath, { recursive: true, force: true });
  console.log('ok: real "internal" delegations auto-run, and brain notes are written');
}

export async function testFirstContactDelegationAwaitsNavInsteadOfAutoRunning() {
  // 2026-09-19: the real fix. A delegation classified as first-contact-or-committing must be
  // created (visible on the board) but never auto-run — that's the actual approval gate now
  // that serve.mjs's immediate /run path is known not to check needsOk itself.
  const dataDir = tmpDataDir(), brainPath = tmpBrainDir();
  const withWork = { priorities: [], delegations: [{ dept: 'sales', text: 'Email a brand-new prospect', dedupeKey: 'sales:new-prospect', hypothesis: 'h', evidence: 'e', owner: 'lexi', nextAction: 'n', expectedBenefit: 'b', actionClass: 'first-contact-or-committing', needsOkHint: true, complexity: 'reasoning' }], noAction: [], risks: [], brainNotes: [], escalateForDeepReasoning: false, escalationReason: '' };
  const out = await runCycle({ mode: 'morning', dataDir, brainPath, fetchImpl: fakeOfficeAndGateway(), spawnImpl: fakeReasoningSpawn(withWork) });
  assert.equal(out.summary.delegationsCreated.length, 0, 'must not be counted as auto-run');
  assert.equal(out.summary.delegationsAwaitingRun.length, 1);
  assert.equal(out.summary.delegationsAwaitingRun[0].dept, 'sales');
  assert.equal(out.summary.delegationsAwaitingRun[0].autoRan, false);
  const lessons = fs.readFileSync(path.join(brainPath, '90-Operations', 'ceo', 'lessons.md'), 'utf8');
  assert.match(lessons, /held for NAV to run himself/);
  fs.rmSync(dataDir, { recursive: true, force: true }); fs.rmSync(brainPath, { recursive: true, force: true });
  console.log('ok: a first-contact-or-committing delegation is created but held for NAV, and the cycle notes it in the Brain');
}

export async function testSilentlyOmittedDepartmentsAreFlagged() {
  // 2026-09-19 regression guard: sales gets a delegation, every other department gets
  // neither a delegation nor a noAction entry — exactly the live bug (marketing/fin/delivery
  // silently starved because no real signal view exists for them). The cycle must surface
  // this in the brain notes and in the summary, not let it pass as a clean "delegated" cycle.
  const dataDir = tmpDataDir(), brainPath = tmpBrainDir();
  const partial = { priorities: [{ headline: 'h', evidence: 'e', severity: 'attention' }], delegations: [{ dept: 'sales', text: 'do it', dedupeKey: 'sales:k1', hypothesis: 'h', evidence: 'e', owner: 'lexi', nextAction: 'n', expectedBenefit: 'b', actionClass: 'internal', needsOkHint: false, complexity: 'reasoning' }], noAction: [], risks: [], brainNotes: [], escalateForDeepReasoning: false, escalationReason: '' };
  const out = await runCycle({ mode: 'morning', dataDir, brainPath, fetchImpl: fakeOfficeAndGateway(), spawnImpl: fakeReasoningSpawn(partial) });
  assert.deepEqual(out.summary.departmentsSilentlyOmitted.sort(), ['delivery', 'emails', 'fin', 'marketing', 'ops']);
  const lessons = fs.readFileSync(path.join(brainPath, '90-Operations', 'ceo', 'lessons.md'), 'utf8');
  assert.match(lessons, /CEO SELF-CHECK/);
  assert.match(lessons, /marketing/);
  fs.rmSync(dataDir, { recursive: true, force: true }); fs.rmSync(brainPath, { recursive: true, force: true });
  console.log('ok: departments with neither a delegation nor a noAction reason are flagged, not silently dropped');
}

export async function testNoActionCoveredDepartmentsAreNotFlagged() {
  // The other side of the same guard: when every non-delegated department has an honest
  // noAction reason, that is NOT a silent omission and must not be flagged.
  const dataDir = tmpDataDir(), brainPath = tmpBrainDir();
  const covered = {
    priorities: [], delegations: [{ dept: 'sales', text: 'do it', dedupeKey: 'sales:k1', hypothesis: 'h', evidence: 'e', owner: 'lexi', nextAction: 'n', expectedBenefit: 'b', actionClass: 'internal', needsOkHint: false, complexity: 'reasoning' }],
    noAction: ['emails', 'marketing', 'ops', 'fin', 'delivery'].map(dept => ({ dept, reason: 'checked, nothing genuinely actionable this cycle' })),
    risks: [], brainNotes: [], escalateForDeepReasoning: false, escalationReason: '',
  };
  const out = await runCycle({ mode: 'morning', dataDir, brainPath, fetchImpl: fakeOfficeAndGateway(), spawnImpl: fakeReasoningSpawn(covered) });
  assert.deepEqual(out.summary.departmentsSilentlyOmitted, []);
  fs.rmSync(dataDir, { recursive: true, force: true }); fs.rmSync(brainPath, { recursive: true, force: true });
  console.log('ok: departments covered by an honest noAction reason are not flagged as silently omitted');
}

export async function testUnreachableEverythingSkipsCleanly() {
  const dataDir = tmpDataDir(), brainPath = tmpBrainDir();
  const fetchImpl = async () => { throw new Error('ECONNREFUSED'); };
  const out = await runCycle({ mode: 'morning', dataDir, brainPath, fetchImpl, spawnImpl: fakeReasoningSpawn({}) });
  assert.equal(out.ran, false);
  assert.match(out.reason, /unreachable/);
  fs.rmSync(dataDir, { recursive: true, force: true }); fs.rmSync(brainPath, { recursive: true, force: true });
  console.log('ok: total integration outage skips the cycle instead of fabricating a briefing');
}

export async function testLockPreventsOverlap() {
  const dataDir = tmpDataDir(), brainPath = tmpBrainDir();
  const { acquireCycleLock } = await import('./state.mjs');
  const held = acquireCycleLock(dataDir);
  assert.equal(held.acquired, true);
  const out = await runCycle({ mode: 'reassess', dataDir, brainPath, fetchImpl: fakeOfficeAndGateway(), spawnImpl: fakeReasoningSpawn({ priorities: [], delegations: [], noAction: [], risks: [], brainNotes: [], escalateForDeepReasoning: false, escalationReason: '' }) });
  assert.equal(out.ran, false);
  assert.match(out.reason, /already running/);
  held.release();
  fs.rmSync(dataDir, { recursive: true, force: true }); fs.rmSync(brainPath, { recursive: true, force: true });
  console.log('ok: an in-progress cycle blocks a concurrent one');
}

await testMorningCycleIsIdempotentPerDay();
await testNoEligibleWorkIsHonestOutcome();
await testDelegatesRealWork();
await testFirstContactDelegationAwaitsNavInsteadOfAutoRunning();
await testSilentlyOmittedDepartmentsAreFlagged();
await testNoActionCoveredDepartmentsAreNotFlagged();
await testUnreachableEverythingSkipsCleanly();
await testLockPreventsOverlap();
