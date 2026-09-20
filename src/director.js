// Director Overview — V3.8, a PREVIEW executive dashboard alongside the 3D office.
// Same honesty contract as ceo-panel.js/reset-status.js: real data or an honest empty
// state, never an invented number. It reads the office's own already-live CEO/RESET
// singletons (both keep polling regardless of which view is on screen) and does its own
// light, independent GET polling of /api/tasks, /api/mcp, /api/usage — only while this
// view is actually visible, so it adds no load and no risk when parked on the office.
// It never calls a write endpoint itself (no approve/reject here): "Director Approvals"
// links back into the office's own, already-tested approval flow instead. Fully additive
// — its own dv- prefixed classes and #directorView root, so the office's own selectors
// never match anything this file renders, and switching views cannot affect it.
import { DEPTS, DEPT_KEYS, AGENTS } from './data.js';
import { CEO } from './ceo-panel.js';
import { RESET, metric } from './reset-status.js';
import { profileRows } from './profile.js';

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
// For values placed inside an HTML attribute or used as a CSS class suffix (not a text
// node) — esc() alone doesn't cover quotes, so restrict to a safe charset instead.
function safeKey(s) { return String(s || '').replace(/[^a-z0-9_-]/gi, ''); }

// Same field mapping the office's own department badges use (main.js's BB_ROWS) — kept
// in sync deliberately: both read the same RESET.departments singleton, so the two views
// can never disagree. Marketing/finance show 'NO DATA' because Reset genuinely has no
// authoritative source for them today (see reset-bridge.mjs's buildResetStatus).
const BB_ROWS = profileRows() || {
  emails: [['EMAILS SENT', () => metric('emails', 'EMAILS_SENT')], ['GMAIL SIGNALS', () => metric('emails', 'GMAIL_SIGNALS')]],
  delivery: [['AGENT RUNS', () => metric('delivery', 'AGENT_RUNS')], ['ESCALATED', () => metric('delivery', 'ESCALATED')]],
  sales: [['CANDIDATES VETTED', () => metric('sales', 'CANDIDATES_VETTED')], ['QUALIFIED', () => metric('sales', 'QUALIFIED')]],
  marketing: [['NEW INSIGHTS', () => '—'], ['MARKETING DATA', () => 'NO DATA']],
  ops: [['PROPOSALS MADE', () => metric('ops', 'PROPOSALS_MADE')], ['RECENT CALLS', () => metric('ops', 'RECENT_CALLS')]],
  fin: [['INVOICES ISSUED', () => '—'], ['REVENUE', () => 'NO DATA']],
};

const STATE_LABEL = { next: 'Backlog', doing: 'In progress', waiting: 'Waiting on approval', done: 'Done', sched: 'Scheduled', scheduled: 'Scheduled' };
function span(ms) { // "4 min" · "1 h 12 m" — same shape as tasks.js's own formatter
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} m` : `${h} h`;
}
const agentOf = id => AGENTS.find(a => a.id === id);
const isToday = ms => { if (!ms) return false; const d = new Date(ms), n = new Date(); return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate(); };

async function fetchJSON(url) {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

let taskList = [];   // last-known /api/tasks — [] (not fabricated rows) until the first real fetch lands
let mcpInfo = null;  // last-known /api/mcp
let usageInfo = null; // last-known /api/usage
let havePolled = false;
let pollTimer = null;

async function pollOnce() {
  const [t, m, u] = await Promise.all([fetchJSON('/api/tasks'), fetchJSON('/api/mcp'), fetchJSON('/api/usage')]);
  if (Array.isArray(t)) taskList = t;
  if (m) mcpInfo = m;
  if (u) usageInfo = u;
  havePolled = true;
  render();
}
function startPolling() {
  if (pollTimer) return;
  pollOnce();
  pollTimer = setInterval(pollOnce, 15000);
}
function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

/* ---------- section renderers — each guards its own missing/loading data ---------- */

function renderCeo() {
  const el = document.querySelector('#dvCeo .dv-body');
  if (!el) return;
  if (CEO.state === 'loading') { el.innerHTML = '<div class="dv-empty">Loading…</div>'; return; }
  if (CEO.state === 'unavailable' || !CEO.data) { el.innerHTML = `<div class="dv-empty">No CEO cycle has run yet.${CEO.reason ? ' (' + esc(CEO.reason) + ')' : ''}</div>`; return; }
  const s = CEO.data.lastCycleSummary;
  if (!s) { el.innerHTML = '<div class="dv-empty">CEO is running its first cycle.</div>'; return; }
  const stale = CEO.state === 'stale' ? `<div class="dv-empty" style="color:#B4830B">Showing the last real briefing (${esc(new Date(CEO.fetchedAtMs).toLocaleString())}) — ${esc(CEO.reason)}</div>` : '';
  const pri = (s.priorities || []).map(p => `<li class="dv-li dv-sev-${safeKey(p.severity)}">${esc(p.headline)}<div class="dv-ev">${esc(p.evidence)}</div></li>`).join('');
  const risks = (s.risks || []).map(r => `<li class="dv-li">${esc(r.headline)}<div class="dv-ev">${esc(r.evidence)}</div></li>`).join('');
  el.innerHTML = stale +
    (pri ? `<ul style="list-style:none;padding:0;margin:0">${pri}</ul>` : '<div class="dv-empty">No priorities flagged this cycle.</div>') +
    (risks ? `<div class="dv-sub" style="margin:12px 0 4px">RISKS / BLOCKERS</div><ul style="list-style:none;padding:0;margin:0">${risks}</ul>` : '') +
    `<div class="dv-sub" style="margin-top:12px">Cycle ${esc(s.mode)} · ${esc(new Date(s.atMs).toLocaleString())}${s.noEligibleWork ? ' · no eligible work found' : ''}</div>`;
}

function healthDot(state) { return state === 'ok' ? 'dv-dot-ok' : state === 'stale' ? 'dv-dot-stale' : state === 'loading' ? 'dv-dot-mid' : 'dv-dot-bad'; }
function healthLabel(state) { return { ok: 'CONNECTED', stale: 'DEGRADED', unavailable: 'BLOCKED', loading: 'CONNECTING' }[state] || 'BLOCKED'; }

function renderHealth() {
  const el = document.querySelector('#dvHealth .dv-body');
  if (!el) return;
  const rows = [
    ['Reset Command Centre', RESET.state],
    ['RESET AI CEO', CEO.state],
  ];
  let html = rows.map(([label, state]) => `<div class="dv-health-row"><span><span class="dot ${healthDot(state)}"></span>${esc(label)}</span><span>${healthLabel(state)}</span></div>`).join('');
  if (RESET.meta && RESET.meta.killSwitchState) {
    html += `<div class="dv-health-row"><span><span class="dot ${RESET.meta.killSwitchState === 'ON' || RESET.meta.killSwitchState === 'ENGAGED' ? 'dv-dot-bad' : 'dv-dot-ok'}"></span>Outbound kill switch</span><span>${esc(RESET.meta.killSwitchState)}</span></div>`;
  }
  if (mcpInfo && Array.isArray(mcpInfo.servers)) {
    const total = mcpInfo.servers.length, on = mcpInfo.servers.filter(s => s.status === 'connected').length;
    html += `<div class="dv-health-row"><span><span class="dot ${on === total && total ? 'dv-dot-ok' : on ? 'dv-dot-stale' : 'dv-dot-bad'}"></span>MCP connectors</span><span>${on} / ${total} connected</span></div>`;
  } else if (havePolled) {
    html += `<div class="dv-health-row"><span><span class="dot dv-dot-mid"></span>MCP connectors</span><span>—</span></div>`;
  }
  if (usageInfo && (usageInfo.session || usageInfo.week)) {
    const bar = (lab, x) => !x ? '' : `<div style="margin-top:8px"><div class="dv-health-row" style="padding:0 0 2px"><span>${lab}</span><span>${x.percent >= 100 ? 'LIMIT' : x.percent + '%'}</span></div><div class="dv-bar"><i style="width:${Math.min(100, x.percent)}%"></i></div></div>`;
    html += bar('Session usage', usageInfo.session) + bar('Week usage', usageInfo.week);
  }
  el.innerHTML = html || '<div class="dv-empty">Loading…</div>';
}

function renderProgress() {
  const el = document.querySelector('#dvProgress .dv-body');
  if (!el) return;
  if (!havePolled) { el.innerHTML = '<div class="dv-empty">Loading…</div>'; return; }
  const addedToday = taskList.filter(t => isToday(t.addedAt)).length;
  const doneToday = taskList.filter(t => t.state === 'done' && isToday(t.doneAt)).length;
  const inProgress = taskList.filter(t => t.state === 'doing').length;
  const pct = addedToday ? Math.round((doneToday / addedToday) * 100) : (doneToday ? 100 : 0);
  el.innerHTML = `
    <div class="dv-stat-row">
      <div class="dv-stat"><b>${doneToday}</b><span>DONE TODAY</span></div>
      <div class="dv-stat"><b>${addedToday}</b><span>ADDED TODAY</span></div>
      <div class="dv-stat"><b>${inProgress}</b><span>IN PROGRESS NOW</span></div>
    </div>
    <div class="dv-bar"><i style="width:${pct}%"></i></div>
    <div class="dv-sub" style="margin-top:6px">${addedToday ? pct + '% of today’s added work is done' : (doneToday ? 'Work finished today, none added yet today' : 'No task activity yet today')}</div>`;
}

function renderPipeline() {
  const el = document.querySelector('#dvPipeline .dv-body');
  if (!el) return;
  const vetted = metric('sales', 'CANDIDATES_VETTED'), qualified = metric('sales', 'QUALIFIED');
  const meta = RESET.meta || {};
  el.innerHTML = `
    <div class="dv-stat-row">
      <div class="dv-stat"><b>${esc(String(vetted))}</b><span>CANDIDATES VETTED</span></div>
      <div class="dv-stat"><b>${esc(String(qualified))}</b><span>QUALIFIED</span></div>
    </div>
    <div class="dv-health-row"><span>Agent runs (all depts)</span><span>${meta.agentRunsTotal ?? '—'}</span></div>
    <div class="dv-health-row"><span>Reset items needing review</span><span>${meta.needsApproval ?? '—'}</span></div>
    ${RESET.state !== 'ok' ? `<div class="dv-empty" style="margin-top:8px;color:#B4830B">${RESET.state === 'stale' ? 'Showing last-known figures — Reset is currently unreachable.' : 'Reset pipeline data is unavailable right now.'}</div>` : ''}`;
}

function reviewInOffice(dept) {
  setView('officeV3'); // OFFICE V3 is the only office view now — nothing to remember
  setTimeout(() => { if (window.CC && window.CC.zoomToApproval) window.CC.zoomToApproval(dept); }, 60);
}
function openDeptInOffice(dept) {
  setView('officeV3');
  setTimeout(() => { if (window.CC && window.CC.tasks && window.CC.tasks.openFor) window.CC.tasks.openFor(dept); }, 60);
}

function renderApprovals() {
  const el = document.querySelector('#dvApprovals .dv-body');
  if (!el) return;
  if (!havePolled) { el.innerHTML = '<div class="dv-empty">Loading…</div>'; return; }
  const waiting = taskList.filter(t => t.state === 'waiting').sort((a, b) => (a.waitingAt || 0) - (b.waitingAt || 0));
  if (!waiting.length) { el.innerHTML = '<div class="dv-empty">Nothing waiting on your approval right now.</div>'; return; }
  el.innerHTML = waiting.map(t => {
    const a = agentOf(t.agent);
    const ask = t.ask || t.title || 'Review draft';
    const age = t.waitingAt ? span(Date.now() - t.waitingAt) + ' waiting' : '';
    return `<div class="dv-approval">
      <div><div class="dv-a-txt">${esc(ask)}</div><div class="dv-a-meta">${esc(DEPTS[t.dept] ? DEPTS[t.dept].name : t.dept)} · ${esc(a ? a.name : t.agent)}${age ? ' · ' + esc(age) : ''}</div></div>
      <button class="dv-review-btn" data-dept="${safeKey(t.dept)}">REVIEW →</button>
    </div>`;
  }).join('');
  el.querySelectorAll('.dv-review-btn').forEach(b => b.addEventListener('click', () => reviewInOffice(b.dataset.dept)));
}

function renderTasks() {
  const el = document.querySelector('#dvTasks .dv-body');
  if (!el) return;
  if (!havePolled) { el.innerHTML = '<div class="dv-empty">Loading…</div>'; return; }
  const counts = { scheduled: 0, next: 0, doing: 0, waiting: 0, done: 0 };
  for (const t of taskList) { const k = t.state === 'sched' ? 'scheduled' : t.state; if (counts[k] !== undefined) counts[k]++; }
  const chips = `<div class="dv-chip-row">
    <span class="dv-chip">ALL<b>${taskList.length}</b></span>
    <span class="dv-chip">SCHEDULED<b>${counts.scheduled}</b></span>
    <span class="dv-chip">BACKLOG<b>${counts.next}</b></span>
    <span class="dv-chip">IN PROGRESS<b>${counts.doing}</b></span>
    <span class="dv-chip">WAITING<b>${counts.waiting}</b></span>
    <span class="dv-chip">DONE<b>${counts.done}</b></span>
  </div>`;
  const recent = [...taskList].sort((a, b) => (b.changedAt || b.doneAt || b.addedAt || 0) - (a.changedAt || a.doneAt || a.addedAt || 0)).slice(0, 8);
  const rows = recent.map(t => {
    const a = agentOf(t.agent);
    const when = t.doneAt || t.changedAt || t.addedAt;
    return `<div class="dv-task-row" data-dept="${safeKey(t.dept)}">
      <span>${esc(t.title || '')}</span>
      <span class="dv-t-meta">${esc(DEPTS[t.dept] ? DEPTS[t.dept].short : t.dept)} · ${esc(a ? a.name : t.agent)} · ${esc(STATE_LABEL[t.state] || t.state)}${when ? ' · ' + esc(span(Date.now() - when)) + ' ago' : ''}</span>
    </div>`;
  }).join('') || '<div class="dv-empty">No tasks yet.</div>';
  el.innerHTML = chips + rows;
  el.querySelectorAll('.dv-task-row').forEach(r => r.addEventListener('click', () => openDeptInOffice(r.dataset.dept)));
}

function renderDepts() {
  const el = document.getElementById('dvDepts');
  if (!el) return;
  el.innerHTML = DEPT_KEYS.map(k => {
    const dept = DEPTS[k];
    const agents = AGENTS.filter(a => a.dept === k);
    const lead = agents.find(a => a.lead);
    const specialists = agents.filter(a => !a.lead);
    const rows = BB_ROWS[k] || [];
    const doing = havePolled ? taskList.filter(t => t.dept === k && t.state === 'doing').length : null;
    const waiting = havePolled ? taskList.filter(t => t.dept === k && t.state === 'waiting').length : null;
    return `<div class="dv-dept">
      <div class="dv-dept-h"><span class="dot" style="background:${dept.chip}"></span><b>${esc(dept.name)}</b></div>
      <div class="dv-dept-n">${agents.length}</div><div class="dv-dept-lab">AGENTS</div>
      ${havePolled ? `<div class="dv-dept-live">${doing} in progress · ${waiting} waiting</div>` : ''}
      ${rows.map(([label, get]) => `<div class="dv-m-row"><span class="dv-m-lab">${esc(label)}</span><span>${esc(String(get()))}</span></div>`).join('')}
      <div class="dv-roster">${lead ? `<span class="dv-agent lead">★ ${esc(lead.name)}</span>` : ''}${specialists.map(a => `<span class="dv-agent">${esc(a.name)}</span>`).join('')}</div>
    </div>`;
  }).join('');
}

function render() {
  if (!document.getElementById('directorView')) return;
  const stamp = document.getElementById('dvUpdated');
  if (stamp) stamp.textContent = 'Live · updated ' + new Date().toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  renderCeo(); renderHealth(); renderProgress(); renderPipeline(); renderApprovals(); renderTasks(); renderDepts();
}

/* ---------- view switch — OFFICE V3 / DV, one click, instantly reversible. OFFICE V3 is
   the office's own existing dark theme (src/main.js's setDark, already used for years
   behind the D key / #dark=1) — no second renderer, no second data path. DIRECTOR (DV) is
   the only one that swaps in a different DOM (#directorView), and only via a CSS class
   toggle: the office's own render loop, task engine and polling are never started, stopped
   or reset by any of this, so switching views cannot affect running work. ---------- */
function setView(view) {
  const dir = view === 'director';
  document.body.classList.toggle('dirView', dir);
  if (window.CC && window.CC.setDark) window.CC.setDark(!dir); // DIRECTOR resets to light for a predictable, consistent dashboard; the office is always OFFICE V3 otherwise
  const buttons = { officeV3: document.getElementById('viewOfficeV3'), director: document.getElementById('viewDirector') };
  for (const [k, b] of Object.entries(buttons)) if (b) b.classList.toggle('on', k === view);
  if (dir) { startPolling(); render(); } else stopPolling();
}

function wire() {
  const bv = document.getElementById('viewOfficeV3'), bd = document.getElementById('viewDirector');
  if (!bv || !bd) return; // not on this page (e.g. the hero embed ships without the switch)
  bv.addEventListener('click', () => setView('officeV3'));
  bd.addEventListener('click', () => setView('director'));
  // keep the dashboard's own honesty state fresh even while parked on the office, so it's
  // never stale the moment someone switches to it
  setInterval(() => { if (document.body.classList.contains('dirView')) render(); }, 5000);
}
wire();
