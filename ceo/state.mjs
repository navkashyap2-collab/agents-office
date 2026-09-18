// agents-office/ceo/state.mjs
// Persistence + idempotency + dedup for the RESET AI CEO. Every write is a plain
// JSON file under <dataDir>/ceo/ — same durability model as data/tasks.json.
import fs from 'node:fs';
import path from 'node:path';

const ceoDir = dataDir => path.join(dataDir, 'ceo');
const stateFile = dataDir => path.join(ceoDir(dataDir), 'ceo-state.json');
const initiativesFile = dataDir => path.join(ceoDir(dataDir), 'initiatives.json');
const lockFile = dataDir => path.join(ceoDir(dataDir), 'cycle.lock');
const logFile = (dataDir, dateLocal) => path.join(ceoDir(dataDir), `log-${dateLocal}.jsonl`);

const readJSON = (p, fallback) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; } };
const writeJSON = (p, value) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(value, null, 2)); };

export function todayLocal(now = Date.now()) {
  const d = new Date(now);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function loadCeoState(dataDir) {
  return readJSON(stateFile(dataDir), { lastMorningCycleDateLocal: null, lastCycleAtMs: null, lastCycleSummary: null, cyclesRun: 0 });
}
export function saveCeoState(dataDir, state) { writeJSON(stateFile(dataDir), state); }

export function loadInitiatives(dataDir) {
  return readJSON(initiativesFile(dataDir), { initiatives: [] });
}
export function saveInitiatives(dataDir, doc) { writeJSON(initiativesFile(dataDir), doc); }

export function findOpenInitiative(doc, dedupeKey, windowMs = 14 * 24 * 60 * 60 * 1000, now = Date.now()) {
  const CLOSED = new Set(['done', 'rejected', 'abandoned']);
  return doc.initiatives.find(i => i.dedupeKey === dedupeKey && !CLOSED.has(i.status) && (now - i.createdAtMs) <= windowMs) || null;
}

export function appendCycleLog(dataDir, entry) {
  const p = logFile(dataDir, todayLocal());
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.appendFileSync(p, JSON.stringify({ atMs: Date.now(), ...entry }) + '\n');
}

function isPidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

export function acquireCycleLock(dataDir) {
  const p = lockFile(dataDir);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const existing = readJSON(p, null);
  if (existing && Number.isInteger(existing.pid) && isPidAlive(existing.pid)) {
    return { acquired: false, release: () => {} };
  }
  writeJSON(p, { pid: process.pid, atMs: Date.now() });
  return { acquired: true, release: () => { try { fs.unlinkSync(p); } catch {} } };
}
