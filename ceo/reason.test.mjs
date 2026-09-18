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
