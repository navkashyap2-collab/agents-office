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

// Priorities/risks headlines and evidence are LLM-authored text that may echo real
// external content (a prospect name, an email subject) the CEO's signals pulled in —
// never trusted as markup. Escaped before going into innerHTML, same as main.js's esc().
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

/** Plain-text/HTML summary for the panel — every field guards for a still-loading/unavailable CEO. */
export function ceoPanelHtml() {
  if (CEO.state === 'loading') return `<div class="ceo-empty">Loading…</div>`;
  // Not just CEO.state === 'unavailable': the very first render can land between the module's
  // initial CEO.data = null and refreshCeo()'s first resolution finishing — guard on the data
  // itself, not only the label, or opening the panel that early throws and never shows anything.
  if (CEO.state === 'unavailable' || !CEO.data) return `<div class="ceo-empty">No CEO cycle has run yet.</div>`;
  const s = CEO.data.lastCycleSummary;
  if (!s) return `<div class="ceo-empty">CEO is running its first cycle.</div>`;
  const staleNote = CEO.state === 'stale' ? `<div class="ceo-stale">Showing the last real briefing (${esc(new Date(CEO.fetchedAtMs).toLocaleString())}) — ${esc(CEO.reason)}</div>` : '';
  const priorities = (s.priorities || []).map(p => `<li class="ceo-pri ceo-${esc(p.severity)}">${esc(p.headline)} — <span class="ceo-evidence">${esc(p.evidence)}</span></li>`).join('') || '<li>No priorities flagged this cycle.</li>';
  const delegated = (s.delegationsCreated || []).map(d => `<li>${esc(d.dept)}: task ${esc(d.taskId)}</li>`).join('') || '<li>Nothing delegated this cycle.</li>';
  const risks = (s.risks || []).map(r => `<li>${esc(r.headline)} — <span class="ceo-evidence">${esc(r.evidence)}</span></li>`).join('') || '<li>No risks flagged.</li>';
  return `${staleNote}<h3>Priorities</h3><ul>${priorities}</ul><h3>Delegated this cycle</h3><ul>${delegated}</ul><h3>Risks / blockers</h3><ul>${risks}</ul>` +
    `<div class="ceo-meta">Cycle ${esc(s.mode)} · ${esc(new Date(s.atMs).toLocaleString())} · model ${esc(s.modelUsed.first)}${s.modelUsed.second ? ' → escalated to ' + esc(s.modelUsed.second) : ''}${s.noEligibleWork ? ' · no eligible work found' : ''}</div>`;
}

// Panel open/close — same lazily-created-div + dim-overlay pattern as tasks.js's
// company board (#board/#boardDim, toggled via a bare 'on' class), since #board is
// never declared in shell.html either; this file owns its own DOM rather than
// requiring main.js to know its markup.
let panelEl = null, dimEl = null, open = false, lastViewedAtMs = 0;

function ensurePanel() {
  if (panelEl) return;
  panelEl = document.createElement('div'); panelEl.id = 'ceoPanel'; panelEl.className = 'ceo-panel right';
  dimEl = document.createElement('div'); dimEl.id = 'ceoPanelDim';
  dimEl.addEventListener('click', closeCeoPanel);
  document.body.appendChild(dimEl); document.body.appendChild(panelEl);
}

function render() { if (panelEl) panelEl.innerHTML = ceoPanelHtml(); }

export function isCeoPanelOpen() { return open; }

export function openCeoPanel() {
  ensurePanel(); open = true; lastViewedAtMs = Date.now();
  render();
  requestAnimationFrame(() => requestAnimationFrame(() => { if (!open) return; panelEl.classList.add('on'); dimEl.classList.add('on'); }));
}
export function closeCeoPanel() {
  if (!open) return;
  open = false; panelEl.classList.remove('on'); dimEl.classList.remove('on');
}
export function toggleCeoPanel() { open ? closeCeoPanel() : openCeoPanel(); }

/** True when a briefing newer than the panel's last open exists — drives the top-bar dot. */
export function hasUnreadCeoBriefing() {
  const s = CEO.data && CEO.data.lastCycleSummary;
  return !!(s && (s.priorities.length || s.risks.length) && s.atMs > lastViewedAtMs);
}

if (typeof location !== 'undefined' && location.protocol.startsWith('http')) {
  refreshCeo();
  setInterval(async () => { await refreshCeo(); if (open) render(); }, 30000);
}
