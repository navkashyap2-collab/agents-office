// agents-office/ceo/delegate.mjs
// Delegation for the RESET AI CEO. Every delegated task goes through the SAME
// POST /api/tasks -> POST /api/tasks/:id/run path a human uses from the command
// bar, so the router, needsOk, model policy and approval flow all apply exactly
// as they do to Director-originated work. This module structurally cannot call
// /approve or /reject — that capability is deliberately absent, not just unused.
import { findOpenInitiative, loadInitiatives, saveInitiatives } from './state.mjs';

export async function delegate({ dept, text, dedupeKey, hypothesis, evidence, owner, nextAction, expectedBenefit, model, effort, team, dataDir, officeBase = 'http://localhost:4523', fetchImpl = fetch }) {
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
  try {
    await fetchImpl(`${officeBase}/api/tasks/${created.id}/run`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  } catch (e) {
    // The task exists even if kicking off the run failed to respond in time; the office's own
    // 20s routine clock does not pick up ad-hoc tasks, so record the failure honestly rather
    // than silently leaving an orphaned 'next' task unexplained.
    const now = Date.now();
    const initiative = { id: created.id + '-init', dedupeKey, dept, hypothesis, evidence, owner, nextAction, expectedBenefit, status: 'open', taskIds: [created.id], createdAtMs: now, updatedAtMs: now, result: null };
    doc.initiatives.push(initiative);
    saveInitiatives(dataDir, doc);
    return { status: 'error', taskId: created.id, initiativeId: initiative.id, reason: 'created but run call failed: ' + ((e && e.message) || String(e)) };
  }
  const now = Date.now();
  const initiative = { id: created.id + '-init', dedupeKey, dept, hypothesis, evidence, owner, nextAction, expectedBenefit, status: 'open', taskIds: [created.id], createdAtMs: now, updatedAtMs: now, result: null };
  doc.initiatives.push(initiative);
  saveInitiatives(dataDir, doc);
  return { status: 'created', taskId: created.id, initiativeId: initiative.id, reason: null };
}

export function markInitiativeResult({ dataDir, initiativeId, status, result }) {
  const doc = loadInitiatives(dataDir);
  const i = doc.initiatives.find(x => x.id === initiativeId);
  if (!i) return false;
  i.status = status; i.result = result; i.updatedAtMs = Date.now();
  saveInitiatives(dataDir, doc);
  return true;
}
