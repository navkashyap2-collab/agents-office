// agents-office/ceo/cycle.mjs
// The RESET AI CEO's daily/periodic cycle: gather real signals -> reconcile open
// initiatives against real task outcomes -> reason (sonnet, escalate to opus when
// flagged) -> delegate through the existing task engine -> persist state -> write
// durable Brain lessons. Runs as a standalone process via Task Scheduler; never
// runs inside serve.mjs, so a bug here cannot take down the Agents Office server.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gatherSignals } from './signals.mjs';
import { loadCeoState, saveCeoState, loadInitiatives, appendCycleLog, acquireCycleLock, todayLocal } from './state.mjs';
import { delegate, markInitiativeResult } from './delegate.mjs';
import { reasonWithEscalation } from './reason.mjs';

// agents-office/ (parent of ceo/) — the plan's own `path.dirname(fileURLToPath(...) + '/..')`
// string-concats '..' onto the file path before taking dirname, which yields the path to
// cycle.mjs itself, not its parent directory. Two dirname() calls is the correct pattern.
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function reconcileInitiatives(dataDir, signals) {
  const doc = loadInitiatives(dataDir);
  const byId = new Map([...signals.office.openTasks, ...signals.office.recentDone].map(t => [t.id, t]));
  for (const initiative of doc.initiatives) {
    if (initiative.status !== 'open') continue;
    const tasks = initiative.taskIds.map(id => byId.get(id)).filter(Boolean);
    if (tasks.length && tasks.every(t => t.state === 'done' || t.state === 'waiting')) {
      const last = tasks[tasks.length - 1];
      markInitiativeResult({ dataDir, initiativeId: initiative.id, status: last.state === 'waiting' ? 'awaiting-approval' : 'done', result: last.result || last.draft || null });
    }
  }
  return loadInitiatives(dataDir).initiatives.filter(i => i.status === 'open' || i.status === 'awaiting-approval');
}

function writeBrainLessons(brainPath, notes) {
  if (!notes.length) return;
  const dir = path.join(brainPath, '90-Operations', 'ceo');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'lessons.md');
  const header = fs.existsSync(file) ? '' : '# RESET AI CEO — durable lessons\n\nOne line per lesson, newest first, grouped by date. Never invented — only recorded after a real cycle observed it.\n\n';
  const today = todayLocal();
  const block = `## ${today}\n` + notes.map(n => `- ${n}`).join('\n') + '\n\n';
  fs.writeFileSync(file, header + block + (fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(header, '') : ''));
}

export async function runCycle({ mode, dataDir, brainPath, gatewayBase, officeBase, fetchImpl, spawnImpl, now = Date.now() }) {
  const ceoState = loadCeoState(dataDir);
  if (mode === 'morning' && ceoState.lastMorningCycleDateLocal === todayLocal(now)) {
    return { ran: false, reason: 'already ran today', summary: null };
  }
  const lock = acquireCycleLock(dataDir);
  if (!lock.acquired) return { ran: false, reason: 'another cycle is already running', summary: null };
  try {
    const signals = await gatherSignals({ gatewayBase, officeBase, fetchImpl });
    if (!signals.gateway.reachable && !signals.office.reachable) {
      appendCycleLog(dataDir, { mode, outcome: 'skipped', reason: 'both gateway and office unreachable' });
      return { ran: false, reason: 'both gateway and office unreachable', summary: null };
    }
    const openInitiatives = reconcileInitiatives(dataDir, signals);
    const { first, second, final } = await reasonWithEscalation({ signals, ceoState, openInitiatives, spawnImpl });
    const delegationsCreated = [], delegationsSkipped = [];
    for (const d of final.delegations) {
      const out = await delegate({ dept: d.dept, text: d.text, dedupeKey: d.dedupeKey, hypothesis: d.hypothesis, evidence: d.evidence, owner: d.owner, nextAction: d.nextAction, expectedBenefit: d.expectedBenefit, dataDir, officeBase, fetchImpl });
      (out.status === 'created' ? delegationsCreated : delegationsSkipped).push({ dept: d.dept, ...out });
    }
    writeBrainLessons(brainPath, final.brainNotes);
    const noEligibleWork = final.delegations.length === 0 && final.priorities.length === 0;
    const summary = {
      atMs: now, mode, priorities: final.priorities, delegationsCreated, delegationsSkipped, risks: final.risks,
      noEligibleWork, escalated: !!second, modelUsed: { first: first.modelUsed, second: second ? second.modelUsed : null },
    };
    const newState = { ...ceoState, lastCycleAtMs: now, lastCycleSummary: summary, cyclesRun: (ceoState.cyclesRun || 0) + 1, ...(mode === 'morning' ? { lastMorningCycleDateLocal: todayLocal(now) } : {}) };
    saveCeoState(dataDir, newState);
    appendCycleLog(dataDir, { mode, outcome: noEligibleWork ? 'no-eligible-work' : 'delegated', delegated: delegationsCreated.length, skipped: delegationsSkipped.length, escalated: !!second });
    return { ran: true, reason: null, summary };
  } finally {
    lock.release();
  }
}

// The plan's own `import.meta.url === \`file://${process.argv[1]}\`` never matches on
// Windows (backslashes, missing the third `/` after the scheme, drive-letter casing) —
// verified empirically. pathToFileURL is the correct, platform-safe comparison.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2] === '--reassess' ? 'reassess' : 'morning';
  const dataDir = path.join(ROOT, 'data');
  const brainPath = path.join(ROOT, 'brain-reset');
  runCycle({ mode, dataDir, brainPath })
    .then(out => { console.log(JSON.stringify(out, null, 2)); process.exit(0); })
    .catch(e => { console.error('CEO cycle failed:', e); process.exit(1); });
}
