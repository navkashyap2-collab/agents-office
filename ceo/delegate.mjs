// agents-office/ceo/delegate.mjs
// Delegation for the RESET AI CEO. Every delegated task goes through the SAME
// POST /api/tasks -> POST /api/tasks/:id/run path a human uses from the command
// bar. This module structurally cannot call /approve or /reject — that capability
// is deliberately absent, not just unused.
//
// 2026-09-19: verified by reading serve.mjs directly that POST /api/tasks/:id/run
// (the immediate-run path this module and the command bar both use) always runs a
// task straight through to 'done' — it never checks task.needsOk. The needsOk ->
// 'waiting' gate only exists for routines fired by the office's own clock and for
// scheduled ('at') tasks (see fire()/runServerTask() in serve.mjs). Left alone, this
// meant a CEO delegation to email a brand-new prospect, or quote a price, could run
// to completion with no chance for NAV to see it first — the "gated by the same
// needsOk router" description in ceo/role.md does not hold for this path. CLAUDE.md
// forbids editing serve.mjs for a roster/skill change, and this is not one, but the
// safer and more surgical fix is here anyway: delegate.mjs itself decides whether to
// call /run at all, based on the CEO's own honest actionClass for the task. Only
// 'internal' (no outside contact) and 'routine-outbound' (a follow-up to an existing
// contact, nothing new committed) auto-run. Anything else -- including a missing or
// unrecognised actionClass -- is created but left in 'next' for NAV to run himself.
// This is the actual approval gate for CEO-originated work now.
import { findOpenInitiative, loadInitiatives, saveInitiatives } from './state.mjs';

const AUTO_RUN_ACTION_CLASSES = new Set(['internal', 'routine-outbound']);

export async function delegate({ dept, text, dedupeKey, hypothesis, evidence, owner, nextAction, expectedBenefit, actionClass, model, effort, team, dataDir, officeBase = 'http://localhost:4523', fetchImpl = fetch }) {
  const doc = loadInitiatives(dataDir);
  const existing = findOpenInitiative(doc, dedupeKey);
  if (existing) {
    return { status: 'skipped-duplicate', taskId: existing.taskIds[existing.taskIds.length - 1] ?? null, initiativeId: existing.id, reason: `open initiative ${existing.id} already covers this` };
  }
  let created;
  try {
    const res = await fetchImpl(`${officeBase}/api/tasks`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dept, text, model, effort, team }) });
    if (!res.ok) return { status: 'error', taskId: null, initiativeId: null, reason: `create http-${res.status}` };
    created = await res.json();
  } catch (e) {
    return { status: 'error', taskId: null, initiativeId: null, reason: (e && e.message) || String(e) };
  }

  const recordInitiative = () => {
    const now = Date.now();
    const initiative = { id: created.id + '-init', dedupeKey, dept, hypothesis, evidence, owner, nextAction, expectedBenefit, status: 'open', taskIds: [created.id], createdAtMs: now, updatedAtMs: now, result: null };
    doc.initiatives.push(initiative);
    saveInitiatives(dataDir, doc);
    return initiative;
  };

  const autoRun = AUTO_RUN_ACTION_CLASSES.has(actionClass);
  if (!autoRun) {
    // Fail closed: the task exists on the board (state 'next') but is never run by the CEO
    // itself. NAV sees it and runs it himself when he's ready, exactly like anything he'd
    // type into the command bar — this is the wait-for-OK step the CEO's own docs already
    // claimed existed.
    const initiative = recordInitiative();
    return { status: 'created', taskId: created.id, initiativeId: initiative.id, reason: null, autoRan: false, awaitingRun: true };
  }

  try {
    await fetchImpl(`${officeBase}/api/tasks/${created.id}/run`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  } catch (e) {
    // The task exists even if kicking off the run failed to respond in time; the office's own
    // 20s routine clock does not pick up ad-hoc tasks, so record the failure honestly rather
    // than silently leaving an orphaned 'next' task unexplained.
    const initiative = recordInitiative();
    return { status: 'error', taskId: created.id, initiativeId: initiative.id, reason: 'created but run call failed: ' + ((e && e.message) || String(e)) };
  }
  const initiative = recordInitiative();
  return { status: 'created', taskId: created.id, initiativeId: initiative.id, reason: null, autoRan: true };
}

export function markInitiativeResult({ dataDir, initiativeId, status, result }) {
  const doc = loadInitiatives(dataDir);
  const i = doc.initiatives.find(x => x.id === initiativeId);
  if (!i) return false;
  i.status = status; i.result = result; i.updatedAtMs = Date.now();
  saveInitiatives(dataDir, doc);
  return true;
}
