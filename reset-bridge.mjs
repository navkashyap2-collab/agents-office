// RESET INTEGRATION — read-only bridge to Reset Commercial Cleaning's real Command
// Centre API. This file no longer talks to Reset (localhost:5183) directly: it is a
// thin client of reset-mcp-bridge/gateway.mjs, the ONE shared local process every
// desk's MCP bridge also goes through. That means the UI's own top-bar badge and
// every one of the 35 desks now share the exact same cache, single-flight snapshot
// fetch and honest health signal — a concurrency storm from desks running at once
// can no longer make the badge flap independently of what the desks themselves see,
// and vice versa. If the gateway isn't running yet, this file spawns it once.
//
// This module never writes anything back to Reset and never fabricates a value: a
// metric this bridge cannot honestly compute from the real snapshot is simply left
// out of `departments`, and every caller in this codebase (see src/reset-status.js,
// src/main.js) must render a missing metric as '—'/'NO DATA', never a guess.
import { spawn } from 'node:child_process';
import path from 'node:path';

const GATEWAY_PORT = Number(process.env.GATEWAY_PORT || 4522);
const GATEWAY = `http://127.0.0.1:${GATEWAY_PORT}`;
const GATEWAY_SCRIPT = path.join(process.env.RESET_BRIDGE_DIR || 'C:/Users/Navka/Documents/reset-mcp-bridge', 'gateway.mjs');
const FETCH_TIMEOUT_MS = 28000; // headroom over the gateway's own 25s upstream timeout

async function ensureGateway() {
  try {
    const r = await fetch(`${GATEWAY}/health`, { signal: AbortSignal.timeout(2000) });
    if (r.ok || r.status === 502) return;
  } catch { /* not up yet — fall through and start it */ }
  try {
    const child = spawn(process.execPath, [GATEWAY_SCRIPT], { detached: true, stdio: 'ignore', env: process.env });
    child.unref();
  } catch { /* another process may already be starting it */ }
  for (let i = 0; i < 10; i++) {
    await new Promise(res => setTimeout(res, 300));
    try { const r = await fetch(`${GATEWAY}/health`, { signal: AbortSignal.timeout(2000) }); if (r.ok || r.status === 502) return; } catch { /* keep waiting */ }
  }
}

function sum(record) {
  return Object.values(record || {}).reduce((total, n) => total + (Number.isFinite(n) ? n : 0), 0);
}

function runCountFor(agentRuns, agentIds) {
  return (agentRuns || []).filter(r => agentIds.includes(r.agentId)).length;
}

/** Start of the reporting day at Reset's operating location. Snapshot timestamps are UTC
 * milliseconds; using the browser or server's local timezone here would make the daily
 * report roll over at different times on different machines. */
export function perthDayStartMs(nowMs) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Perth', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(nowMs));
  const field = type => parts.find(part => part.type === type)?.value;
  return Date.UTC(Number(field('year')), Number(field('month')) - 1, Number(field('day'))) - (8 * 60 * 60 * 1000);
}

function countSince(rows, field, sinceMs) {
  return (rows || []).filter(row => Number(row?.[field]) >= sinceMs).length;
}

/** Transforms Reset's real CommandCentreSnapshot into exactly the department metrics
 * this office's UI knows how to render — nothing more, nothing invented. */
export function buildResetStatus(snapshot) {
  const gmail = snapshot.gmail || { outbox: [], signalCounts: {} };
  const discovery = snapshot.discovery || { byStatus: {} };
  const vaFloor = snapshot.vaFloor || { recentCalls: [] };
  const agentRuns = snapshot.agentRuns || [];
  const wave1 = snapshot.wave1 || [];
  const funnel = snapshot.funnel || [];

  const gmailSignals = sum(gmail.signalCounts);
  const proposalsMade = runCountFor(agentRuns, ['proposal']);
  const deliveryAgentRuns = runCountFor(agentRuns, ['walkthrough', 'appointment', 'premises', 'tender']);
  const escalated = (funnel.find(f => f.stage === 'Escalated (VA call task)') || {}).count ?? 0;
  const reportingNowMs = Number(snapshot.generatedAtMs) || Date.now();
  const todayStartMs = perthDayStartMs(reportingNowMs);
  const emailsSentToday = countSince(gmail.outbox, 'completedAtMs', todayStartMs);
  const prospectsVettedToday = countSince(discovery.recent, 'vettedAtMs', todayStartMs);
  const qualifiedToday = (discovery.recent || []).filter(row => row?.status === 'qualified' && Number(row.vettedAtMs) >= todayStartMs).length;
  // Dialpad can replay or normalize old records with a fresh timestamp. Count a
  // daily call only once its real outcome has been logged.
  const callOutcomesToday = (vaFloor.recentCalls || []).filter((call) =>
    Number(call?.startedAtMs) >= todayStartMs
    && typeof call?.disposition === 'string'
    && call.disposition.trim().length > 0
  ).length;

  const needsApproval =
    (gmail.outbox || []).filter(r => r.state === 'needs_review' || r.state === 'held').length +
    wave1.filter(p => p.channel === 'phone').length;

  return {
    available: true,
    fetchedAtMs: snapshot.generatedAtMs,
    departments: {
      // These are deliberately daily measures. Lifetime totals hid whether the team had
      // actually achieved anything since the previous director briefing.
      emails: { EMAILS_SENT_TODAY: emailsSentToday, GMAIL_SIGNALS: gmailSignals },
      sales: { CANDIDATES_VETTED_TODAY: prospectsVettedToday, QUALIFIED_TODAY: qualifiedToday },
      marketing: {}, // no authoritative marketing data exists in Reset today
      ops: { PROPOSALS_MADE: proposalsMade, CALL_OUTCOMES_TODAY: callOutcomesToday },
      fin: {}, // revenue_events is not applied to production D1 — genuinely no data, not a gap to paper over
      delivery: { AGENT_RUNS: deliveryAgentRuns, ESCALATED: escalated },
    },
    meta: {
      killSwitchState: snapshot.killSwitch ? snapshot.killSwitch.state : 'UNKNOWN',
      needsApproval,
      agentRunsTotal: agentRuns.length,
      reportingDayStartMs: todayStartMs,
    },
  };
}

/** Search Console (real, isolated Google OAuth grant on the Worker — see
 * src/google-search-console-session.ts) is the first authoritative marketing data source
 * Reset has; a fetch failure here must never take down the rest of the snapshot, and an
 * unconfigured grant (503) is reported honestly as no data, never zero. */
async function fetchSearchConsoleMarketing() {
  try {
    const res = await fetch(`${GATEWAY}/prod/search-console/query`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body || !body.data) return {};
    const rows = Array.isArray(body.data.rows) ? body.data.rows : [];
    const totals = rows.reduce((acc, r) => ({ clicks: acc.clicks + (r.clicks || 0), impressions: acc.impressions + (r.impressions || 0) }), { clicks: 0, impressions: 0 });
    return { SEARCH_CONSOLE_CLICKS: totals.clicks, SEARCH_CONSOLE_IMPRESSIONS: totals.impressions, SEARCH_CONSOLE_TOP_QUERIES: rows.length };
  } catch {
    return {};
  }
}

/** Business Profile (real, isolated Google OAuth grant on the Worker — see
 * src/google-business-profile-session.ts) is the second authoritative marketing data
 * source; same honesty rule as Search Console above — a fetch failure or unconfigured
 * grant (503) never takes down the rest of the snapshot and is never reported as zero. */
async function fetchBusinessProfileMarketing() {
  try {
    const res = await fetch(`${GATEWAY}/prod/business-profile/metrics`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body || !body.data) return {};
    const series = Array.isArray(body.data.series) ? body.data.series : [];
    const totalFor = metric => series.find(s => s.metric === metric)?.points.reduce((sum, p) => sum + (p.value || 0), 0) ?? 0;
    const views = ['BUSINESS_IMPRESSIONS_DESKTOP_MAPS', 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH', 'BUSINESS_IMPRESSIONS_MOBILE_MAPS', 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH'].reduce((sum, m) => sum + totalFor(m), 0);
    return { GBP_VIEWS: views, GBP_CALL_CLICKS: totalFor('CALL_CLICKS'), GBP_WEBSITE_CLICKS: totalFor('WEBSITE_CLICKS') };
  } catch {
    return {};
  }
}

export async function fetchResetStatus() {
  await ensureGateway();
  try {
    const res = await fetch(`${GATEWAY}/snapshot`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error((body && body.reason) || `gateway-http-${res.status}`);
    const status = buildResetStatus(body.data);
    // Real regression found 20 September 2026 via direct profiling: these were two
    // sequential awaits, each a real network round trip through the gateway to the live
    // Worker (including a fresh OAuth token refresh on the Worker side), roughly doubling
    // this endpoint's latency for no reason -- neither depends on the other's result.
    const [searchConsole, businessProfile] = await Promise.all([fetchSearchConsoleMarketing(), fetchBusinessProfileMarketing()]);
    status.departments.marketing = { ...status.departments.marketing, ...searchConsole, ...businessProfile };
    return status;
  } catch (e) {
    // Never fabricate a fallback — report exactly why real data isn't available right now.
    return { available: false, reason: (e && e.message) || String(e) };
  }
}

/** Real per-connector job/verification status, straight from the Worker's own
 * integration_control table (see src/bridge-read-api.ts's curated 'system/connectors'
 * route) -- for the Command Centre's connector health panel. Same honesty contract as
 * fetchResetStatus(): unavailable is reported honestly, never a fabricated fallback. */
export async function fetchConnectors() {
  await ensureGateway();
  try {
    const res = await fetch(`${GATEWAY}/prod/system/connectors`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body || !body.data) throw new Error((body && body.reason) || `gateway-http-${res.status}`);
    return { available: true, connectors: body.data.connectors || [], fetchedAtMs: Date.now() };
  } catch (e) {
    return { available: false, connectors: [], reason: (e && e.message) || String(e) };
  }
}

/** The gateway's own health verdict (ok/degraded/blocked), for a richer status badge
 * than the plain available/unavailable boolean buildResetStatus() reduces to. */
export async function fetchGatewayHealth() {
  await ensureGateway();
  try {
    const res = await fetch(`${GATEWAY}/health`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    return await res.json();
  } catch (e) {
    return { status: 'blocked', reason: (e && e.message) || String(e) };
  }
}
