// RESET INTEGRATION — real Reset Commercial Cleaning operational data, fetched from
// this office's own server (GET /api/reset-status, which itself proxies Reset Command
// Centre's existing read-only /api/snapshot — see serve.mjs's fetchResetStatus()).
//
// Never fabricated: a metric this bridge cannot honestly answer reads as undefined
// here and callers must render '—' or 'NO DATA', never guess. On a fetch failure the
// last real values are kept but the state flips to 'stale' with the original fetch
// timestamp preserved — callers should show staleness, never silently pretend the
// last-known numbers are current.
export const RESET = { state: 'loading', departments: {}, fetchedAtMs: null, meta: null, reason: '' };

let lastGoodDepartments = null;
let lastGoodAt = null;
let lastGoodMeta = null;

export async function refreshReset() {
  try {
    const r = await fetch('/api/reset-status', { cache: 'no-store' });
    if (!r.ok) throw new Error('http-' + r.status);
    const data = await r.json();
    if (!data.available) throw new Error(data.reason || 'reset-unavailable');
    lastGoodDepartments = data.departments;
    lastGoodAt = data.fetchedAtMs;
    lastGoodMeta = data.meta;
    Object.assign(RESET, { state: 'ok', departments: data.departments, fetchedAtMs: data.fetchedAtMs, meta: data.meta, reason: '' });
  } catch (e) {
    const reason = String((e && e.message) || e);
    if (lastGoodDepartments) Object.assign(RESET, { state: 'stale', departments: lastGoodDepartments, fetchedAtMs: lastGoodAt, meta: lastGoodMeta, reason });
    else Object.assign(RESET, { state: 'unavailable', departments: {}, fetchedAtMs: null, meta: null, reason });
  }
  return RESET;
}

/** A single department metric, or '—' if Reset has no honest value for it. */
export function metric(dept, key) {
  const d = RESET.departments && RESET.departments[dept];
  const v = d && d[key];
  return (v === undefined || v === null) ? '—' : v;
}

// Only ever fetch when actually served (mirrors tasks.js connect()'s own protocol check) —
// opened as a raw file (the standalone demo), there is no server to ask and no CORS-safe
// same-origin endpoint to hit.
if (typeof location !== 'undefined' && location.protocol.startsWith('http')) {
  refreshReset();
  // D1 row-read optimisation (2026-09-18): matches the gateway's own snapshot cache window
  // (reset-mcp-bridge/gateway.mjs's CACHE_MS) — polling faster than the cache refreshes buys
  // no extra freshness, only extra real upstream fetches once every open browser tab's poll
  // outlives the cache.
  // Real profiling finding (20 Sep 2026): skip the fetch while backgrounded (an always-open
  // ops dashboard sits hidden most of the day), and catch up immediately on return.
  setInterval(() => { if (!document.hidden) refreshReset(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshReset(); });
}
