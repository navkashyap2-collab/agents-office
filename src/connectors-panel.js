// RESET INTEGRATION: connector health panel — real per-job/verification status from the
// Worker's own integration_control table (see src/bridge-read-api.ts's curated
// 'system/connectors' route), so "is X actually working" is answered by opening this
// panel instead of a manual database query. Same honesty contract as reset-status.js and
// ceo-panel.js: a fetch failure keeps the last real values but flips state to 'stale'
// with the original timestamp; it never invents a status.
export const CONNECTORS = { state: 'loading', list: [], fetchedAtMs: null, reason: '' };

let lastGoodList = null;
let lastGoodAt = null;

export async function refreshConnectors() {
  try {
    const r = await fetch('/api/connectors', { cache: 'no-store' });
    if (!r.ok) throw new Error('http-' + r.status);
    const data = await r.json();
    if (!data.available) throw new Error(data.reason || 'connectors-unavailable');
    lastGoodList = data.connectors; lastGoodAt = data.fetchedAtMs;
    Object.assign(CONNECTORS, { state: 'ok', list: data.connectors, fetchedAtMs: data.fetchedAtMs, reason: '' });
  } catch (e) {
    const reason = String((e && e.message) || e);
    if (lastGoodList) Object.assign(CONNECTORS, { state: 'stale', list: lastGoodList, fetchedAtMs: lastGoodAt, reason });
    else Object.assign(CONNECTORS, { state: 'unavailable', list: [], fetchedAtMs: null, reason });
  }
  return CONNECTORS;
}

// Friendly labels only -- the transport stays dumb (raw name/status/timestamp); this is
// purely presentation, never a source of truth the backend needs to agree with.
const LABELS = {
  monday_verify_job: 'Monday.com CRM',
  google_verify_job: 'Gmail / Calendar',
  email_send_verify_job: 'Gmail Send',
  google_search_console_verify_job: 'Search Console',
  google_business_profile_verify_job: 'Business Profile',
  gmail_signals_job: 'Gmail Signal Inbox',
  va_secondary_queue_job: 'VA Queue (reactivation/calls)',
  ai_sales_pipeline_promotion_job: 'AI Pipeline Promotion',
  ai_sales_pipeline_outcome_job: 'AI Pipeline Outcomes',
  email_outbound_kill_switch: 'Email Outbound Kill Switch',
};
// Status categories, not per-job "is this stuck" heuristics (those already live in each
// job's own recovery grace period on the Worker) -- this panel reports what the state
// machine says right now, honestly, not a guess about whether it's taking too long.
// Real job vocabularies vary beyond a plain complete/running/pending/failed set (e.g.
// gmail_signals_job's two-mode 'complete-poll'/'pending-baseline'/'running-poll'), so this
// matches by prefix/suffix rather than an exact-value dictionary that would silently
// mis-categorise a real, healthy state as "needs attention".
function categorize(status) {
  if (status === 'failed') return 'bad';
  if (status === 'needs-review' || status.endsWith('-required')) return 'attn';
  if (status.startsWith('complete') || status.startsWith('running') || status === 'off') return 'ok';
  return 'wait'; // pending* and anything genuinely unrecognised: waiting, not broken
}

// The kill switch's 'off'/'on' values mean the opposite of what they sound like ('off' =
// sends ALLOWED) -- this caused real confusion earlier (see feedback history), so its
// status text is always spelled out plainly here rather than left as a bare word.
function statusText(name, status) {
  if (name === 'email_outbound_kill_switch') return status === 'off' ? 'off (sends allowed)' : 'on (sends blocked)';
  return status;
}

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function relTime(ms) {
  if (!ms) return 'never';
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function connectorsPanelHtml() {
  if (CONNECTORS.state === 'loading') return `<div class="ceo-empty">Loading…</div>`;
  if (CONNECTORS.state === 'unavailable') return `<div class="ceo-empty">Connector status unavailable — ${esc(CONNECTORS.reason)}</div>`;
  const staleNote = CONNECTORS.state === 'stale' ? `<div class="ceo-stale">Showing the last real check (${esc(new Date(CONNECTORS.fetchedAtMs).toLocaleString())}) — ${esc(CONNECTORS.reason)}</div>` : '';
  const rows = CONNECTORS.list.map(c => {
    const label = LABELS[c.name] || c.name;
    const cat = categorize(c.status);
    return `<li class="conn-row"><span class="conn-dot conn-${cat}"></span><span class="conn-label">${esc(label)}</span><span class="conn-status">${esc(statusText(c.name, c.status))}</span><span class="conn-age">${esc(relTime(c.updatedAtMs))}</span></li>`;
  }).join('') || '<li>No connector data yet.</li>';
  return `${staleNote}<h3>Connector health</h3><ul>${rows}</ul>`;
}

// Panel open/close — same lazily-created-div + dim-overlay pattern as ceo-panel.js.
let panelEl = null, dimEl = null, open = false;

function ensurePanel() {
  if (panelEl) return;
  panelEl = document.createElement('div'); panelEl.id = 'connectorsPanel'; panelEl.className = 'ceo-panel left';
  dimEl = document.createElement('div'); dimEl.id = 'connectorsPanelDim';
  dimEl.addEventListener('click', closeConnectorsPanel);
  document.body.appendChild(dimEl); document.body.appendChild(panelEl);
}

function render() { if (panelEl) panelEl.innerHTML = connectorsPanelHtml(); }

export function isConnectorsPanelOpen() { return open; }

export function openConnectorsPanel() {
  ensurePanel(); open = true;
  render();
  requestAnimationFrame(() => requestAnimationFrame(() => { if (!open) return; panelEl.classList.add('on'); dimEl.classList.add('on'); }));
}
export function closeConnectorsPanel() {
  if (!open) return;
  open = false; panelEl.classList.remove('on'); dimEl.classList.remove('on');
}
export function toggleConnectorsPanel() { open ? closeConnectorsPanel() : openConnectorsPanel(); }

if (typeof location !== 'undefined' && location.protocol.startsWith('http')) {
  refreshConnectors();
  // Same visibility-gating as reset-status.js / ceo-panel.js (real profiling finding, 20
  // September 2026) -- skip the fetch while backgrounded, catch up immediately on return.
  setInterval(async () => { if (document.hidden) return; await refreshConnectors(); if (open) render(); }, 30000);
  document.addEventListener('visibilitychange', async () => { if (!document.hidden) { await refreshConnectors(); if (open) render(); } });
}
