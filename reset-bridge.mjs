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

/** Transforms Reset's real CommandCentreSnapshot into exactly the department metrics
 * this office's UI knows how to render — nothing more, nothing invented. */
export function buildResetStatus(snapshot) {
  const gmail = snapshot.gmail || { outbox: [], signalCounts: {} };
  const discovery = snapshot.discovery || { byStatus: {} };
  const vaFloor = snapshot.vaFloor || { recentCalls: [] };
  const agentRuns = snapshot.agentRuns || [];
  const wave1 = snapshot.wave1 || [];
  const funnel = snapshot.funnel || [];

  const emailsSent = (gmail.outbox || []).filter(r => r.completedAtMs != null).length;
  const gmailSignals = sum(gmail.signalCounts);
  const candidatesVetted = sum(discovery.byStatus);
  const qualified = (discovery.byStatus || {}).qualified || 0;
  const recentCalls = (vaFloor.recentCalls || []).length;
  const proposalsMade = runCountFor(agentRuns, ['proposal']);
  const deliveryAgentRuns = runCountFor(agentRuns, ['walkthrough', 'appointment', 'premises', 'tender']);
  const escalated = (funnel.find(f => f.stage === 'Escalated (VA call task)') || {}).count ?? 0;

  const needsApproval =
    (gmail.outbox || []).filter(r => r.state === 'needs_review' || r.state === 'held').length +
    wave1.filter(p => p.channel === 'phone').length;

  return {
    available: true,
    fetchedAtMs: snapshot.generatedAtMs,
    departments: {
      emails: { EMAILS_SENT: emailsSent, GMAIL_SIGNALS: gmailSignals },
      sales: { CANDIDATES_VETTED: candidatesVetted, QUALIFIED: qualified },
      marketing: {}, // no authoritative marketing data exists in Reset today
      ops: { PROPOSALS_MADE: proposalsMade, RECENT_CALLS: recentCalls },
      fin: {}, // revenue_events is not applied to production D1 — genuinely no data, not a gap to paper over
      delivery: { AGENT_RUNS: deliveryAgentRuns, ESCALATED: escalated },
    },
    meta: {
      killSwitchState: snapshot.killSwitch ? snapshot.killSwitch.state : 'UNKNOWN',
      needsApproval,
      agentRunsTotal: agentRuns.length,
    },
  };
}

export async function fetchResetStatus() {
  await ensureGateway();
  try {
    const res = await fetch(`${GATEWAY}/snapshot`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error((body && body.reason) || `gateway-http-${res.status}`);
    return buildResetStatus(body.data);
  } catch (e) {
    // Never fabricate a fallback — report exactly why real data isn't available right now.
    return { available: false, reason: (e && e.message) || String(e) };
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
