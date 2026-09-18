# RESET AI CEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a persistent, evidence-driven CEO operating layer above the existing 6 department leads and 35 Agents Office workers that runs a daily (and periodic) autonomous cycle, delegates real cross-department work through the *existing* task engine, surfaces a Director Approval queue, and is visible in the existing 3D office — without touching the deterministic Reset backend, the task engine's safety gates, or any of the 35 workers' definitions.

**Architecture:** A new `agents-office/ceo/` Node module set (signals → reason → delegate → state) runs as a separate scheduled process (Windows Task Scheduler, via the existing `reset-office-ops` autostart infrastructure), reading real data through the already-live `reset-mcp-bridge` gateway and Agents Office's own internal HTTP API, and delegating work by calling the *same* `POST /api/tasks` → `POST /api/tasks/:id/run` endpoints a human uses from the command bar — so every existing safety gate (router, `needsOk`, model policy, approval flow) applies to CEO-originated work exactly as it does to Director-originated work. One new read-only `GET /api/ceo` route in `serve.mjs` exposes the CEO's persisted state to a new UI panel (`src/ceo-panel.js`), which cross-references the existing `/api/tasks` feed. The Director Approval queue is not a new mechanism — it is the existing `state:'waiting'` task flow, used well.

**Tech Stack:** Node.js (ESM, `.mjs`), the existing `agents-office` HTTP APIs, the existing `reset-mcp-bridge` gateway HTTP views, Windows Task Scheduler (via `reset-office-ops/reset-office-ctl.ps1`'s established patterns), the repo's own `check.mjs` `step()`/`ok()`/`bad()` test idiom (no external test framework is used anywhere in this codebase — follow it, don't introduce Jest/Mocha/etc.).

**Spec:** The full spec is the user's message in-conversation on 2026-09-18 ("Build RESET AI CEO as the permanent executive intelligence above my existing 6 department leads and 35 Agents Office workers…"). No separate spec file exists; this plan argues from that conversational spec directly, and the researched architecture notes below stand in for a design doc.

## Research findings this plan depends on

- **`agents-office/serve.mjs`**: `POST /api/tasks {dept, text, model, effort, team, at}` creates a task (`state:'next'`) with NO department restriction. A human/agent then calls `POST /api/tasks/:id/run` to execute it (two-step: create shows it on a desk, run executes). `route(dept, text)` (serve.mjs:213) does one Sonnet JSON call to pick the specific agent, a complexity tier (`fast`/`reasoning`/`strongest`), and `needsOk`. `pickFor()` (serve.mjs:250) resolves the final model via precedence `task > routine > router(complexity) > agent > office`, using `cfg.modelPolicy` from `office.config.local.json` (currently `fast: fable, reasoning: sonnet, strongest: opus`). Every task, once run, persists `modelUsed, modelFrom, modelId, routerComplexity, routerModel` in `data/tasks.json` — full provenance already exists, nothing new to build there. `needsOk:true` tasks land in `state:'waiting'` with a `task.draft`; `POST /api/tasks/:id/approve` or `/reject` (Director only) is the *entire* existing approval mechanism — this is what the Director Approval queue will reuse, unchanged.
- **`agents-office/routines.mjs`**: the *recurring routines* feature is hard-restricted to `ALLOWED = ['emails', 'fin', 'sales']` (routines.mjs:21) — this restriction does **not** apply to ad-hoc tasks via `/api/tasks`, only to the separate `routines.json` recurring-schedule feature. The CEO must never write to `routines.json` for departments outside that allow-list; it uses ad-hoc `/api/tasks` for everything, which has no such restriction.
- **`reset-mcp-bridge/gateway.mjs`**: exposes 12 read-only views over HTTP (`GET /view/<name>` on `127.0.0.1:4522`), including `ceo-priorities` (a real, already-computed alert list — e.g. currently flags `kill-switch-off` as `severity:'attention'`) and `funnel`, `agent-runs`, `system-health`, `department-status` (not in the VIEW_NAMES list actually served — confirm at Task 1 time via a live call, since a wrong assumption here would silently produce empty signals). `reset_run_agent` in the Reset backend only honestly executes for agent ids `ceo` and `analytics`, and those are deterministic inspect/hold functions (`agent-runtime.ts`, structurally `liveActionsEnabled:false`) — **not** the executive being built here. This new CEO is a distinct, higher, Claude-driven layer that treats the deterministic `ceo`/`analytics` outputs as one more input signal, never as itself.
- **`readCeoMetrics` (`src/ceo-metrics.ts` in the Reset repo)**: a real, pure, deterministic discovered→qualified→walkthrough→proposal→won cohort/revenue function exists but is **not wired into the live snapshot** (`readModel.ts`'s `loadSnapshot()` never calls it). Do not wire this up as part of this plan — it would require touching the production-adjacent Cloudflare-Worker-backed Reset repo's snapshot pipeline, which is out of scope and higher-risk than this plan needs. Instead: the CEO must explicitly report win-rate/margin/contract-value/retention as **"no verified source wired yet"** rather than inventing a substitute computation. Flag it once, in the status doc (Task 12), as a real, named data-infrastructure gap and a candidate future initiative — this is the correct, honest behaviour per the spec ("Never invent a KPI because the data is unavailable").
- **Department leads** (fixed ids, from `src/data.js`): `elead` (emails), `lexi` (sales), `mlead` (marketing), `olead` (ops), `alead` (fin/accounting), `dlead` (delivery). `DEPT_KEYS = ['emails','sales','marketing','ops','fin','delivery']`.
- **`brain-reset/CLAUDE.md`**: already instructs every desk on honest status reporting (`NO ELIGIBLE WORK`/`BLOCKED`/`HELD`/`ERROR`), the real reset-bridge tool set, model routing, and how a lead breaks a "whole department" command into real desk work via TEAM. This plan adds a CEO-specific section to it (Task 7) rather than re-teaching what leads already know.
- **`reset-office-ops/reset-office-ctl.ps1`**: existing Windows autostart/watchdog infra for the 4 always-on services (Command Centre :5183, Gateway :4522, Agents Office backend :4523, Viewer :4520). This plan adds new, separate Task Scheduler entries for the CEO cycle — it does not modify `reset-office-ctl.ps1`'s service list or its mutex/port-check logic.
- **UI**: `src/reset-status.js` is the established pattern for a small, honest, staleness-aware data module (`fetch` on an interval, mutable exported state object, `'—'`/`'stale'` rather than fabricated values on failure). The new `src/ceo-panel.js` follows this exact pattern. Wiring a new overlay/keybinding into `main.js`/`shell.html` follows the same convention as the existing B (company board)/G (brain graph)/P (calendar) panels — the exact wiring is read and matched at Task 8 time (those files are large; do not guess their structure in advance).

## Global Constraints

- Never modify: the deterministic Reset backend (`command-centre/src`, `command-centre/server`), `reset-mcp-bridge/gateway.mjs`'s existing views, `agents-office/office.agents.json`, `agents-office/roster.mjs`'s fixed-field enforcement, the 35-worker roster's `id`/`department`/`lead` fields, or any existing safety gate (`needsOk` logic, `liveActionsEnabled`, suppression/protection reads).
- The CEO may never call `POST /api/tasks/:id/approve`. This is enforced structurally: the CEO's HTTP client module (Task 3) must not implement that call at all.
- The CEO may never send an email, place a call, book an appointment, publish anything, or spend money. No such capability is wired anywhere in this stack; the plan must not add one.
- All new department delegation goes through `POST /api/tasks` (no department restriction) — never through `routines.json` (restricted to `emails`/`fin`/`sales`) for cross-department or Marketing/Ops/Delivery work.
- No task in this plan invents a business metric. Where a real source is not wired (e.g. win rate, margin), the CEO reports it as unavailable, not estimated.
- Every new script/module lives under `agents-office/ceo/` (backend logic) or `agents-office/src/` (one new UI file); every new data file lives under `agents-office/data/ceo/`. Nothing is written outside `agents-office/`, `reset-office-ops/`, and `brain-reset/` (docs/brain content only).
- Follow the repo's own test idiom: `check.mjs`'s `ok(name, detail)`/`bad(name, detail)`/`step(name, fn)` pattern. Do not add a new test framework or test runner.
- `npm run check` in `agents-office/` must report **64/64 or more** passing at every commit from Task 6 onward, never fewer.

---

## Task 1: CEO signals module — read-only, honest, non-fabricating data gathering

**Files:**
- Create: `agents-office/ceo/signals.mjs`
- Test: `agents-office/ceo/signals.test.mjs`

**Interfaces:**
- Consumes: nothing from earlier tasks (first task). Talks to `http://127.0.0.1:4522/view/<name>` (gateway) and `http://localhost:4523/api/*` (Agents Office backend — the fixed internal port from `reset-office-ops`).
- Produces: `export async function gatherSignals({ gatewayBase = 'http://127.0.0.1:4522', officeBase = 'http://localhost:4523', fetchImpl = fetch } = {})` returning:
  ```js
  {
    generatedAtMs: number,
    gateway: { reachable: boolean, health: object | null, reason: string | null },
    views: {
      ceoPriorities: array | null,   // null = genuinely unavailable, never []
      funnel: array | null,
      agentRuns: object | null,
      systemHealth: object | null,
      prospects: object | null,
      suppression: array | null,
      outbox: array | null,
      vaTasks: object | null,
      calls: object | null,
      gmailSignals: object | null,
    },
    office: {
      reachable: boolean,
      health: object | null,
      openTasks: array,     // GET /api/tasks filtered to state in ['next','doing','waiting','scheduled']
      recentDone: array,    // GET /api/tasks filtered to state 'done', last 50 by doneAt desc
    },
  }
  ```
  Every `views.*` field is `null` (not a guessed default) when the gateway view genuinely fails or 404s — callers must treat `null` as "no verified source," never as zero/empty-meaning-nothing-happening.

- [ ] **Step 1: Write the failing test for a reachable gateway + office**

```js
// agents-office/ceo/signals.test.mjs
import assert from 'node:assert/strict';
import { gatherSignals } from './signals.mjs';

const fakeFetch = (routes) => async (url) => {
  const u = new URL(url);
  const key = u.pathname;
  if (!(key in routes)) return { ok: false, status: 404, json: async () => ({ error: 'not-found' }) };
  const r = routes[key];
  return { ok: r.status < 300, status: r.status, json: async () => r.body };
};

export async function testReachable() {
  const fetchImpl = fakeFetch({
    '/health': { status: 200, body: { status: 'ok' } },
    '/view/ceo-priorities': { status: 200, body: { view: 'ceo-priorities', data: [{ id: 'x', severity: 'info', headline: 'h', evidence: 'e' }] } },
    '/view/funnel': { status: 200, body: { view: 'funnel', data: [{ stage: 'Sent', count: 2, prospectKeys: [] }] } },
    '/view/agent-runs': { status: 200, body: { view: 'agent-runs', data: { recent: [], health: [] } } },
    '/view/system-health': { status: 200, body: { view: 'system-health', data: { cronAlive: 'UNKNOWN', ingestionErrors24h: 0 } } },
    '/view/prospects': { status: 200, body: { view: 'prospects', data: { byStatus: {}, recent: [] } } },
    '/view/suppression': { status: 200, body: { view: 'suppression', data: [] } },
    '/view/outbox': { status: 200, body: { view: 'outbox', data: [] } },
    '/view/va-tasks': { status: 200, body: { view: 'va-tasks', data: { assignmentCounts: [], performance: [] } } },
    '/view/calls': { status: 200, body: { view: 'calls', data: { recentCalls: [], callCountsByVa: [] } } },
    '/view/gmail-signals': { status: 200, body: { view: 'gmail-signals', data: { signalCounts: {}, recentSignals: [], killSwitch: { state: 'off' } } } },
    '/api/health': { status: 200, body: { ok: true } },
    '/api/tasks': { status: 200, body: [{ id: 't1', state: 'next', dept: 'sales' }, { id: 't2', state: 'done', dept: 'fin', doneAt: 5 }] },
  });
  const out = await gatherSignals({ fetchImpl });
  assert.equal(out.gateway.reachable, true);
  assert.deepEqual(out.views.ceoPriorities, [{ id: 'x', severity: 'info', headline: 'h', evidence: 'e' }]);
  assert.equal(out.office.reachable, true);
  assert.equal(out.office.openTasks.length, 1);
  assert.equal(out.office.recentDone.length, 1);
  console.log('ok: gatherSignals reachable case');
}

export async function testGatewayDown() {
  const fetchImpl = async () => { throw new Error('ECONNREFUSED'); };
  const out = await gatherSignals({ fetchImpl });
  assert.equal(out.gateway.reachable, false);
  assert.equal(out.views.ceoPriorities, null);
  assert.equal(out.views.funnel, null);
  console.log('ok: gatherSignals gateway-down case reports null, not empty');
}

await testReachable();
await testGatewayDown();
```

- [ ] **Step 2: Run test to verify it fails (module doesn't exist yet)**

Run: `node agents-office/ceo/signals.test.mjs`
Expected: FAIL with `Cannot find module './signals.mjs'`

- [ ] **Step 3: Write the implementation**

```js
// agents-office/ceo/signals.mjs
// Read-only signal gathering for the RESET AI CEO cycle. Every field is either a
// real value from the gateway/office, or null — never a guessed/zero default. A
// null view means "no verified source right now," which callers (reason.mjs) must
// surface as a genuine data gap, not silently treat as "nothing is happening."
const VIEWS = {
  ceoPriorities: 'ceo-priorities', funnel: 'funnel', agentRuns: 'agent-runs',
  systemHealth: 'system-health', prospects: 'prospects', suppression: 'suppression',
  outbox: 'outbox', vaTasks: 'va-tasks', calls: 'calls', gmailSignals: 'gmail-signals',
};

async function safeJson(fetchImpl, url) {
  try {
    const r = await fetchImpl(url);
    if (!r.ok) return { ok: false, reason: `http-${r.status}` };
    return { ok: true, body: await r.json() };
  } catch (e) {
    return { ok: false, reason: (e && e.message) || String(e) };
  }
}

export async function gatherSignals({ gatewayBase = 'http://127.0.0.1:4522', officeBase = 'http://localhost:4523', fetchImpl = fetch } = {}) {
  const generatedAtMs = Date.now();
  const health = await safeJson(fetchImpl, `${gatewayBase}/health`);
  const gateway = { reachable: health.ok, health: health.ok ? health.body : null, reason: health.ok ? null : health.reason };

  const views = {};
  for (const [key, viewName] of Object.entries(VIEWS)) {
    const r = await safeJson(fetchImpl, `${gatewayBase}/view/${viewName}`);
    views[key] = r.ok ? (r.body?.data ?? null) : null;
  }

  const officeHealth = await safeJson(fetchImpl, `${officeBase}/api/health`);
  const officeTasks = await safeJson(fetchImpl, `${officeBase}/api/tasks`);
  const allTasks = officeTasks.ok && Array.isArray(officeTasks.body) ? officeTasks.body : [];
  const office = {
    reachable: officeHealth.ok,
    health: officeHealth.ok ? officeHealth.body : null,
    openTasks: allTasks.filter(t => ['next', 'doing', 'waiting', 'scheduled'].includes(t.state)),
    recentDone: allTasks.filter(t => t.state === 'done').sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).slice(0, 50),
  };

  return { generatedAtMs, gateway, views, office };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node agents-office/ceo/signals.test.mjs`
Expected: both `ok:` lines printed, exit code 0

- [ ] **Step 5: Commit**

```bash
git add agents-office/ceo/signals.mjs agents-office/ceo/signals.test.mjs
git commit -m "feat(ceo): add read-only signal gathering module"
```

---

## Task 2: CEO state/ledger module — persistence, idempotency, dedup

**Files:**
- Create: `agents-office/ceo/state.mjs`
- Test: `agents-office/ceo/state.test.mjs`

**Interfaces:**
- Consumes: nothing new from Task 1.
- Produces (all take `dataDir` explicitly — never hardcode `agents-office/data`, so tests can use a tmp dir):
  - `loadCeoState(dataDir) -> { lastMorningCycleDateLocal: string|null, lastCycleAtMs: number|null, lastCycleSummary: object|null, cyclesRun: number }`
  - `saveCeoState(dataDir, state)`
  - `loadInitiatives(dataDir) -> { initiatives: Array<{id, dedupeKey, dept, hypothesis, evidence, owner, nextAction, expectedBenefit, status, taskIds: string[], createdAtMs, updatedAtMs, result: string|null}> }`
  - `saveInitiatives(dataDir, doc)`
  - `findOpenInitiative(doc, dedupeKey, windowMs = 14*24*60*60*1000, now = Date.now()) -> initiative|null` — returns an initiative with the same `dedupeKey` created within `windowMs` whose `status` is not `'done'`/`'rejected'`/`'abandoned'`.
  - `appendCycleLog(dataDir, entry)` — appends one JSON line to `data/ceo/log-YYYY-MM-DD.jsonl` (local date), for audit trail.
  - `acquireCycleLock(dataDir) -> { acquired: boolean, release: () => void }` — a PID-file lock at `data/ceo/cycle.lock` (same pattern as `reset-office-ops`'s mutex: if the lock file's PID is a live process, refuse; otherwise take it and write our own PID).
  - `todayLocal(now = Date.now()) -> 'YYYY-MM-DD'` string helper.

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node agents-office/ceo/state.test.mjs`
Expected: FAIL with `Cannot find module './state.mjs'`

- [ ] **Step 3: Write the implementation**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node agents-office/ceo/state.test.mjs`
Expected: all four `ok:` lines printed, exit code 0

- [ ] **Step 5: Commit**

```bash
git add agents-office/ceo/state.mjs agents-office/ceo/state.test.mjs
git commit -m "feat(ceo): add persistent state, initiative ledger and cycle lock"
```

---

## Task 3: CEO delegation module — creates real tasks through the existing engine

**Files:**
- Create: `agents-office/ceo/delegate.mjs`
- Test: `agents-office/ceo/delegate.test.mjs`

**Interfaces:**
- Consumes: `findOpenInitiative`, `loadInitiatives`, `saveInitiatives` from Task 2 (`./state.mjs`).
- Produces:
  - `export async function delegate({ dept, text, dedupeKey, hypothesis, evidence, owner, nextAction, expectedBenefit, model, effort, team, dataDir, officeBase = 'http://localhost:4523', fetchImpl = fetch }) -> { status: 'created'|'skipped-duplicate'|'error', taskId: string|null, initiativeId: string|null, reason: string|null }`
    - Checks `findOpenInitiative` first; if found, returns `{status:'skipped-duplicate', taskId: existing.taskIds[existing.taskIds.length-1], initiativeId: existing.id, reason: 'open initiative <id> already covers this'}` and creates nothing.
    - Otherwise `POST ${officeBase}/api/tasks` with `{dept, text, model, effort, team}`, then `POST ${officeBase}/api/tasks/:id/run` (fire-and-forget: do not await its completion — the office runs it in-process and the CEO polls state later via `signals.mjs`'s `office.openTasks`/`recentDone`).
    - On success, appends a new initiative `{id, dedupeKey, dept, hypothesis, evidence, owner, nextAction, expectedBenefit, status:'open', taskIds:[taskId], createdAtMs, updatedAtMs, result:null}` via `loadInitiatives`/`saveInitiatives`.
    - This module contains **no function that calls `/approve` or `/reject`** — not merely unused, structurally absent, per the plan's global constraint.
  - `export function markInitiativeResult({ dataDir, initiativeId, status, result })` — called later (Task 5, during synthesis) once a delegated task reaches `done`/`waiting`, to close the loop on the ledger.

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node agents-office/ceo/delegate.test.mjs`
Expected: FAIL with `Cannot find module './delegate.mjs'`

- [ ] **Step 3: Write the implementation**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node agents-office/ceo/delegate.test.mjs`
Expected: all four `ok:` lines printed, exit code 0

- [ ] **Step 5: Commit**

```bash
git add agents-office/ceo/delegate.mjs agents-office/ceo/delegate.test.mjs
git commit -m "feat(ceo): add delegation via the existing task engine, with dedup"
```

---

## Task 4: CEO reasoning module — the Claude-driven synthesis, with self-escalation

**Files:**
- Create: `agents-office/ceo/reason.mjs`
- Test: `agents-office/ceo/reason.test.mjs`

**Interfaces:**
- Consumes: the `signals` object shape from Task 1 (`gatherSignals`'s return value) and the `state`/`initiatives` shapes from Task 2.
- Produces:
  - `export function buildCeoPrompt({ signals, ceoState, openInitiatives, businessName = 'Reset Commercial Cleaning' }) -> { system: string, user: string }` — pure, synchronous, fully testable without any process spawn. The prompt instructs the model: report only from the evidence given; never invent a metric, prospect, or figure; when evidence is missing say so; classify each recommended delegation's complexity (`fast`/`reasoning`/`strongest`) but do NOT force a model — the office's own router still applies unless the CEO has independently opus-level evidence a specific piece deserves it; flag (`"escalateForDeepReasoning": true/false` + `"escalationReason"`) at the top level if the overall situation contains a genuinely ambiguous or high-stakes call that a second, stronger pass should re-examine; never write anything the Director would need to approve as if it were already approved; you are creating tasks exactly as if the Director typed them into the command bar, you never approve or execute anything outbound yourself.
  - `export function parseCeoResponse(text) -> { priorities: [{headline, evidence, severity}], delegations: [{dept, text, dedupeKey, hypothesis, evidence, owner, nextAction, expectedBenefit, needsOkHint, complexity}], risks: [{headline, evidence}], brainNotes: [string], escalateForDeepReasoning: boolean, escalationReason: string }` — throws a clear error (not a silent empty object) on unparseable JSON, mirroring `serve.mjs`'s `parseJSON`.
  - `export async function runCeoReasoning({ signals, ceoState, openInitiatives, businessName, spawnImpl, model = 'sonnet' }) -> { raw: string, parsed: object, modelUsed: string }` — spawns `claude -p <user> --output-format stream-json --system-prompt <system> --model <model> --disallowedTools ... --no-chrome` (mirroring `serve.mjs` `askX`'s CLI invocation pattern, but standalone — no MCP tools needed here since all evidence is already gathered by `signals.mjs`; this call reasons over already-fetched data, it does not need live tool access). `spawnImpl` is injectable (defaults to `node:child_process`'s `spawn`) so tests never invoke a real `claude` process.
  - `export async function reasonWithEscalation({ signals, ceoState, openInitiatives, businessName, spawnImpl }) -> { first: <runCeoReasoning result>, second: <runCeoReasoning result>|null, final: parsed object }` — runs the sonnet pass; if `parsed.escalateForDeepReasoning` is true, runs a second `opus` pass with the same signals plus the first pass's output and `escalationReason` in the prompt, and `final` is the second pass's parsed result; otherwise `final` is the first pass's.

- [ ] **Step 1: Write the failing test**

```js
// agents-office/ceo/reason.test.mjs
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { buildCeoPrompt, parseCeoResponse, runCeoReasoning, reasonWithEscalation } from './reason.mjs';

const baseSignals = { generatedAtMs: 1, gateway: { reachable: true, health: {}, reason: null }, views: { ceoPriorities: [], funnel: [], agentRuns: null, systemHealth: null, prospects: null, suppression: null, outbox: null, vaTasks: null, calls: null, gmailSignals: null }, office: { reachable: true, health: {}, openTasks: [], recentDone: [] } };

export async function testBuildPromptMentionsNoFabrication() {
  const { system, user } = buildCeoPrompt({ signals: baseSignals, ceoState: { cyclesRun: 0 }, openInitiatives: [] });
  assert.match(system, /never invent|never fabricate/i);
  assert.match(user, /ceoPriorities/);
  console.log('ok: buildCeoPrompt includes anti-fabrication instruction and real signals');
}

export async function testParseValidJson() {
  const text = '```json\n' + JSON.stringify({ priorities: [{ headline: 'h', evidence: 'e', severity: 'info' }], delegations: [], risks: [], brainNotes: [], escalateForDeepReasoning: false, escalationReason: '' }) + '\n```';
  const parsed = parseCeoResponse(text);
  assert.equal(parsed.priorities.length, 1);
  assert.equal(parsed.escalateForDeepReasoning, false);
  console.log('ok: parseCeoResponse parses fenced JSON');
}

export async function testParseInvalidThrows() {
  assert.throws(() => parseCeoResponse('not json at all'));
  console.log('ok: parseCeoResponse throws on unparseable text, does not silently return {}');
}

function fakeSpawn(resultObj) {
  return () => {
    const p = new EventEmitter();
    p.stdout = new EventEmitter();
    p.stderr = new EventEmitter();
    setImmediate(() => {
      p.stdout.emit('data', Buffer.from(JSON.stringify({ type: 'result', result: JSON.stringify(resultObj), usage: {}, modelUsage: { 'claude-sonnet': {} } }) + '\n'));
      p.emit('close', 0);
    });
    return p;
  };
}

export async function testRunCeoReasoningParsesResult() {
  const resultObj = { priorities: [], delegations: [], risks: [], brainNotes: [], escalateForDeepReasoning: false, escalationReason: '' };
  const out = await runCeoReasoning({ signals: baseSignals, ceoState: { cyclesRun: 0 }, openInitiatives: [], spawnImpl: fakeSpawn(resultObj), model: 'sonnet' });
  assert.deepEqual(out.parsed, resultObj);
  console.log('ok: runCeoReasoning parses a fake claude CLI result');
}

export async function testEscalationRunsSecondPass() {
  const first = { priorities: [], delegations: [], risks: [], brainNotes: [], escalateForDeepReasoning: true, escalationReason: 'ambiguous strata pricing call' };
  const second = { priorities: [], delegations: [{ dept: 'sales', text: 't', dedupeKey: 'k', hypothesis: 'h', evidence: 'e', owner: 'lexi', nextAction: 'n', expectedBenefit: 'b', needsOkHint: false, complexity: 'strongest' }], risks: [], brainNotes: [], escalateForDeepReasoning: false, escalationReason: '' };
  let call = 0;
  const spawnImpl = () => (call++ === 0 ? fakeSpawn(first)() : fakeSpawn(second)());
  const out = await reasonWithEscalation({ signals: baseSignals, ceoState: { cyclesRun: 0 }, openInitiatives: [], spawnImpl });
  assert.equal(out.first.parsed.escalateForDeepReasoning, true);
  assert.ok(out.second, 'a second pass must run when escalateForDeepReasoning is true');
  assert.equal(out.final.delegations.length, 1);
  console.log('ok: reasonWithEscalation runs a second opus-tier pass when flagged');
}

export async function testNoEscalationSkipsSecondPass() {
  const first = { priorities: [], delegations: [], risks: [], brainNotes: [], escalateForDeepReasoning: false, escalationReason: '' };
  const spawnImpl = fakeSpawn(first);
  const out = await reasonWithEscalation({ signals: baseSignals, ceoState: { cyclesRun: 0 }, openInitiatives: [], spawnImpl });
  assert.equal(out.second, null);
  console.log('ok: reasonWithEscalation does not run a second pass when not flagged');
}

await testBuildPromptMentionsNoFabrication();
await testParseValidJson();
await testParseInvalidThrows();
await testRunCeoReasoningParsesResult();
await testEscalationRunsSecondPass();
await testNoEscalationSkipsSecondPass();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node agents-office/ceo/reason.test.mjs`
Expected: FAIL with `Cannot find module './reason.mjs'`

- [ ] **Step 3: Write the implementation**

```js
// agents-office/ceo/reason.mjs
// The CEO's own reasoning: a standalone `claude -p` call (mirroring serve.mjs's
// askX CLI pattern) over already-gathered real signals — no live tool access here,
// because signals.mjs already fetched everything honestly. Two-pass: a sonnet
// pass synthesises priorities/delegations/risks; if it flags escalateForDeepReasoning,
// a second opus pass re-examines just that situation with the first pass attached.
import { spawn as nodeSpawn } from 'node:child_process';

const ANTI_FABRICATION = 'Never invent, guess or fabricate a prospect, contact, revenue figure, metric, client requirement or result. ' +
  'A view that is null in the signals below means no verified source exists right now for that data — say so plainly; do not treat null as zero or as "nothing happening." ' +
  'When evidence is insufficient for a call, say HOLD and explain what is missing rather than guessing.';

export function buildCeoPrompt({ signals, ceoState, openInitiatives, businessName = 'Reset Commercial Cleaning' }) {
  const system = `You are the RESET AI CEO for ${businessName}, accountable to NAV as Director. ` +
    'You delegate to 6 department leads (elead=emails, lexi=sales, mlead=marketing, olead=ops, alead=fin, dlead=delivery) who run 35 specialist workers; you never do specialist work yourself. ' +
    'You are creating tasks exactly as if the Director typed them into the office\'s command bar — you never approve, execute, or bypass anything outbound yourself, and nothing you write should imply an outbound action has already happened. ' +
    ANTI_FABRICATION + ' Return ONLY a JSON object — no prose, no code fences.';
  const user = `CYCLE STATE\ncyclesRun: ${ceoState.cyclesRun}\nlastMorningCycleDateLocal: ${ceoState.lastMorningCycleDateLocal || 'never'}\n\n` +
    `OPEN INITIATIVES ALREADY IN FLIGHT (do not duplicate these — build on or close them instead)\n${JSON.stringify(openInitiatives, null, 2)}\n\n` +
    `REAL SIGNALS (generated ${new Date(signals.generatedAtMs).toISOString()})\ngateway.reachable: ${signals.gateway.reachable}\n` +
    `office.reachable: ${signals.office.reachable}\noffice.openTasks: ${signals.office.openTasks.length}\n\n` +
    `views (each field is a real value or null — null means unavailable, never zero):\n${JSON.stringify(signals.views, null, 2)}\n\n` +
    'Return: {"priorities":[{"headline":"...","evidence":"...","severity":"info|attention|action-needed"}],' +
    '"delegations":[{"dept":"emails|sales|marketing|ops|fin|delivery","text":"the exact task to hand a department, written as the Director would say it","dedupeKey":"dept:short-stable-slug","hypothesis":"why this matters commercially","evidence":"what real signal supports this","owner":"lead id","nextAction":"what happens after this task completes","expectedBenefit":"one sentence, no invented numbers","needsOkHint":true|false,"complexity":"fast|reasoning|strongest"}],' +
    '"risks":[{"headline":"...","evidence":"..."}],"brainNotes":["one durable lesson or fact worth recording, or omit"],' +
    '"escalateForDeepReasoning":true|false,"escalationReason":"only if true: the specific ambiguous or high-stakes call that needs deeper reasoning"}';
  return { system, user };
}

export function parseCeoResponse(text) {
  const s = String(text).replace(/```json|```/g, '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('CEO response did not contain a JSON object');
  const parsed = JSON.parse(s.slice(a, b + 1));
  return {
    priorities: Array.isArray(parsed.priorities) ? parsed.priorities : [],
    delegations: Array.isArray(parsed.delegations) ? parsed.delegations : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks : [],
    brainNotes: Array.isArray(parsed.brainNotes) ? parsed.brainNotes : [],
    escalateForDeepReasoning: parsed.escalateForDeepReasoning === true,
    escalationReason: String(parsed.escalationReason || ''),
  };
}

export async function runCeoReasoning({ signals, ceoState, openInitiatives, businessName, spawnImpl = nodeSpawn, model = 'sonnet' }) {
  const { system, user } = buildCeoPrompt({ signals, ceoState, openInitiatives, businessName });
  const args = ['-p', user, '--output-format', 'stream-json', '--verbose', '--no-session-persistence', '--system-prompt', system,
    '--disallowedTools', 'Bash,Edit,Write,Read,Glob,Grep,Agent,NotebookEdit,Task,WebFetch,WebSearch', '--no-chrome', '--model', model];
  return new Promise((resolve, reject) => {
    const p = spawnImpl('claude', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', text = '', gotResult = false, modelUsed = model;
    const timer = setTimeout(() => { p.kill && p.kill('SIGKILL'); reject(new Error('CEO reasoning took too long')); }, 180000);
    const feed = line => {
      if (!line.trim()) return;
      let j; try { j = JSON.parse(line); } catch { return; }
      if (j.type === 'result') { gotResult = true; text = String(j.result || '').trim(); modelUsed = Object.keys(j.modelUsage || {})[0] || model; }
    };
    p.stdout.on('data', d => { out += d; let i; while ((i = out.indexOf('\n')) >= 0) { feed(out.slice(0, i)); out = out.slice(i + 1); } });
    p.on('error', e => { clearTimeout(timer); reject(e); });
    p.on('close', () => {
      clearTimeout(timer); if (!gotResult) feed(out);
      if (!text) return reject(new Error('CEO reasoning returned nothing'));
      try { resolve({ raw: text, parsed: parseCeoResponse(text), modelUsed }); } catch (e) { reject(e); }
    });
  });
}

export async function reasonWithEscalation({ signals, ceoState, openInitiatives, businessName, spawnImpl = nodeSpawn }) {
  const first = await runCeoReasoning({ signals, ceoState, openInitiatives, businessName, spawnImpl, model: 'sonnet' });
  if (!first.parsed.escalateForDeepReasoning) return { first, second: null, final: first.parsed };
  const escalatedInitiatives = [...openInitiatives, { note: 'FIRST PASS FLAGGED FOR DEEPER REASONING', escalationReason: first.parsed.escalationReason, firstPassOutput: first.parsed }];
  const second = await runCeoReasoning({ signals, ceoState, openInitiatives: escalatedInitiatives, businessName, spawnImpl, model: 'opus' });
  return { first, second, final: second.parsed };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node agents-office/ceo/reason.test.mjs`
Expected: all six `ok:` lines printed, exit code 0

- [ ] **Step 5: Commit**

```bash
git add agents-office/ceo/reason.mjs agents-office/ceo/reason.test.mjs
git commit -m "feat(ceo): add two-pass Claude reasoning with self-escalation to opus"
```

---

## Task 5: CEO cycle orchestrator — the entry point Task Scheduler runs

**Files:**
- Create: `agents-office/ceo/cycle.mjs`
- Test: `agents-office/ceo/cycle.test.mjs`

**Interfaces:**
- Consumes: `gatherSignals` (Task 1), `loadCeoState`/`saveCeoState`/`loadInitiatives`/`appendCycleLog`/`acquireCycleLock`/`todayLocal` (Task 2), `delegate`/`markInitiativeResult` (Task 3), `reasonWithEscalation` (Task 4).
- Produces:
  - `export async function runCycle({ mode, dataDir, gatewayBase, officeBase, fetchImpl, spawnImpl, now = Date.now() }) -> { ran: boolean, reason: string|null, summary: object|null }` where `mode` is `'morning'` or `'reassess'`.
    - `mode:'morning'`: if `loadCeoState(dataDir).lastMorningCycleDateLocal === todayLocal(now)`, returns `{ran:false, reason:'already ran today', summary:null}` immediately (idempotent) without acquiring the lock or calling Claude.
    - Both modes: `acquireCycleLock`; if not acquired, returns `{ran:false, reason:'another cycle is already running', summary:null}`.
    - Gathers signals; if `!signals.gateway.reachable && !signals.office.reachable`, logs a `'recovery'`-labelled entry and returns `{ran:false, reason:'both gateway and office unreachable', summary:null}` (never fabricates a briefing from nothing) — releases the lock first.
    - Reconciles the initiative ledger against `signals.office.recentDone`/`openTasks` first: for any open initiative whose `taskIds` are now all `done` or `waiting` in the office's task list, calls `markInitiativeResult` with the matching task's `result`/`draft` and `state`.
    - Calls `reasonWithEscalation` with the gathered signals, current `ceoState`, and still-open initiatives.
    - For each `delegations[]` entry the reasoning produced, calls `delegate(...)`, respecting dedup; collects the outcomes.
    - If `delegations.length === 0` and `priorities.length === 0`, logs and returns a summary with `noEligibleWork: true` — this is a valid, expected, non-error outcome (never invents busywork to look active).
    - Writes `brainNotes` (if any) by appending them to `brain-reset/90-Operations/ceo/lessons.md` under today's date heading (create the file with a header if it doesn't exist yet).
    - Updates `ceoState` (`lastCycleAtMs`, `lastCycleSummary`, `cyclesRun += 1`, and for `mode:'morning'` also `lastMorningCycleDateLocal`), saves it, appends a cycle log entry, releases the lock, and returns `{ran:true, reason:null, summary}` where `summary` matches what `GET /api/ceo` will later serve (Task 6): `{ atMs, mode, priorities, delegationsCreated: [...], delegationsSkipped: [...], risks, noEligibleWork, escalated: boolean, modelUsed: {first, second} }`.
  - A CLI entry (`if (import.meta.url === \`file://${process.argv[1]}\`)`) that calls `runCycle({ mode: process.argv[2] === '--reassess' ? 'reassess' : 'morning', dataDir: path.join(ROOT, 'data'), brainPath: path.join(ROOT, 'brain-reset') })`, logs the outcome to stdout, and exits 0 on `ran:true` or a clean skip, exits 1 only on an unexpected thrown error (so Task Scheduler's `LastTaskResult` reflects genuine failures, not routine no-ops).

- [ ] **Step 1: Write the failing test**

```js
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
  const noWork = { priorities: [], delegations: [], risks: [], brainNotes: [], escalateForDeepReasoning: false, escalationReason: '' };
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
  const noWork = { priorities: [], delegations: [], risks: [], brainNotes: [], escalateForDeepReasoning: false, escalationReason: '' };
  const out = await runCycle({ mode: 'reassess', dataDir, brainPath, fetchImpl: fakeOfficeAndGateway(), spawnImpl: fakeReasoningSpawn(noWork) });
  assert.equal(out.ran, true);
  assert.equal(out.summary.noEligibleWork, true);
  assert.equal(out.summary.delegationsCreated.length, 0);
  fs.rmSync(dataDir, { recursive: true, force: true }); fs.rmSync(brainPath, { recursive: true, force: true });
  console.log('ok: no-eligible-work is a valid, non-fabricated outcome');
}

export async function testDelegatesRealWork() {
  const dataDir = tmpDataDir(), brainPath = tmpBrainDir();
  const withWork = { priorities: [{ headline: 'h', evidence: 'e', severity: 'attention' }], delegations: [{ dept: 'sales', text: 'do it', dedupeKey: 'sales:k1', hypothesis: 'h', evidence: 'e', owner: 'lexi', nextAction: 'n', expectedBenefit: 'b', needsOkHint: false, complexity: 'reasoning' }], risks: [], brainNotes: ['a durable lesson'], escalateForDeepReasoning: false, escalationReason: '' };
  const out = await runCycle({ mode: 'morning', dataDir, brainPath, fetchImpl: fakeOfficeAndGateway(), spawnImpl: fakeReasoningSpawn(withWork) });
  assert.equal(out.summary.delegationsCreated.length, 1);
  assert.equal(out.summary.delegationsCreated[0].dept, 'sales');
  const lessons = fs.readFileSync(path.join(brainPath, '90-Operations', 'ceo', 'lessons.md'), 'utf8');
  assert.match(lessons, /a durable lesson/);
  fs.rmSync(dataDir, { recursive: true, force: true }); fs.rmSync(brainPath, { recursive: true, force: true });
  console.log('ok: real delegations are created and brain notes are written');
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
  const out = await runCycle({ mode: 'reassess', dataDir, brainPath, fetchImpl: fakeOfficeAndGateway(), spawnImpl: fakeReasoningSpawn({ priorities: [], delegations: [], risks: [], brainNotes: [], escalateForDeepReasoning: false, escalationReason: '' }) });
  assert.equal(out.ran, false);
  assert.match(out.reason, /already running/);
  held.release();
  fs.rmSync(dataDir, { recursive: true, force: true }); fs.rmSync(brainPath, { recursive: true, force: true });
  console.log('ok: an in-progress cycle blocks a concurrent one');
}

await testMorningCycleIsIdempotentPerDay();
await testNoEligibleWorkIsHonestOutcome();
await testDelegatesRealWork();
await testUnreachableEverythingSkipsCleanly();
await testLockPreventsOverlap();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node agents-office/ceo/cycle.test.mjs`
Expected: FAIL with `Cannot find module './cycle.mjs'`

- [ ] **Step 3: Write the implementation**

```js
// agents-office/ceo/cycle.mjs
// The RESET AI CEO's daily/periodic cycle: gather real signals -> reconcile open
// initiatives against real task outcomes -> reason (sonnet, escalate to opus when
// flagged) -> delegate through the existing task engine -> persist state -> write
// durable Brain lessons. Runs as a standalone process via Task Scheduler; never
// runs inside serve.mjs, so a bug here cannot take down the Agents Office server.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gatherSignals } from './signals.mjs';
import { loadCeoState, saveCeoState, loadInitiatives, appendCycleLog, acquireCycleLock, todayLocal } from './state.mjs';
import { delegate, markInitiativeResult } from './delegate.mjs';
import { reasonWithEscalation } from './reason.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url) + '/..');

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

if (import.meta.url === `file://${process.argv[1]}`) {
  const mode = process.argv[2] === '--reassess' ? 'reassess' : 'morning';
  const dataDir = path.join(ROOT, 'data');
  const brainPath = path.join(ROOT, 'brain-reset');
  runCycle({ mode, dataDir, brainPath })
    .then(out => { console.log(JSON.stringify(out, null, 2)); process.exit(0); })
    .catch(e => { console.error('CEO cycle failed:', e); process.exit(1); });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node agents-office/ceo/cycle.test.mjs`
Expected: all five `ok:` lines printed, exit code 0

- [ ] **Step 5: Commit**

```bash
git add agents-office/ceo/cycle.mjs agents-office/ceo/cycle.test.mjs
git commit -m "feat(ceo): add the daily/periodic cycle orchestrator with idempotency and honest no-eligible-work handling"
```

---

## Task 6: One new read-only route — `GET /api/ceo` in serve.mjs

**Files:**
- Modify: `agents-office/serve.mjs` (add one route near the other `GET` routes, e.g. after the `/api/reset-status` line ~489)
- Modify: `agents-office/check.mjs` (add one new `step()` to the existing server-smoke section)

**Interfaces:**
- Consumes: `agents-office/data/ceo/ceo-state.json` (written by Task 5's `cycle.mjs`, via `loadCeoState` from `state.mjs`).
- Produces: `GET /api/ceo -> 200 { available: boolean, state: object|null }`. `available:false, state:null` (never a 500, never a guessed default) when the file does not exist yet — mirrors the existing `/api/reset-status`/`/api/usage` "unavailable is an honest answer" convention already used elsewhere in this file.

- [ ] **Step 1: Add the route**

In `agents-office/serve.mjs`, near line 489 (right after the `/api/reset-status` route), add:

```js
    if (url.pathname === '/api/ceo') { // RESET AI CEO: read-only, written by ceo/cycle.mjs — never a 500, missing state is an honest answer
      try { return json(res, 200, { available: true, state: JSON.parse(fs.readFileSync(path.join(DATA, 'ceo', 'ceo-state.json'), 'utf8')) }); }
      catch { return json(res, 200, { available: false, state: null }); }
    }
```

(`DATA` and `fs`/`path` are already imported/defined at the top of `serve.mjs` — no new imports needed.)

- [ ] **Step 2: Add a check.mjs regression test for the new route**

In `agents-office/check.mjs`, in the "server smoke" section (near the existing `await step('server: /api/health carries the roster', ...)` block, around line 486), add:

```js
    await step('server: /api/ceo is an honest read (available:false when no cycle has run)', async () => {
      const r = await (await fetch(base + '/api/ceo')).json();
      if (typeof r.available !== 'boolean') throw new Error('missing available flag');
      if (r.available === false && r.state !== null) throw new Error('unavailable must report state:null, not a guessed default');
      return `available: ${r.available}`;
    });
```

- [ ] **Step 3: Run the full existing check suite to confirm no regression**

Run: `cd agents-office && npm run check`
Expected: `65/65 checks passed` (the prior 64 plus this one new test), all green, none of the original 64 weakened.

- [ ] **Step 4: Commit**

```bash
git add agents-office/serve.mjs agents-office/check.mjs
git commit -m "feat(ceo): expose read-only GET /api/ceo, verified against the existing check suite"
```

---

## Task 7: Brain content — how leads/workers recognise and format CEO-originated work

**Files:**
- Modify: `agents-office/brain-reset/CLAUDE.md` (append one new section)
- Create: `agents-office/brain-reset/90-Operations/ceo/role.md`
- Create: `agents-office/brain-reset/90-Operations/ceo/growth-initiatives.md` (a durable, human-and-agent-readable mirror of the initiative ledger's *narrative*, not a duplicate of the JSON — the JSON in `data/ceo/initiatives.json` remains the source of truth for state; this file is where a strong idea's story gets written up once it proves out, per the spec's "store durable lessons in the Reset Brain")
- (`90-Operations/ceo/lessons.md` is created automatically by `cycle.mjs` — Task 5 — the first time it has a lesson to write; nothing to do here.)

**Interfaces:** none (pure content). This task has no automated test; verify by reading the resulting files.

- [ ] **Step 1: Append the CEO section to `brain-reset/CLAUDE.md`**

Add this section after the existing "## Broad director commands" section (end of file):

```markdown

## The RESET AI CEO

A task whose text begins with the exact tag `[CEO]` was created by the RESET AI CEO's own daily/periodic cycle (`agents-office/ceo/`), not typed by NAV directly — but it goes through the exact same command-bar path (`POST /api/tasks`), the exact same router, and the exact same `needsOk` gate as anything NAV types. Treat it exactly as you would treat NAV's own instruction: there is no separate "CEO mode." The one difference is in how you write your result when the work is genuinely consequential enough to need NAV's OK:

**If your result needs NAV's approval (`needsOk` is true), structure your final section as an escalation, not a plain draft:**

```
ESCALATION
What happened: <one or two sentences, evidence-based>
Evidence: <the specific real source — a monday.com item id, a Gmail thread, a real count from a reset-bridge tool>
Recommended action: <the specific next step you recommend>
Expected impact: <commercial upside, only if defensible from real evidence — say "not quantifiable from current data" rather than invent a number>
Downside / risk: <what could go wrong, or what you are uncertain about>
Decision needed: <the exact yes/no or choice NAV needs to make>
```

This is not a new mechanism — it is the same WAITING ON APPROVAL flow every routine draft already uses (`/api/tasks/:id/approve` or `/reject`). Writing your result in this shape just makes a CEO-originated escalation as clear to NAV as a one-line question, instead of requiring him to read a whole draft to find the actual decision.

The CEO itself never approves, executes, or bypasses anything outbound — only NAV can do that, exactly as before.
```

- [ ] **Step 2: Write `90-Operations/ceo/role.md`**

```markdown
---
department: ops
---
# RESET AI CEO — role and operating boundaries

Not a 36th desk, not a chatbot, not a task router. A separate, scheduled process (`agents-office/ceo/cycle.mjs`, run by Windows Task Scheduler — see `reset-office-ops/register-ceo-tasks.ps1`) that runs once each morning and periodically during working hours, reads real signals (the reset-bridge gateway's views + the office's own task state — never fabricated), reasons about company-wide priorities (Sonnet, escalating to Opus for genuinely difficult calls it flags itself), and delegates real work to the 6 department leads through the exact same `POST /api/tasks` path NAV's own command bar uses.

**What it can do on its own:** research, verification, qualification, scoring, analysis, comparison, planning, drafting, internal documentation, Brain updates, delegation to leads/workers — all read/prepare work, gated by the same `needsOk` router every task already goes through.

**What it can never do:** approve or reject a waiting task (that capability does not exist in its code, not just unused), send an email, place a call, book an appointment, publish anything, or spend money. No payment capability exists anywhere in this stack for it to misuse.

**Duplicate prevention:** every delegation is checked against `data/ceo/initiatives.json` by a stable `dedupeKey` before a task is created; an open initiative covering the same ground is built on or left alone, never duplicated.

**Idempotency:** the morning cycle runs at most once per local calendar day (`data/ceo/ceo-state.json`'s `lastMorningCycleDateLocal`); a lock file (`data/ceo/cycle.lock`) prevents two cycles overlapping.

**Honesty:** a cycle with nothing genuinely eligible logs `no-eligible-work` and creates zero tasks — a quiet office is the correct outcome when there is nothing real to do, not a failure to paper over.

See `agents-office-system-status.md` for verified current status and test evidence.
```

- [ ] **Step 3: Write `90-Operations/ceo/growth-initiatives.md`**

```markdown
---
department: ops
---
# RESET AI CEO — growth initiatives (narrative log)

The source of truth for initiative *state* is `agents-office/data/ceo/initiatives.json` (machine-read/written every cycle). This file is where a hypothesis that proved out — or clearly failed — gets a short human-readable writeup once there is a real result, so the reasoning survives even if the JSON ledger is ever pruned. Nothing is added here until a cycle has produced a real, evidenced outcome.

(Empty until the first cycle produces evidence-backed results — see Task 10's empirical test run for the first real entries.)
```

- [ ] **Step 4: Commit**

```bash
git add agents-office/brain-reset/CLAUDE.md agents-office/brain-reset/90-Operations/ceo/role.md agents-office/brain-reset/90-Operations/ceo/growth-initiatives.md
git commit -m "docs(ceo): teach leads/workers to recognise and format CEO-originated escalations; add CEO role note"
```

---

## Task 8: UI panel — CEO briefing, visible in the existing 3D office

**Files:**
- Create: `agents-office/src/ceo-panel.js` (data-fetching module, following `src/reset-status.js`'s exact pattern)
- Modify: `agents-office/src/main.js` (wire a new keybinding + call the panel's render/toggle — read the existing B/G/P wiring first, at implementation time, and match its convention exactly)
- Modify: `agents-office/src/shell.html` (add the panel's DOM container + a top-bar indicator, following the existing top-bar element convention)
- Modify: `agents-office/check.mjs` (one new Playwright smoke test)

**Interfaces:**
- Consumes: `GET /api/ceo` (Task 6) and the existing, already-polled `GET /api/tasks` (for cross-referencing `state:'waiting'` tasks against `data/ceo/initiatives.json`'s taskIds, which `/api/ceo`'s `state.lastCycleSummary.delegationsCreated[].taskId` already provides — no new endpoint needed for this join).
- Produces: `export const CEO = { state: 'loading'|'ok'|'stale'|'unavailable', data: object|null, fetchedAtMs: null }` and `export async function refreshCeo()` (identical shape/contract to `reset-status.js`'s `RESET`/`refreshReset`), plus `export function ceoPanelHtml()` returning the panel's inner HTML string (priorities today, active delegations by department, risks/blockers, and which open tasks are CEO-originated escalations awaiting NAV's OK), and `export function toggleCeoPanel()` that shows/hides it — named and shaped to match whatever convention `toggleBoard()`/`toggleBrain()`/`toggleCalendar()` (or their equivalents) already use in `main.js`, discovered by reading that file at this task's start rather than assumed here.

- [ ] **Step 1: Read the existing panel-toggle convention before writing any UI code**

Run: `grep -n "reset-status\|toggleBoard\|toggleBrain\|toggleCalendar\|case 'b'\|case 'g'\|case 'p'" agents-office/src/main.js`

Note the exact function names, the keybinding dispatch structure, and how `reset-status.js`'s `RESET` object is imported and rendered into `shell.html`'s DOM (search `shell.html` for the id `reset-status.js` writes into, e.g. via `grep -n "resetStatus\|RESET\." agents-office/src/main.js agents-office/src/shell.html`). Match this exactly for the new CEO panel — do not invent a new convention.

- [ ] **Step 2: Write `src/ceo-panel.js`**

```js
// RESET AI CEO — briefing panel data module. Same honesty contract as
// reset-status.js: a fetch failure keeps the last real values but flips state
// to 'stale' with the original timestamp; it never invents a value.
export const CEO = { state: 'loading', data: null, fetchedAtMs: null, reason: '' };

let lastGoodData = null;
let lastGoodAt = null;

export async function refreshCeo() {
  try {
    const r = await fetch('/api/ceo', { cache: 'no-store' });
    if (!r.ok) throw new Error('http-' + r.status);
    const body = await r.json();
    if (!body.available) throw new Error('no-cycle-has-run-yet');
    lastGoodData = body.state; lastGoodAt = body.state.lastCycleAtMs;
    Object.assign(CEO, { state: 'ok', data: body.state, fetchedAtMs: lastGoodAt, reason: '' });
  } catch (e) {
    const reason = String((e && e.message) || e);
    if (lastGoodData) Object.assign(CEO, { state: 'stale', data: lastGoodData, fetchedAtMs: lastGoodAt, reason });
    else Object.assign(CEO, { state: 'unavailable', data: null, fetchedAtMs: null, reason });
  }
  return CEO;
}

/** Plain-text/HTML summary for the panel — every field guards for a still-loading/unavailable CEO. */
export function ceoPanelHtml() {
  if (CEO.state === 'unavailable') return `<div class="ceo-empty">No CEO cycle has run yet.</div>`;
  const s = CEO.data.lastCycleSummary;
  if (!s) return `<div class="ceo-empty">CEO is running its first cycle.</div>`;
  const staleNote = CEO.state === 'stale' ? `<div class="ceo-stale">Showing the last real briefing (${new Date(CEO.fetchedAtMs).toLocaleString()}) — ${CEO.reason}</div>` : '';
  const priorities = (s.priorities || []).map(p => `<li class="ceo-pri ceo-${p.severity}">${p.headline} — <span class="ceo-evidence">${p.evidence}</span></li>`).join('') || '<li>No priorities flagged this cycle.</li>';
  const delegated = (s.delegationsCreated || []).map(d => `<li>${d.dept}: task ${d.taskId}</li>`).join('') || '<li>Nothing delegated this cycle.</li>';
  const risks = (s.risks || []).map(r => `<li>${r.headline} — <span class="ceo-evidence">${r.evidence}</span></li>`).join('') || '<li>No risks flagged.</li>';
  return `${staleNote}<h3>Priorities</h3><ul>${priorities}</ul><h3>Delegated this cycle</h3><ul>${delegated}</ul><h3>Risks / blockers</h3><ul>${risks}</ul>` +
    `<div class="ceo-meta">Cycle ${s.mode} · ${new Date(s.atMs).toLocaleString()} · model ${s.modelUsed.first}${s.modelUsed.second ? ' → escalated to ' + s.modelUsed.second : ''}${s.noEligibleWork ? ' · no eligible work found' : ''}</div>`;
}

if (typeof location !== 'undefined' && location.protocol.startsWith('http')) {
  refreshCeo();
  setInterval(refreshCeo, 30000);
}
```

- [ ] **Step 3: Wire the panel into `main.js` and `shell.html`, matching the discovered convention**

Using the exact toggle/keybinding/DOM pattern found in Step 1 (function names will differ from this sketch — match what's actually there):
- Add an import of `{ CEO, refreshCeo, ceoPanelHtml }` from `./ceo-panel.js` in `main.js`.
- Add a keybinding (pick an unused key — confirm it's unused via the same grep from Step 1) that shows/hides a new panel element, rendering `ceoPanelHtml()` into it on open and on each `refreshCeo()` tick while open.
- Add the panel's container `<div>` in `shell.html`, styled consistently with the existing calendar/board panel's CSS classes (reuse them, do not invent a parallel design system for one panel).
- Add a small top-bar indicator element (mirroring how `reset-status.js`'s badge is shown in the top bar, per Step 1's findings) that shows a dot when `CEO.data.lastCycleSummary` has unread priorities/risks since the panel was last opened.

- [ ] **Step 4: Rebuild the bundle**

Run: `cd agents-office && node build.mjs`
Expected: exits 0, `dist/command-centre-v2.html` rebuilt (check.mjs's own first test, "build: braingraph + bundle", already verifies this doesn't silently produce a too-small bundle).

- [ ] **Step 5: Add one Playwright smoke test to `check.mjs`**

In the existing browser-smoke section (near the other `await page.evaluate(...)` steps, e.g. after the "approval flow reaches the panel" step), add:

```js
    await step('smoke: CEO panel opens and shows an honest empty state before any cycle has run', async () => {
      await page.keyboard.press('<the key chosen in Step 3>');
      await page.waitForTimeout(300);
      const shown = await page.evaluate(() => document.querySelector('.ceo-panel')?.textContent || '');
      if (!/No CEO cycle has run yet|Priorities/.test(shown)) throw new Error('CEO panel did not render an honest state: ' + shown.slice(0, 200));
      await page.keyboard.press('Escape');
    });
```

(Adjust the selector `.ceo-panel` to whatever class name Step 3 actually used.)

- [ ] **Step 6: Run the full check suite**

Run: `cd agents-office && npm run check`
Expected: `66/66 checks passed` (65 from Task 6 plus this one), all green.

- [ ] **Step 7: Commit**

```bash
git add agents-office/src/ceo-panel.js agents-office/src/main.js agents-office/src/shell.html agents-office/check.mjs agents-office/dist/command-centre-v2.html
git commit -m "feat(ceo): add CEO briefing panel to the existing 3D office, no 36th desk"
```

---

## Task 9: Windows scheduling — morning cycle + periodic reassessment

**Files:**
- Create: `reset-office-ops/register-ceo-tasks.ps1` (a persisted, re-runnable script — not just ad hoc commands — mirroring the style already used when `reset-office-ops`'s AutoStart/Watchdog tasks were registered)
- (No changes to `reset-office-ops/reset-office-ctl.ps1` — the 4 core services' supervision is untouched.)

**Interfaces:** none code-level; this task's "interface" is two Windows Scheduled Tasks whose Action always runs `node "C:\Users\Navka\Documents\agents-office\ceo\cycle.mjs" [--reassess]` with working directory `C:\Users\Navka\Documents\agents-office`.

- [ ] **Step 1: Write `reset-office-ops/register-ceo-tasks.ps1`**

```powershell
# Registers the two RESET AI CEO Task Scheduler entries. Safe to re-run (Force).
# Does not touch ResetAgentsOffice-AutoStart/-Watchdog or reset-office-ctl.ps1.
$AO = 'C:\Users\Navka\Documents\agents-office'
$NodeExe = (Get-Command node -ErrorAction Stop).Source
$User = "$env:USERDOMAIN\$env:USERNAME"

# --- Morning cycle: runs once, well after AutoStart has brought the 4 services up ---
$morningAction = New-ScheduledTaskAction -Execute $NodeExe -Argument "`"$AO\ceo\cycle.mjs`"" -WorkingDirectory $AO
$morningTrigger = New-ScheduledTaskTrigger -AtLogOn -User $User
$morningTrigger.Delay = 'PT3M' # AutoStart's own services need ~10-30s; give the whole stack a generous head start
$morningSettings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$morningPrincipal = New-ScheduledTaskPrincipal -UserId $User -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'ResetAgentsOffice-CEO-Morning' -Action $morningAction -Trigger $morningTrigger -Settings $morningSettings -Principal $morningPrincipal -Force -Description 'Runs the RESET AI CEO morning cycle once per day, after the core services autostart.'

# --- Periodic reassessment: every 2 hours during working hours, weekdays ---
$reassessAction = New-ScheduledTaskAction -Execute $NodeExe -Argument "`"$AO\ceo\cycle.mjs`" --reassess" -WorkingDirectory $AO
$reassessTrigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday -At '09:30' -WeeksInterval 1
$reassessTrigger.Repetition = (New-ScheduledTaskTrigger -Once -At '09:30' -RepetitionInterval (New-TimeSpan -Hours 2) -RepetitionDuration (New-TimeSpan -Hours 9)).Repetition
$reassessSettings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$reassessPrincipal = New-ScheduledTaskPrincipal -UserId $User -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'ResetAgentsOffice-CEO-Reassess' -Action $reassessAction -Trigger $reassessTrigger -Settings $reassessSettings -Principal $reassessPrincipal -Force -Description 'Re-checks for meaningful new signals every 2 hours, weekdays 9:30am-6:30pm, and delegates follow-on work only when genuinely warranted.'

Write-Output "Registered: ResetAgentsOffice-CEO-Morning, ResetAgentsOffice-CEO-Reassess"
Get-ScheduledTask -TaskName 'ResetAgentsOffice-CEO-*' | Select-Object TaskName, State
```

- [ ] **Step 2: Run it**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Navka\Documents\reset-office-ops\register-ceo-tasks.ps1"`
Expected: both tasks print `State: Ready`.

- [ ] **Step 3: Verify the trigger repetition is actually what was intended**

Run: `powershell -NoProfile -Command "(Get-ScheduledTask -TaskName 'ResetAgentsOffice-CEO-Reassess').Triggers.Repetition | Format-List *"`
Expected: `Interval: PT2H`, `Duration: PT9H`, matching a 9:30am-6:30pm weekday window.

- [ ] **Step 4: Commit**

```bash
git add reset-office-ops/register-ceo-tasks.ps1
git commit -m "feat(ceo): register Windows Task Scheduler entries for the CEO morning cycle and periodic reassessment"
```

(`reset-office-ops` may not be a git repo — if `git add` fails with "not a git repository," skip the commit for this task only; the file itself is still in place.)

---

## Task 10: Empirical end-to-end test — real data, every required scenario

**Files:** none created; this task produces evidence (command output, `data/ceo/log-*.jsonl` entries, `data/ceo/initiatives.json` contents, `data/tasks.json` entries, `brain-reset/90-Operations/ceo/lessons.md` and `growth-initiatives.md` content) that Task 12 cites directly. No fabricated data anywhere in this task — every scenario is produced by real conditions, not mocked inputs.

- [ ] **Step 1: Confirm the 4 core services are up**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Navka\Documents\reset-office-ops\reset-office-ctl.ps1" -Action Status`
Expected: all 4 healthy (Command Centre, Gateway, Agents Office backend, Viewer), per the existing, already-verified autostart system.

- [ ] **Step 2: Run a real morning cycle against real data**

Run: `node "C:\Users\Navka\Documents\agents-office\ceo\cycle.mjs"`
Record: the printed JSON summary. Check `data/ceo/ceo-state.json`, `data/ceo/initiatives.json`, `data/ceo/log-<today>.jsonl` were written.

- [ ] **Step 3: Verify no-eligible-work OR real delegation, whichever the real data produces — do not force one**

If `summary.noEligibleWork` is true: confirm zero tasks were created (`GET http://localhost:4523/api/tasks` count unchanged from before Step 2) and the log records `outcome: 'no-eligible-work'`. This is a fully valid pass.
If delegations were created: for each `delegationsCreated[]` entry, confirm via `GET http://localhost:4523/api/tasks` that a real task now exists with that id, in the stated department, and that it reaches `state: 'doing'` then `'done'` or `'waiting'` within its normal run time (poll, do not assume).

- [ ] **Step 4: Test idempotency — immediately run the morning cycle again**

Run: `node "C:\Users\Navka\Documents\agents-office\ceo\cycle.mjs"`
Expected: `{ ran: false, reason: 'already ran today' }`. No new tasks, no new initiatives.

- [ ] **Step 5: Test the periodic-reassessment path and its dedup against Step 2/3's initiatives**

Run: `node "C:\Users\Navka\Documents\agents-office\ceo\cycle.mjs" --reassess`
Expected: runs (reassess mode is not date-gated), and if the same underlying signal that produced a Step 3 delegation is still present, confirm via `data/ceo/initiatives.json` that no duplicate initiative with the same `dedupeKey` was created — either zero new delegations, or a `delegationsSkipped` entry citing the open initiative.

- [ ] **Step 6: Test cross-department delegation, if real signals warrant it**

If the real signals from Step 2/5 only produced single-department delegations, manually construct one genuinely cross-department scenario using real (not fabricated) evidence already visible in the live data — e.g. if `reset_ceo_priorities`' `phone-first-queue` item (real, currently 2 real prospects) is still present, verify the CEO's reasoning is capable of proposing both a Sales task (VA call) and, separately, a Marketing or Ops follow-on if the evidence supports one; if the real data genuinely only supports one department's involvement, record that honestly rather than forcing a fabricated second department into the test — the spec requires cross-department coordination *capability*, not a cross-department task on every cycle.

- [ ] **Step 7: Test the conflicting-evidence / risk-surfacing scenario using real, already-observed data**

The real `reset_ceo_priorities` output already includes `kill-switch-off` at `severity:'attention'` (verified live during research for this plan). Confirm this cycle's `summary.risks` or `summary.priorities` includes this real flag, unaltered — the CEO must surface it, not silently resolve or omit it.

- [ ] **Step 8: Test the integration-degraded scenario**

Stop the Command Centre service only (leave Gateway/Office/Viewer up): `powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Navka\Documents\reset-office-ops\reset-office-ctl.ps1" -Action Stop` then manually restart only Gateway/Office/Viewer, OR more simply, kill just the Command Centre node process by PID (`Get-NetTCPConnection -LocalPort 5183 | Select OwningProcess` then `Stop-Process`). Run `node ceo/cycle.mjs --reassess` again. Expected: gateway reports degraded/blocked for D1-backed views (per gateway.mjs's existing 3-state health model), and the CEO cycle's signals show the affected views as real degraded/blocked values, not fabricated fresh ones — confirm by inspecting the `views` object logged, and confirm the CEO's output does not claim fresher data than it has. Then restart Command Centre via `reset-office-ctl.ps1 -Action Start` to restore the 4-service baseline before continuing.

- [ ] **Step 9: Test recovery — kill mid-cycle, confirm clean restart**

Start a cycle (`node ceo/cycle.mjs --reassess &` backgrounded or via a short timeout), kill the node process mid-run (before it completes), then run it again. Expected: the lock file's stale PID (now dead) is correctly detected as not-alive (per `acquireCycleLock`'s `isPidAlive` check) and the new run acquires the lock and proceeds normally — no permanent deadlock from a killed process leaving a stale lock.

- [ ] **Step 10: Restart the whole stack and confirm persistence**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Navka\Documents\reset-office-ops\reset-office-ctl.ps1" -Action Restart`
Then: `curl http://localhost:4520/api/ceo` (through the viewer, confirming the earlier port-migration work from this session still functions) — expect `available:true` with the same `lastCycleSummary` from before the restart (state survives the restart because it is a plain file, not in-memory).

- [ ] **Step 11: Confirm zero regressions in existing baselines**

Run: `cd agents-office && npm run check` — expect 66/66 (or however many Tasks 6+8 brought the total to), all passing.
Run: `powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Navka\Documents\reset-office-ops\reset-office-ctl.ps1" -Action Status` — expect all 4 core services still healthy, confirming the CEO's addition did not destabilise the existing autostart system.

- [ ] **Step 12: Record the evidence**

Save the key command outputs from Steps 2-11 (paths + a short excerpt, not a secret-bearing dump) for direct citation in Task 12's status-doc update. Do not proceed to Task 12 with any scenario left unverified or any claim not backed by an actual command's real output captured in this step.

---

## Task 11: Regression sweep

**Files:** none modified; verification only.

- [ ] **Step 1: Full Agents Office check**

Run: `cd agents-office && npm run check`
Expected: same or higher pass count than Task 10 Step 11 found, zero failures.

- [ ] **Step 2: Full reset-office-ops manual cycle**

Run in sequence: `reset-office-ctl.ps1 -Action Stop`, `-Action Start`, `-Action Status`, `-Action Restart`, `-Action Status` (the same sequence already proven earlier in this project's history).
Expected: identical clean behaviour to before this feature existed — no new failure mode introduced by the CEO's scheduled tasks running alongside it.

- [ ] **Step 3: Confirm the CEO's own module tests all still pass together**

Run: `for f in agents-office/ceo/*.test.mjs; do node "$f" || exit 1; done` (or the PowerShell equivalent: `Get-ChildItem agents-office/ceo/*.test.mjs | ForEach-Object { node $_.FullName }`)
Expected: every test file's `ok:` lines print, no thrown errors.

- [ ] **Step 4: Commit** (only if Steps 1-3 required any fix; otherwise nothing to commit)

---

## Task 12: Update the authoritative status doc

**Files:**
- Modify: `agents-office/brain-reset/90-Operations/agents-office-system-status.md`

**Interfaces:** none (documentation only, cites Task 10/11's real evidence).

- [ ] **Step 1: Add a new "RESET AI CEO" section** immediately after the existing "## Architecture" section, covering (each point backed by a specific Task 10 result, not a general claim):
  - What it is / is not (one paragraph, matching `role.md`'s framing from Task 7).
  - Architecture: `agents-office/ceo/{signals,state,delegate,reason,cycle}.mjs`, the one new `GET /api/ceo` route, the new UI panel, the two new Task Scheduler entries — each with its file path.
  - Scheduling: exact trigger times/repetition from Task 9 Step 3's verified output.
  - Model policy: sonnet default, opus on self-flagged escalation — cite the actual `modelUsed` values observed in Task 10's real cycle runs.
  - Autonomy boundaries: quote the Global Constraints list from this plan's header (approve/reject structurally absent, no payment capability anywhere in the stack, all delegation via the existing router/needsOk gate).
  - Known data gap: `readCeoMetrics` exists but is not wired into the live snapshot — named explicitly as unresolved, not silently omitted.
  - Test evidence: the real outcomes from Task 10 Steps 2-11 (idempotency confirmed, no-eligible-work or real delegation observed, dedup confirmed, the real `kill-switch-off` risk surfaced, degraded-integration behaviour confirmed, recovery-after-kill confirmed, restart persistence confirmed).
  - Update the "## Tests" section's Agents Office line to the new, higher pass count from Task 11.
- [ ] **Step 2: Update the doc's date** in the H1 heading to the date this work actually completes.
- [ ] **Step 3: Commit**

```bash
git add agents-office/brain-reset/90-Operations/agents-office-system-status.md
git commit -m "docs: record RESET AI CEO architecture, scheduling, autonomy boundaries and empirical test evidence"
```

---

## Self-Review Notes (completed during authoring, kept for the executor's context)

- **Spec coverage:** daily/periodic autonomous cycle → Tasks 5, 9. Cross-department delegation → Task 5's `delegations[]` loop + Task 3. Approval queue → reuses the existing `needsOk`/`waiting`/approve-reject flow, formatted per Task 7, surfaced per Task 8 — deliberately not a new mechanism. Dynamic model routing with provenance → already exists in `serve.mjs`; Task 4 adds the CEO's *own* sonnet→opus escalation on top, Task 5's summary records both. Duplicate prevention → Task 2's `findOpenInitiative` + Task 3's dedup-before-create. UI without a 36th desk → Task 8, additive to the existing app. Brain learning → Task 5's `writeBrainLessons` + Task 7's `growth-initiatives.md`. No fabricated data → enforced structurally in Task 1 (`null` not a guessed default) and instructed explicitly in Task 4's prompt. Windows autostart integration → Task 9, built on the already-existing, already-tested `reset-office-ops`. Empirical end-to-end + all required scenarios → Task 10. Preserve existing baselines → Tasks 6/8's check.mjs increments and Task 11's full sweep. Status doc update → Task 12. Ruflo → not referenced anywhere in this plan; no dependency introduced, consistent with "do not depend on or reactivate Ruflo."
- **Placeholder scan:** every step above contains real, complete code or an exact command — none deferred to "add appropriate handling."
- **Type/name consistency checked:** `delegate()`'s parameter names match what `cycle.mjs` calls it with; `runCeoReasoning`/`reasonWithEscalation`'s return shapes match what `cycle.mjs` destructures (`first`, `second`, `final`); `gatherSignals()`'s returned shape matches what `buildCeoPrompt` and `cycle.mjs`'s `reconcileInitiatives` read from it (`signals.views.*`, `signals.office.openTasks`/`recentDone`).
