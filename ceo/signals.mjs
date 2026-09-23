// Read-only signal gathering for the RESET AI CEO cycle. Every field is either a
// real value from the gateway/office, or null — never a guessed/zero default. A
// null view means "no verified source right now," which callers (reason.mjs) must
// surface as a genuine data gap, not silently treat as "nothing is happening."
// funnel/prospects/va-tasks are deliberately absent: they are built entirely from the
// OLD, retired Reset Sales Control board and the Wave1 pilot (see readModel.ts's
// buildFunnel(wave1)), which stopped receiving new prospects days ago. Naming them here
// used to hand the CEO stale sales-pipeline data every single cycle regardless of what any
// prompt guidance said; the guarantee that it can never happen again is that the CEO simply
// never receives these views at all. aiSalesPipeline (fetched below) is the sole current
// source of truth for sales-pipeline priorities and delegations.
const VIEWS = {
  ceoPriorities: 'ceo-priorities', agentRuns: 'agent-runs',
  systemHealth: 'system-health', suppression: 'suppression',
  outbox: 'outbox', calls: 'calls', gmailSignals: 'gmail-signals',
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

export async function gatherSignals({ gatewayBase = 'http://127.0.0.1:4522', officeBase = 'http://127.0.0.1:4520', fetchImpl = fetch } = {}) {
  const generatedAtMs = Date.now();
  const health = await safeJson(fetchImpl, `${gatewayBase}/health`);
  const gateway = { reachable: health.ok, health: health.ok ? health.body : null, reason: health.ok ? null : health.reason };

  const views = {};
  for (const [key, viewName] of Object.entries(VIEWS)) {
    const r = await safeJson(fetchImpl, `${gatewayBase}/view/${viewName}`);
    views[key] = r.ok ? (r.body?.data ?? null) : null;
  }
  // Search Console is a real, isolated Google OAuth grant on the Worker itself (see
  // src/google-search-console-session.ts), reached through the gateway's /prod proxy
  // (same mechanism as gmail/calendar) rather than the CommandCentreSnapshot view-cache
  // the rest of VIEWS above uses -- there is genuinely no such snapshot for it yet.
  const searchConsole = await safeJson(fetchImpl, `${gatewayBase}/prod/search-console/query`);
  views.searchConsole = searchConsole.ok ? (searchConsole.body?.data ?? null) : null;
  // Business Profile: same reasoning as Search Console above -- a real, isolated Google
  // OAuth grant (see src/google-business-profile-session.ts) reached through the
  // gateway's /prod proxy, no CommandCentreSnapshot view-cache exists for it yet.
  const businessProfile = await safeJson(fetchImpl, `${gatewayBase}/prod/business-profile/metrics`);
  views.businessProfile = businessProfile.ok ? (businessProfile.body?.data ?? null) : null;
  // The real, current Reset AI Sales Pipeline board (5031414133) -- the sole authoritative
  // source for today's actual sales pipeline. Real gap found live 21 September 2026: the
  // CEO had no live view of this board at all and kept generating priorities from
  // `funnel`/`prospects`/`vaTasks` above, which are built entirely from the OLD, retired
  // Reset Sales Control board and Wave1 pilot (see readModel.ts's buildFunnel(wave1) --
  // it never receives any AI Sales Pipeline data). That produced repeated, days-stale
  // "action-needed" priorities about prospects (e.g. the old phone-first queue) that this
  // desk has no way to act on and that were no longer the real focus. Same /prod proxy
  // mechanism as search-console/business-profile above; see reason.mjs for how this view
  // is used and how the old views are now explicitly marked historical-only.
  const aiSalesPipeline = await safeJson(fetchImpl, `${gatewayBase}/prod/monday/ai-sales-pipeline`);
  views.aiSalesPipeline = aiSalesPipeline.ok ? (aiSalesPipeline.body?.data ?? null) : null;

  const officeHealth = await safeJson(fetchImpl, `${officeBase}/api/health`);
  const officeTasks = await safeJson(fetchImpl, `${officeBase}/api/tasks`);
  const allTasks = officeTasks.ok && Array.isArray(officeTasks.body) ? officeTasks.body : [];
  const office = {
    reachable: officeHealth.ok,
    health: officeHealth.ok ? officeHealth.body : null,
    openTasks: allTasks.filter(t => ['next', 'doing', 'waiting', 'scheduled'].includes(t.state)),
    recentDone: allTasks.filter(t => t.state === 'done' && t.error !== true).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).slice(0, 50),
    // Office retains failed tasks as state='done' with error=true. They are not outcomes
    // to celebrate or reconcile away; they are a distinct, current recovery queue.
    failedTasks: allTasks.filter(t => t.error === true).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).slice(0, 50),
  };

  return { generatedAtMs, gateway, views, office };
}
