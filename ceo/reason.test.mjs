// agents-office/ceo/reason.test.mjs
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { buildCeoPrompt, parseCeoResponse, runCeoReasoning, reasonWithEscalation } from './reason.mjs';

const baseSignals = { generatedAtMs: 1, gateway: { reachable: true, health: {}, reason: null }, views: { ceoPriorities: [], agentRuns: null, systemHealth: null, suppression: null, outbox: null, calls: null, gmailSignals: null, aiSalesPipeline: null }, office: { reachable: true, health: {}, openTasks: [], recentDone: [], failedTasks: [] } };

export async function testBuildPromptMentionsNoFabrication() {
  const { system, user } = buildCeoPrompt({ signals: baseSignals, ceoState: { cyclesRun: 0 }, openInitiatives: [] });
  assert.match(system, /never invent|never fabricate/i);
  assert.match(user, /ceoPriorities/);
  console.log('ok: buildCeoPrompt includes anti-fabrication instruction and real signals');
}

export async function testBuildPromptRequiresAllSixDepartments() {
  const { system, user } = buildCeoPrompt({ signals: baseSignals, ceoState: { cyclesRun: 0 }, openInitiatives: [] });
  // 2026-09-19: marketing/fin/delivery have no real signal view yet (see signals.mjs) and
  // were silently getting zero delegations as a result. The prompt must explicitly require
  // covering all six departments — via a delegation or an honest "noAction" entry — so a
  // missing signal source never again reads as "the CEO chose to ignore this department."
  assert.match(system, /marketing/i);
  assert.match(system, /\bfin\b/i);
  assert.match(system, /delivery/i);
  assert.match(system, /noAction/);
  assert.match(user, /noAction/);
  console.log('ok: buildCeoPrompt requires accounting for all six departments, including noAction');
}

export async function testBuildPromptRequiresActionClassification() {
  // 2026-09-19: serve.mjs's immediate /run path never checks task.needsOk, so this
  // classification (enforced in delegate.mjs) is the actual approval gate for CEO-originated
  // work. The prompt must ask for it honestly, not as an afterthought.
  const { system, user } = buildCeoPrompt({ signals: baseSignals, ceoState: { cyclesRun: 0 }, openInitiatives: [] });
  assert.match(system, /actionClass/);
  assert.match(system, /first-contact-or-committing/);
  assert.match(system, /routine-outbound/);
  assert.match(user, /actionClass/);
  console.log('ok: buildCeoPrompt requires honest actionClass on every delegation');
}

export async function testBuildPromptExplainsReplyOutcomeSignal() {
  // 2026-09-21: a real, already-correctly-resolved decline (Urban Quarter WA) was flagged
  // as an unhandled reply because escalationState='none' cannot tell "nothing has looked at
  // this" apart from "a reply arrived and needed no escalation." The prompt must teach the
  // model to check replyOutcome first and never flag a genuine decline/dnc as a gap.
  const { system } = buildCeoPrompt({ signals: baseSignals, ceoState: { cyclesRun: 0 }, openInitiatives: [] });
  assert.match(system, /replyOutcome/);
  assert.match(system, /declined.*never flag|never flag.*declined/i);
  console.log('ok: buildCeoPrompt explains replyOutcome so a resolved decline is never misread as an unhandled gap');
}

export async function testBuildPromptExplainsOldVsNewPipelineSources() {
  // 2026-09-21: the director directly reported the CEO kept re-flagging the same stale
  // items (an old phone-first call queue) for days. Root cause: the old funnel/prospects/
  // vaTasks views were built entirely from the OLD, retired Reset Sales Control board and
  // never saw the current AI Sales Pipeline board at all. The 2026-09-21 fix only told the
  // model to ignore those views; hardened 2026-09-23: signals.mjs no longer fetches them at
  // all, so this test asserts the mechanical guarantee (the retired views are structurally
  // absent from what the model receives), not just a prompt instruction to disregard them.
  const { system, user } = buildCeoPrompt({ signals: baseSignals, ceoState: { cyclesRun: 0 }, openInitiatives: [] });
  assert.match(system, /aiSalesPipeline/);
  assert.match(system, /retired/i);
  assert.match(system, /discovery_promotion_job/);
  assert.doesNotMatch(user, /"funnel"|"prospects"|"vaTasks"/, 'the retired board views must never reach the CEO prompt at all, not merely be flagged as historical');
  console.log('ok: buildCeoPrompt receives no retired-board views at all and points solely at aiSalesPipeline');
}

export async function testBuildPromptDirectsRecoveryOfFailedWorkAndLeavesFinanceAlone() {
  const { system, user } = buildCeoPrompt({ signals: baseSignals, ceoState: { cyclesRun: 0 }, openInitiatives: [] });
  assert.match(system, /failed Office task/i);
  assert.match(system, /finance is intentionally out of scope/i);
  assert.match(user, /office.failedTasks/);
  console.log('ok: CEO prompt treats failed tasks as recovery work and leaves finance out of scope');
}

export async function testParseValidJson() {
  const text = '```json\n' + JSON.stringify({ priorities: [{ headline: 'h', evidence: 'e', severity: 'info' }], delegations: [], noAction: [], risks: [], brainNotes: [], escalateForDeepReasoning: false, escalationReason: '' }) + '\n```';
  const parsed = parseCeoResponse(text);
  assert.equal(parsed.priorities.length, 1);
  assert.equal(parsed.escalateForDeepReasoning, false);
  assert.deepEqual(parsed.noAction, []);
  console.log('ok: parseCeoResponse parses fenced JSON');
}

export async function testParseDefaultsNoActionWhenMissing() {
  // Older/looser model output that omits "noAction" entirely must not throw or silently
  // become undefined — it defaults to an empty array like the other list fields do.
  const text = JSON.stringify({ priorities: [], delegations: [], risks: [], brainNotes: [], escalateForDeepReasoning: false, escalationReason: '' });
  const parsed = parseCeoResponse(text);
  assert.deepEqual(parsed.noAction, []);
  console.log('ok: parseCeoResponse defaults noAction to [] when the model omits it');
}

export async function testParseFailsClosedOnMissingOrBadActionClass() {
  const text = JSON.stringify({
    priorities: [], noAction: [], risks: [], brainNotes: [], escalateForDeepReasoning: false, escalationReason: '',
    delegations: [
      { dept: 'sales', text: 'a', dedupeKey: 'k1', hypothesis: 'h', evidence: 'e', owner: 'lexi', nextAction: 'n', expectedBenefit: 'b' }, // actionClass missing
      { dept: 'emails', text: 'b', dedupeKey: 'k2', hypothesis: 'h', evidence: 'e', owner: 'elead', nextAction: 'n', expectedBenefit: 'b', actionClass: 'send-it-now' }, // invalid value
      { dept: 'marketing', text: 'c', dedupeKey: 'k3', hypothesis: 'h', evidence: 'e', owner: 'mlead', nextAction: 'n', expectedBenefit: 'b', actionClass: 'internal' }, // valid, unaffected
    ],
  });
  const parsed = parseCeoResponse(text);
  assert.equal(parsed.delegations[0].actionClass, 'first-contact-or-committing');
  assert.equal(parsed.delegations[1].actionClass, 'first-contact-or-committing');
  assert.equal(parsed.delegations[2].actionClass, 'internal');
  console.log('ok: parseCeoResponse fails closed to "first-contact-or-committing" for missing/invalid actionClass, leaves a valid one alone');
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
    p.stdin = { write() {}, end() {} }; // reason.mjs now writes the prompt to stdin, not argv (Windows argv-length limit)
    setImmediate(() => {
      p.stdout.emit('data', Buffer.from(JSON.stringify({ type: 'result', result: JSON.stringify(resultObj), usage: {}, modelUsage: { 'claude-sonnet': {} } }) + '\n'));
      p.emit('close', 0);
    });
    return p;
  };
}

export async function testRunCeoReasoningParsesResult() {
  const resultObj = { priorities: [], delegations: [], noAction: [], risks: [], brainNotes: [], escalateForDeepReasoning: false, escalationReason: '' };
  const out = await runCeoReasoning({ signals: baseSignals, ceoState: { cyclesRun: 0 }, openInitiatives: [], spawnImpl: fakeSpawn(resultObj), model: 'sonnet' });
  assert.deepEqual(out.parsed, resultObj);
  console.log('ok: runCeoReasoning parses a fake claude CLI result');
}

export async function testEscalationRunsSecondPass() {
  const first = { priorities: [], delegations: [], noAction: [], risks: [], brainNotes: [], escalateForDeepReasoning: true, escalationReason: 'ambiguous strata pricing call' };
  const second = { priorities: [], delegations: [{ dept: 'sales', text: 't', dedupeKey: 'k', hypothesis: 'h', evidence: 'e', owner: 'lexi', nextAction: 'n', expectedBenefit: 'b', actionClass: 'internal', needsOkHint: false, complexity: 'strongest' }], noAction: [], risks: [], brainNotes: [], escalateForDeepReasoning: false, escalationReason: '' };
  let call = 0;
  const spawnImpl = () => (call++ === 0 ? fakeSpawn(first)() : fakeSpawn(second)());
  const out = await reasonWithEscalation({ signals: baseSignals, ceoState: { cyclesRun: 0 }, openInitiatives: [], spawnImpl });
  assert.equal(out.first.parsed.escalateForDeepReasoning, true);
  assert.ok(out.second, 'a second pass must run when escalateForDeepReasoning is true');
  assert.equal(out.final.delegations.length, 1);
  console.log('ok: reasonWithEscalation runs a second opus-tier pass when flagged');
}

export async function testNoEscalationSkipsSecondPass() {
  const first = { priorities: [], delegations: [], noAction: [], risks: [], brainNotes: [], escalateForDeepReasoning: false, escalationReason: '' };
  const spawnImpl = fakeSpawn(first);
  const out = await reasonWithEscalation({ signals: baseSignals, ceoState: { cyclesRun: 0 }, openInitiatives: [], spawnImpl });
  assert.equal(out.second, null);
  console.log('ok: reasonWithEscalation does not run a second pass when not flagged');
}

await testBuildPromptMentionsNoFabrication();
await testBuildPromptRequiresAllSixDepartments();
await testBuildPromptRequiresActionClassification();
await testBuildPromptExplainsReplyOutcomeSignal();
await testBuildPromptExplainsOldVsNewPipelineSources();
await testBuildPromptDirectsRecoveryOfFailedWorkAndLeavesFinanceAlone();
await testParseValidJson();
await testParseDefaultsNoActionWhenMissing();
await testParseFailsClosedOnMissingOrBadActionClass();
await testParseInvalidThrows();
await testRunCeoReasoningParsesResult();
await testEscalationRunsSecondPass();
await testNoEscalationSkipsSecondPass();
