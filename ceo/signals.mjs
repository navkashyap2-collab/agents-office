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
