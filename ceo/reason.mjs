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

export function buildCeoPrompt({ signals, ceoState, openInitiatives, businessName = 'Reset Commercial Cleaning' }) {
  const system = `You are the RESET AI CEO for ${businessName}, accountable to NAV as Director. ` +
    'You delegate to 6 department leads (elead=emails, lexi=sales, mlead=marketing, olead=ops, alead=fin, dlead=delivery) who run 35 specialist workers; you never do specialist work yourself. ' +
    'You are creating tasks exactly as if the Director typed them into the office\'s command bar — you never approve, execute, or bypass anything outbound yourself, and nothing you write should imply an outbound action has already happened. ' +
    ANTI_FABRICATION + ' Return ONLY a JSON object — no prose, no code fences.';
  const user = `CYCLE STATE\ncyclesRun: ${ceoState.cyclesRun}\nlastMorningCycleDateLocal: ${ceoState.lastMorningCycleDateLocal || 'never'}\n\n` +
    `OPEN INITIATIVES ALREADY IN FLIGHT (do not duplicate these — build on or close them instead)\n${JSON.stringify(openInitiatives, null, 2)}\n\n` +
    `REAL SIGNALS (generated ${new Date(signals.generatedAtMs).toISOString()})\ngateway.reachable: ${signals.gateway.reachable}\n` +
    `office.reachable: ${signals.office.reachable}\noffice.openTasks: ${signals.office.openTasks.length}\n\n` +
    `views (each field is a real value or null — null means unavailable, never zero):\n${JSON.stringify(signals.views, null, 2)}\n\n` +
    'Return: {"priorities":[{"headline":"...","evidence":"...","severity":"info|attention|action-needed"}],' +
    '"delegations":[{"dept":"emails|sales|marketing|ops|fin|delivery","text":"the exact task to hand a department, written as the Director would say it","dedupeKey":"dept:short-stable-slug","hypothesis":"why this matters commercially","evidence":"what real signal supports this","owner":"lead id","nextAction":"what happens after this task completes","expectedBenefit":"one sentence, no invented numbers","needsOkHint":true|false,"complexity":"fast|reasoning|strongest"}],' +
    '"risks":[{"headline":"...","evidence":"..."}],"brainNotes":["one durable lesson or fact worth recording, or omit"],' +
    '"escalateForDeepReasoning":true|false,"escalationReason":"only if true: the specific ambiguous or high-stakes call that needs deeper reasoning"}';
  return { system, user };
}

export function parseCeoResponse(text) {
  const s = String(text).replace(/```json|```/g, '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('CEO response did not contain a JSON object');
  const parsed = JSON.parse(s.slice(a, b + 1));
  return {
    priorities: Array.isArray(parsed.priorities) ? parsed.priorities : [],
    delegations: Array.isArray(parsed.delegations) ? parsed.delegations : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks : [],
    brainNotes: Array.isArray(parsed.brainNotes) ? parsed.brainNotes : [],
    escalateForDeepReasoning: parsed.escalateForDeepReasoning === true,
    escalationReason: String(parsed.escalationReason || ''),
  };
}

export async function runCeoReasoning({ signals, ceoState, openInitiatives, businessName, spawnImpl = nodeSpawn, model = 'sonnet' }) {
  const { system, user } = buildCeoPrompt({ signals, ceoState, openInitiatives, businessName });
  const args = ['-p', user, '--output-format', 'stream-json', '--verbose', '--no-session-persistence', '--system-prompt', system,
    '--disallowedTools', 'Bash,Edit,Write,Read,Glob,Grep,Agent,NotebookEdit,Task,WebFetch,WebSearch', '--no-chrome', '--model', model];
  // Same fix serve.mjs's askX already needs: the CLI refuses to nest inside another
  // Claude Code session, and CLAUDECODE is set whenever this runs from inside one
  // (e.g. manual testing) even though Task Scheduler's real runs never set it.
  const env = { ...process.env }; delete env.CLAUDECODE;
  return new Promise((resolve, reject) => {
    const p = spawnImpl('claude', args, { stdio: ['ignore', 'pipe', 'pipe'], env });
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
