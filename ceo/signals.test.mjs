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
    '/prod/search-console/query': { status: 200, body: { data: { startDate: '2026-08-22', endDate: '2026-09-16', dimensions: ['query'], rows: [{ keys: ['commercial cleaning perth'], clicks: 12, impressions: 340, ctr: 0.0353, position: 8.2 }] }, runId: 'r1' } },
    '/api/health': { status: 200, body: { ok: true } },
    '/api/tasks': { status: 200, body: [{ id: 't1', state: 'next', dept: 'sales' }, { id: 't2', state: 'done', dept: 'fin', doneAt: 5 }] },
  });
  const out = await gatherSignals({ fetchImpl });
  assert.equal(out.gateway.reachable, true);
  assert.deepEqual(out.views.ceoPriorities, [{ id: 'x', severity: 'info', headline: 'h', evidence: 'e' }]);
  assert.equal(out.office.reachable, true);
  assert.equal(out.office.openTasks.length, 1);
  assert.equal(out.office.recentDone.length, 1);
  assert.equal(out.views.searchConsole.rows[0].keys[0], 'commercial cleaning perth');
  console.log('ok: gatherSignals reachable case');
}

export async function testGatewayDown() {
  const fetchImpl = async () => { throw new Error('ECONNREFUSED'); };
  const out = await gatherSignals({ fetchImpl });
  assert.equal(out.gateway.reachable, false);
  assert.equal(out.views.ceoPriorities, null);
  assert.equal(out.views.funnel, null);
  assert.equal(out.views.searchConsole, null);
  console.log('ok: gatherSignals gateway-down case reports null, not empty');
}

await testReachable();
await testGatewayDown();
