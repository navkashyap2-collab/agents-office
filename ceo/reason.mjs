// agents-office/ceo/reason.mjs
// The CEO's own reasoning: a standalone `claude -p` call (mirroring serve.mjs's
// askX CLI pattern) over already-gathered real signals — no live tool access here,
// because signals.mjs already fetched everything honestly. Two-pass: a sonnet
// pass synthesises priorities/delegations/risks; if it flags escalateForDeepReasoning,
// a second opus pass re-examines just that situation with the first pass attached.
import { spawn as nodeSpawn } from 'node:child_process';

const ANTI_FABRICATION = 'Never invent, guess or fabricate a prospect, contact, revenue figure, metric, client requirement or result. ' +
  'A view that is null in the signals below means no verified source exists right now for that data — say so plainly; do not treat null as zero or as "nothing happening." ' +
  'When evidence is insufficient for a call, say HOLD and explain what is missing rather than guessing.';

// 2026-09-21 fix: a real, already-correctly-resolved decline (Urban Quarter WA, 15
// September 2026 — the prospect replied "happy with our current cleaners," was classified,
// logged to the CRM, and correctly received no further outreach) was flagged as an
// unhandled gap ("Live prospect reply sitting with no escalation task") purely because
// outbox.escalationState reads 'none' for BOTH "nothing has looked at this yet" and "a
// reply arrived and needed no escalation in the first place" — the field cannot tell those
// apart on its own. outbox rows now carry replyOutcome for exactly this: 'declined' or
// 'dnc' means the reply was genuinely resolved and closed, never a gap to flag; 'positive'
// still deserves a priority only if no newer CRM/task activity shows someone already acted
// on it; 'ambiguous' or 'unreadable' are the only outcomes that may genuinely need a human
// to read the thread; and null (no replyOutcome recorded at all) alongside a set repliedAtMs
// is the one combination that may be a real unclassified gap worth flagging.
const REPLY_OUTCOME_GUIDANCE = 'Every outbox row includes replyOutcome (\'positive\'|\'declined\'|\'dnc\'|\'ambiguous\'|\'unreadable\'|null). ' +
  'Before flagging any row with repliedAtMs set and escalationState=\'none\' as an unhandled reply, check replyOutcome first: ' +
  '\'declined\' or \'dnc\' means it was already classified and correctly closed with no escalation needed — never flag it as a gap. ' +
  '\'positive\' deserves a priority only if nothing in the signals shows it was already acted on. ' +
  'Only \'ambiguous\', \'unreadable\', or null (no outcome recorded despite a reply) may genuinely need a human to look — and even then, say plainly what the gap is (e.g. "reply received but not yet classified"), never imply it was never looked at when replyOutcome shows otherwise.';

// 2026-09-21 fix, hardened 2026-09-23: the director directly reported that this cycle
// keeps re-flagging the same dead-end items for days on end -- confirmed live: the old
// funnel/prospects/vaTasks views were built entirely from the OLD, retired Reset Sales
// Control board / Wave1 pilot (see command-centre/server/readModel.ts's
// buildFunnel(wave1) -- it never received any AI Sales Pipeline data at all), so every
// "phone-first queue" / "qualified, none promoted" priority this cycle produced from them
// was about a system this business no longer runs new prospects through. The 2026-09-21
// fix relied on telling the model to treat those views as historical-only, which only
// works if the model reliably follows that instruction every cycle; as of 2026-09-23,
// signals.mjs no longer fetches funnel/prospects/vaTasks at all, so there is nothing left
// for the CEO to misread even if this guidance were ignored -- the mechanical guarantee is
// in what data reaches the model, not in what it's told to do with it. This guidance now
// only needs to point the model at the real source. views.systemHealth.jobStates may still
// list discovery_promotion_job as 'running', which is not a live incident: that job was
// intentionally retired when the AI Sales Pipeline board replaced it as the sole
// destination for new prospects (see src/index.ts's own comment on this) and its stale D1
// row is a known, harmless leftover, never something needing action.
const OLD_SYSTEM_GUIDANCE = 'views.aiSalesPipeline is the current, live Reset AI Sales Pipeline board (5031414133) and is the ONLY source of truth for what today\'s real sales pipeline looks like -- base every sales-pipeline priority and delegation on it. ' +
  'The old Reset Sales Control board and Wave1 pilot (phone-first call queues, qualified-but-not-promoted counts, etc.) are retired and deliberately not included anywhere in these signals -- never reconstruct or reference them from memory or from office.recentDone/failedTasks history. ' +
  'Separately, if views.systemHealth.jobStates lists discovery_promotion_job, it is a known-retired job whose D1 row was never cleaned up -- never flag it as a stuck or failing job; that job is not supposed to update and its inactivity is not a problem.';

// 2026-09-19 fix: the real signal views (funnel, prospects, calls, gmail, va tasks, etc.)
// only ever cover sales/emails/ops — no gateway view exists yet for marketing, fin or
// delivery. Combined with ANTI_FABRICATION, that silently starved those three departments:
// the model correctly had nothing to say about them, so it said nothing at all, which is
// indistinguishable on the dashboard from "the CEO is ignoring these departments." Verified
// live: brain notes from 2026-09-18/19 show sales/emails/ops delegations only. This
// instruction — plus the required "noAction" field below — makes that gap visible every
// cycle instead of invisible, and gives the model an honest way to still engage those three
// departments (asking their own lead to go get real data is not fabrication).
const DEPARTMENT_COVERAGE = 'Every cycle you must account for ALL SIX departments — emails, sales, marketing, ops, fin, delivery — not only the ones with real signal data below. ' +
  'The signals below are strongest for sales/emails/ops (aiSalesPipeline, calls, gmail); marketing and delivery can be asked to verify their own real source when necessary. Finance is intentionally out of scope until the Director connects a verified finance source: always list fin in noAction with that reason and never create a finance task merely to fill coverage. ' +
  'When you have no real signal for marketing or delivery, do not simply say nothing about it: delegate a real, honest task asking that department\'s own lead to check its own real data through its own tools. Asking a department to go get the truth is never fabrication. ' +
  'Only when a department genuinely has no useful next step — even after being asked to check its own real data, or because it already has open work in flight — list it in "noAction" with one honest sentence why. Never simply omit a department from both "delegations" and "noAction."';

const RECOVERY_OPERATING_RULE = 'Treat office.failedTasks as a live recovery queue, not completed work. For each recent failed Office task, either create one internal diagnosis/recovery delegation with a stable dedupeKey, or state an honest noAction reason when the failure is already covered by an open initiative. Use views.aiSalesPipeline as the current source for pipeline stage and VA ownership; do not infer staff capacity beyond those verified fields.';

// 2026-09-19: verified by reading serve.mjs that the immediate-run path every CEO delegation
// uses (POST /api/tasks then POST /api/tasks/:id/run) executes straight through to 'done' with
// no approval gate of any kind — the needsOk -> 'waiting' step only applies to office-clock
// routines and scheduled tasks, not to this path. So this classification, enforced in
// delegate.mjs, IS the real approval gate for CEO-originated work — treat it as load-bearing,
// not a formality.
const ACTION_CLASSIFICATION = 'Classify every delegation honestly with "actionClass":\n' +
  '- "internal": research, analysis, drafting, verification, Brain updates — no contact with anyone outside Reset. Runs immediately.\n' +
  '- "routine-outbound": a follow-up, reminder or check-in to someone Reset already has an open relationship or conversation with — nothing new committed, no new price or quote. Runs immediately.\n' +
  '- "first-contact-or-committing": first contact with a brand-new prospect, any price or quote, any phone call, any public/social post, or anything else that commits the business or reaches someone new. This is also the safe default whenever you are genuinely unsure. This is NOT run automatically — it is created and left for NAV to run himself.\n' +
  'Classify by what the task actually is, never by what would be convenient — do not mark something "routine-outbound" just so it runs sooner.';

// 2026-09-19: NAV's own hard-won read on his market, not generic industry advice — recorded
// here, not just in a one-off task, so every future cycle inherits it. Strata BODIES CORPORATE
// (owner committees) are a near-impossible sale — decisions need a committee vote, not a
// single yes. Public tenders are dominated by incumbents and price wars Reset usually can't
// win. What has actually converted for Reset: a single facility/office manager who can say
// yes alone (Easy Living Homes, MTA Transport), a single clinic/centre owner or manager
// (Shenton Ave medical, Byford Childcare), and strata MANAGEMENT COMPANIES who hold the
// cleaning decision on behalf of a portfolio of buildings (Chambers Franklyn) — never the
// owners themselves.
const TARGETING_PRIORITY = 'When proposing new sales/marketing pursuit (not just servicing existing pipeline), prioritise targets where ONE person can say yes: ' +
  'facility/office managers at corporate offices, owners/managers of medical, dental and childcare centres, and strata MANAGEMENT COMPANIES (the firm that manages buildings on behalf of owners) — never a strata body corporate / owners\' committee directly, since that needs a committee vote and has proven a very poor use of effort. ' +
  'Treat public tenders as low priority by default — Reset has found them dominated by incumbents and price competition Reset usually cannot win — unless a specific real signal shows an unusually good fit worth the effort, in which case say so explicitly in the hypothesis.';

export function buildCeoPrompt({ signals, ceoState, openInitiatives, businessName = 'Reset Commercial Cleaning' }) {
  const system = `You are the RESET AI CEO for ${businessName}, accountable to NAV as Director. ` +
    'You delegate to 6 department leads (elead=emails, lexi=sales, mlead=marketing, olead=ops, alead=fin, dlead=delivery) who run 35 specialist workers; you never do specialist work yourself. ' +
    'You are creating tasks exactly as if the Director typed them into the office\'s command bar — you never approve, execute, or bypass anything outbound yourself, and nothing you write should imply an outbound action has already happened. ' +
    DEPARTMENT_COVERAGE + ' ' + RECOVERY_OPERATING_RULE + ' ' + TARGETING_PRIORITY + ' ' + ACTION_CLASSIFICATION + ' ' + ANTI_FABRICATION + ' ' + REPLY_OUTCOME_GUIDANCE + ' ' + OLD_SYSTEM_GUIDANCE + ' Return ONLY a JSON object — no prose, no code fences.';
  const user = `CYCLE STATE\ncyclesRun: ${ceoState.cyclesRun}\nlastMorningCycleDateLocal: ${ceoState.lastMorningCycleDateLocal || 'never'}\n\n` +
    `OPEN INITIATIVES ALREADY IN FLIGHT (do not duplicate these — build on or close them instead)\n${JSON.stringify(openInitiatives, null, 2)}\n\n` +
    `REAL SIGNALS (generated ${new Date(signals.generatedAtMs).toISOString()})\ngateway.reachable: ${signals.gateway.reachable}\n` +
    `office.reachable: ${signals.office.reachable}\noffice.openTasks: ${signals.office.openTasks.length}\noffice.failedTasks: ${signals.office.failedTasks.length}\n\n` +
    `views (each field is a real value or null — null means unavailable, never zero):\n${JSON.stringify(signals.views, null, 2)}\n\n` +
    'Return: {"priorities":[{"headline":"...","evidence":"...","severity":"info|attention|action-needed"}],' +
    '"delegations":[{"dept":"emails|sales|marketing|ops|fin|delivery","text":"the exact task to hand a department, written as the Director would say it","dedupeKey":"dept:short-stable-slug","hypothesis":"why this matters commercially","evidence":"what real signal supports this","owner":"lead id","nextAction":"what happens after this task completes","expectedBenefit":"one sentence, no invented numbers","actionClass":"internal|routine-outbound|first-contact-or-committing","needsOkHint":true|false,"complexity":"fast|reasoning|strongest"}],' +
    '"noAction":[{"dept":"emails|sales|marketing|ops|fin|delivery","reason":"one honest sentence — why this department genuinely has no useful next step this cycle"}],' +
    '"risks":[{"headline":"...","evidence":"..."}],"brainNotes":["one durable lesson or fact worth recording, or omit"],' +
    '"escalateForDeepReasoning":true|false,"escalationReason":"only if true: the specific ambiguous or high-stakes call that needs deeper reasoning"}';
  return { system, user };
}

const VALID_ACTION_CLASSES = ['internal', 'routine-outbound', 'first-contact-or-committing'];

export function parseCeoResponse(text) {
  const s = String(text).replace(/```json|```/g, '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('CEO response did not contain a JSON object');
  const parsed = JSON.parse(s.slice(a, b + 1));
  const delegations = (Array.isArray(parsed.delegations) ? parsed.delegations : []).map(d => ({
    ...d,
    // Fail closed: a missing or unrecognised actionClass is treated as the safe default
    // (first-contact-or-committing), never as "safe to auto-run."
    actionClass: VALID_ACTION_CLASSES.includes(d.actionClass) ? d.actionClass : 'first-contact-or-committing',
  }));
  return {
    priorities: Array.isArray(parsed.priorities) ? parsed.priorities : [],
    delegations,
    noAction: Array.isArray(parsed.noAction) ? parsed.noAction : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks : [],
    brainNotes: Array.isArray(parsed.brainNotes) ? parsed.brainNotes : [],
    escalateForDeepReasoning: parsed.escalateForDeepReasoning === true,
    escalationReason: String(parsed.escalationReason || ''),
  };
}

export async function runCeoReasoning({ signals, ceoState, openInitiatives, businessName, spawnImpl = nodeSpawn, model = 'sonnet' }) {
  const { system, user } = buildCeoPrompt({ signals, ceoState, openInitiatives, businessName });
  // The user prompt embeds the full real signals JSON (all 10 gateway views + office task
  // state) and can genuinely exceed Windows' ~32K command-line length limit (verified live:
  // a real cycle against real production data hit ENAMETOOLONG with `user` as a CLI arg).
  // `-p` given with no positional value reads the prompt from stdin instead — verified
  // directly (`echo ... | claude -p` answers correctly) — which has no such size limit.
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--no-session-persistence', '--system-prompt', system,
    '--disallowedTools', 'Bash,Edit,Write,Read,Glob,Grep,Agent,NotebookEdit,Task,WebFetch,WebSearch', '--no-chrome', '--model', model];
  // Same fix serve.mjs's askX already needs: the CLI refuses to nest inside another
  // Claude Code session, and CLAUDECODE is set whenever this runs from inside one
  // (e.g. manual testing) even though Task Scheduler's real runs never set it.
  const env = { ...process.env }; delete env.CLAUDECODE;
  return new Promise((resolve, reject) => {
    const p = spawnImpl('claude', args, { stdio: ['pipe', 'pipe', 'pipe'], env });
    p.stdin.write(user); p.stdin.end();
    let out = '', text = '', gotResult = false, modelUsed = model;
    const timer = setTimeout(() => { p.kill && p.kill('SIGKILL'); reject(new Error('CEO reasoning took too long')); }, 180000);
    const feed = line => {
      if (!line.trim()) return;
      let j; try { j = JSON.parse(line); } catch { return; }
      if (j.type === 'result') { gotResult = true; text = String(j.result || '').trim(); modelUsed = Object.keys(j.modelUsage || {})[0] || model; }
    };
    p.stdout.on('data', d => { out += d; let i; while ((i = out.indexOf('\n')) >= 0) { feed(out.slice(0, i)); out = out.slice(i + 1); } });
    p.on('error', e => { clearTimeout(timer); reject(e); });
    p.on('close', () => {
      clearTimeout(timer); if (!gotResult) feed(out);
      if (!text) return reject(new Error('CEO reasoning returned nothing'));
      try { resolve({ raw: text, parsed: parseCeoResponse(text), modelUsed }); } catch (e) { reject(e); }
    });
  });
}

export async function reasonWithEscalation({ signals, ceoState, openInitiatives, businessName, spawnImpl = nodeSpawn }) {
  const first = await runCeoReasoning({ signals, ceoState, openInitiatives, businessName, spawnImpl, model: 'sonnet' });
  if (!first.parsed.escalateForDeepReasoning) return { first, second: null, final: first.parsed };
  const escalatedInitiatives = [...openInitiatives, { note: 'FIRST PASS FLAGGED FOR DEEPER REASONING', escalationReason: first.parsed.escalationReason, firstPassOutput: first.parsed }];
  const second = await runCeoReasoning({ signals, ceoState, openInitiatives: escalatedInitiatives, businessName, spawnImpl, model: 'opus' });
  return { first, second, final: second.parsed };
}
