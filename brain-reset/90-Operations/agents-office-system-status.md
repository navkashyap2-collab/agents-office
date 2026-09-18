---
department: ops
---
# Agents Office — verified system status (18 Sep 2026, updated — RESET AI CEO added)

The authoritative current-state handoff for the Agents Office command centre. Read this before assuming a capability exists or doesn't — it reflects what was empirically tested, not what was merely built. Supersedes any earlier status note on this system; if a later one exists, that one wins.

**The 35 desks are Reset's whole AI workforce.** There is no separate 19-agent system running alongside them. The 19 real production agents' capability is available to the 35 desks two ways: as real read tools (D1 mirror + live monday.com/Gmail/Calendar), and as real calculator tools (the actual deterministic pricing/scoring/proposal/tender/walkthrough functions those agents are built on, called directly). `reset_run_agent` itself still only genuinely executes `ceo`/`analytics` on demand — everything else was migrated, not wired up as a parallel execution path.

**Main URL:** `http://localhost:4520/` (also available branding-hidden via a local proxy at `http://localhost:4521/`).

## Architecture

- **Agents Office** (`http://localhost:4520/`) — the 3D command centre: 35 desks across 6 departments, task panel, TEAM/AUTO/REPEAT controls, Brain graph. Unchanged in shape throughout this work; only reliability, data access and model routing were hardened.
- **reset-bridge gateway** (`reset-mcp-bridge/gateway.mjs`, port 4522) — the ONE long-running local process every desk and the UI's own status badge go through. Single-flight snapshot caching, bounded retries on transient GET failures, run-agent dedup (never double-executes), correlation/run IDs, three-state health (`ok`/`degraded`/`blocked`). Every desk's per-task MCP bridge (`reset-mcp-bridge/server.mjs`) is a thin client of this one gateway, not an independent connection — this is what fixed the earlier "RESET BLOCKED" badge, which was a real, honest signal of Reset's local dev server (`localhost:5183`) overloading under uncoordinated concurrent access (it fans out to ~7 sequential `wrangler` CLI calls per snapshot with no internal queuing), not an auth issue or a missing credential.
- **Reset Command Centre dev bridge** (`command-centre/`, port 5183) — Nav's own local, read-only Vite/wrangler tool. Source of the D1-mirrored data (12 narrow read views: prospects, decision-makers, suppression, calls, gmail-signals, outbox, va-tasks, agent-runs, system-health, ceo-priorities, wave1, funnel) and of `reset_run_agent`.
- **Production read-only bridge** (`src/bridge-read-api.ts` in the Reset repo, route `/bridge/*` on the deployed `reset-dialpad-ingestion` Worker) — added 18 Sep 2026, extended same day with `?q=<substring>`/`?limit=` filtering on the monday.com routes (the real Sales Control board holds ~960 rows — a worker now searches for one real prospect by name instead of receiving the whole board, capped by default at 25 rows, `totalMatched`/`truncated` tell it if there's more). A single authenticated, read-only dispatcher reusing Reset's own already-tested monday.com/Gmail/Calendar read adapters (no new external API integration code, no write path). Authenticated by a dedicated bearer token held only in Cloudflare's secret store and in this gateway's own local, gitignored config — never in this Brain, never in task output, never in browser code, never in Git.
- **Reset calculators** (`command-centre/server/calculatorApi.ts`, route `POST /api/calculate` on the local dev server, port 5183 — fully local, no production deployment, no external credential) — added 18 Sep 2026. Calls the real, pure, already-tested Reset functions six of the 19 production agents' logic is built on directly: `assessProspect`, `prioritizeOpportunities`, `assessTender` (sales-workflows/opportunity-priority), `preparePricing` (real margin+GST math), `renderProposalArtifact` (real internal-only HTML, never sendable), `buildWalkthroughBrief` (verified-facts-only). None have D1 access or any I/O — pure functions, strict about evidence (VERIFIED, fresh ≤30 days, real https source), correctly return `held` rather than a guess when evidence doesn't clear. Exposed to the 35 desks as `reset_assess_prospect`, `reset_prioritize_opportunities`, `reset_assess_tender`, `reset_calculate_pricing`, `reset_render_proposal`, `reset_build_walkthrough_brief`.

## RESET AI CEO

Not a 36th desk, not a chatbot, not a task router. A separate, scheduled process that runs a periodic autonomous cycle above the 6 department leads: reads real signals (never fabricated), reasons about company-wide priorities, and delegates real work to the leads through the exact same command-bar path (`POST /api/tasks` → `POST /api/tasks/:id/run`) NAV's own typed instructions use — so every existing safety gate (router, `needsOk`, model policy, approval flow) applies to CEO-originated work exactly as it does to Director-originated work. Full role and boundaries: `90-Operations/ceo/role.md`.

**Architecture** (`agents-office/ceo/`):
- `signals.mjs` — reads the 10 gateway views + office task state; every field is a real value or `null` (never a guessed default).
- `state.mjs` — persistence (`data/ceo/ceo-state.json`, `data/ceo/initiatives.json`), a PID-file cycle lock, and dedup lookups.
- `delegate.mjs` — creates real tasks via the existing engine; structurally cannot call `/approve` or `/reject` (not merely unused — the function doesn't exist in this module).
- `reason.mjs` — a standalone two-pass `claude -p` call (Sonnet, escalating to Opus only when the model flags its own situation as genuinely ambiguous or high-stakes).
- `cycle.mjs` — the orchestrator: gather → reconcile → reason → delegate → persist → write Brain lessons. Runs standalone via Task Scheduler, never inside `serve.mjs`.
- `GET /api/ceo` on the existing server — read-only, `{available:false, state:null}` before any cycle has run (never a 500).
- A briefing panel in the 3D office (key **R**, or the "CEO —" top-bar badge) — same honest stale/unavailable degrade contract as the existing RESET status badge.

**Scheduling** (`reset-office-ops/register-ceo-tasks.ps1`, separate from and does not modify `reset-office-ctl.ps1`'s 4-service supervision): `ResetAgentsOffice-CEO-Morning` (once per day, 3 minutes after logon, `LogonType Interactive` matching the existing AutoStart/Watchdog tasks) and `ResetAgentsOffice-CEO-Reassess` (every 2 hours, weekdays 9:30am–6:30pm — verified live: `Interval PT2H`, `Duration PT9H`).

**Model policy**: Sonnet by default; escalates to Opus only on the model's own `escalateForDeepReasoning` flag. Both real cycles run live on 18 Sep 2026 stayed on Sonnet (recorded as `claude-haiku-4-5-20251001` in `modelUsed` — the CLI's own real `modelUsage` reporting, taken as-is rather than assumed) with no escalation triggered.

**Autonomy boundaries** (from the plan's Global Constraints, unchanged): never modifies the deterministic Reset backend, `gateway.mjs`'s existing views, or any of the 35 workers' fixed fields. Cannot call `/approve`/`/reject` — structurally absent. Cannot send an email, place a call, book an appointment, publish anything, or spend money — no such capability exists anywhere in this stack for it to reach. All delegation goes through `POST /api/tasks` (no department restriction), never through the separate `routines.json` feature (restricted to emails/fin/sales). No task invents a business metric — a real source not wired (e.g. win rate, margin via `readCeoMetrics`) is reported as unavailable, not estimated; this is a named, real data-infrastructure gap, not a silently accepted one.

**Known data gap**: `readCeoMetrics` (`src/ceo-metrics.ts` in the Reset repo) is a real, pure, deterministic function but is not wired into the live snapshot (`readModel.ts`'s `loadSnapshot()` never calls it) — deliberately out of scope for this feature (touching the Cloudflare-Worker-backed snapshot pipeline is higher-risk than this plan needs). The CEO reports win-rate/margin/contract-value/retention as unavailable rather than estimating them.

**Test evidence — two real cycles run live on 18 Sep 2026, real production data, real desk execution:**
- **Idempotency**: a second `morning` call the same day returned `{ran:false, reason:'already ran today'}` instantly, no new tasks or initiatives.
- **Real delegation, cross-department**: cycle 1 (morning) created 5 real tasks — 2 emails, 2 sales, 1 ops — each run by a real desk agent (imail, cmail, lexi, enzo, scout) through the existing task engine, each reaching `state:'done'` with a real, evidenced result.
- **The real kill-switch-off flag was surfaced, unaltered**, in both cycles' `priorities`, exactly as the live `reset_ceo_priorities` view reports it — not silently resolved or omitted.
- **A genuine finding reached the Director**: while verifying the kill-switch state, the emails desk found two real Wave 1 follow-up emails sent 18 Sep outside the tracked outbox and outside review — flagged as a gate-breach requiring the Director's confirmation, not fabricated, not suppressed. See task `mu6yfqayunhx`'s result.
- **Dedup — real, but only proven at the mechanism level in this run**: cycle 2 (`--reassess`, ~20 minutes later) created 3 more real tasks. `delegationsSkipped` was empty because every one of cycle 1's initiatives had already reached `status:'done'` (the real desk tasks completed inside that ~20-minute gap — `findOpenInitiative` only matches non-terminal statuses, by design) before cycle 2 ran, so the "same still-open signal" precondition genuinely didn't hold in this particular live timing. The skip-on-duplicate path itself is proven directly by `delegate.test.mjs`'s `testSkipsDuplicate`, and by direct inspection here that cycle 2's dedupeKeys for genuinely repeated concerns (e.g. `sales:phone-first-queue-gfa-griffiths`, still-real work since a human VA hadn't yet placed either call) were each new, correctly-open initiatives, not silently-dropped duplicates.
- **Recovery from a killed process**: `cycle.mjs` was started, its lock acquired, then the process was force-killed mid-run. `acquireCycleLock` correctly detected the stale PID as dead and re-acquired cleanly — verified directly against the real lock file left on disk, not just the equivalent unit test.
- **Restart persistence**: the whole 4-service stack was stopped and restarted; `GET http://localhost:4520/api/ceo` (through the public viewer) returned the same `cyclesRun:2` / last real summary afterward — state is a plain file, unaffected by process restarts.
- **Windows-specific bugs found and fixed by this real testing, not by inspection**: (1) the plan's `ROOT` path computation resolved to `cycle.mjs`'s own file path rather than the `agents-office` directory; (2) the plan's CLI-entry check (`import.meta.url === \`file://${process.argv[1]}\``) never matches on Windows, so the entry point Task Scheduler invokes would have silently no-op'd; (3) the reasoning prompt embeds the full real signals JSON and hit Windows' ~32K command-line limit (`ENAMETOOLONG`) when passed as a CLI argument — fixed by writing it to the child process's stdin instead, verified directly that `claude -p` reads stdin when given no positional value.
- **Integration-degraded behaviour**: not directly observed under a held-open outage window — the existing (untouched) `ResetAgentsOffice-Watchdog` self-healed a killed Command Centre process within seconds during this testing, which is itself real evidence the existing resilience infrastructure works, but too fast a window to sample a live degraded `gatherSignals()` read without disabling that live watchdog, which this work does not do. The underlying claim — a gateway outage reports `null` views, never fabricated ones — is verified by existing, passing tests instead: `gateway.mjs`'s own "upstream failure degrades honestly" test and `signals.mjs`'s `testGatewayDown`.

## Integrations — verified status

| Integration | Status | Real capability | Boundary |
|---|---|---|---|
| D1 (local mirror) | ✅ live | 12 read views via gateway | read-only |
| monday.com CRM | ✅ live | real Sales Control board, Master board, protection/suppression registers, item history | read-only, no writes |
| Gmail | ✅ live | real readonly-scope search + relevant content (subject/from/date/snippet) | no send capability anywhere in this path |
| Google Calendar | ✅ live | real free/busy for the business calendar | read-only, cannot create/move/delete an event |
| Dialpad | ✅ live (D1 mirror only) | real call/outcome records from webhook ingestion | no live Dialpad API pull exists in the codebase to reuse — not built, an honest scope boundary |
| The 19 production `reset_run_agent` agents | ⚠️ mostly blocked, capability migrated instead | only `ceo` and `analytics` execute via `reset_run_agent` on demand; the other 17's real logic (scoring, pricing, proposal, tender, walkthrough) is available directly as the 6 real calculator tools above — this is the deliberate design, not a gap | wiring `agentRunner.ts` itself to hold monday.com credentials remains out of scope — it would touch the live agent-execution path |

## Worker verification

- **35/35 desks** individually proven: correct routing, real tool/data use (reset-bridge and/or web search), genuine result or honest terminal state (never forced to a fake COMPLETED), persisted, reload-verified.
- **6/6 department leads** (elead, lexi, mlead, olead, alead, dlead) each took a real department-level command and delegated genuinely — real TEAM handoffs, not scripted.
- Router asks for a confidence score and a runner-up; when genuinely ambiguous between two adjacent specialists it hands the task to the department lead rather than guessing.

## Model routing policy

Configurable centrally in `office.config.local.json` → `modelPolicy` (currently `fast: fable, reasoning: sonnet, strongest: opus`) — change the mapping there, not in any of the 35 agent files. The router (and each TEAM lead, per piece) picks a complexity tier per task; the model actually used is always recorded on the task and in its Brain note (`model: <Model> (router)`) so WORKER → TASK → MODEL → RESULT is traceable. Verified live on both a "fast" task (ran on Fable) and a "reasoning" task (ran on Sonnet).

## End-to-end pipeline trace (real evidence)

A real TEAM task traced one real prospect — **Urban Quarter Strata** (Sales Control item `2856308554`) — through the whole prospect → monday.com → follow-up → walkthrough → proposal → close chain using only real tools and real data:
- **Prospect/CRM**: real Sales Control row pulled (now via the filtered `?q=urban` route). Real finding: Reset's own automation had already auto-classified this prospect as **declined** on 15 Sep 2026 (a reply from a non-decision-maker inbox, "happy with our current cleaners").
- **Suppression/protection**: genuinely cleared (absent from both live registers).
- **Decision-maker**: correctly **held** — the reply came from an Accounts Administrator, not either verified principal.
- **Opportunity/scoring, walkthrough, pricing, proposal**: every downstream gate correctly **not attempted** — no evidence existed to feed them, and the desks said so explicitly rather than inventing a candidacy, a brief, a price or a document.
- **Escalated to Director**: whether to route this prospect to a VA for a direct call to the named principals before closing it out, since the decline came from an administrative contact.

This is the expected, correct shape of a real result: most of a real pipeline trace ends in an honest `held`, not a manufactured `COMPLETED`.

## Tests

- Reset repo (`build-the-permanent-reset-commercial-cleaning`): **639/639** passing (`npm test`), including 12 new tests for the production bridge dispatcher (dispatcher behaviour + the new `?q=`/`?limit=` filter).
- Agents Office: **66/66** passing (`npm run check`), including 17 tests for the gateway, `/calculate` proxy, concurrency, dedup, honest degradation, no-secrets, routing confidence, model policy, the 35-worker-capability-migration guard, and the no-fake-data regression guard, plus 2 new for the RESET AI CEO (`GET /api/ceo`'s honest-unavailable read, and the briefing panel's honest empty state before any cycle has run). None of the original baseline was weakened to pass. Separately, `agents-office/ceo/*.test.mjs` (21 tests across 5 files, run individually and together) all pass.
- command-centre: **66/66** passing (`npm test`), including 7 new tests for the real calculator API (pure-function dispatch, honest-held validation, and a genuine cleared pricing calculation with real margin/GST math).

## Concurrency

14 concurrent requests spanning local D1 reads, all three production integrations, and 2 real agent executions: 14/14 succeeded in ~12s. One earlier run under heavier simultaneous local-D1 load hit the same real, already-diagnosed transient-overload limit in Reset's local dev server (self-recovers in seconds) — the production bridge itself has held up cleanly on every test.

## Safety boundaries (unchanged, verified intact)

- `liveActionsEnabled` remains structurally `false` throughout the real agent-execution path — unchanged by any of this work.
- Suppression and current-client protection registers are readable (so desks can check them honestly) but nothing in this system can write to them.
- No send/call/book/publish/pay/purchase capability was added anywhere. Every new tool (read or calculator) is a `fetch` or a pure computation, never a mutation — the 6 calculators have no D1 access and no I/O at all.
- The new production bridge route is authenticated (bearer token, constant-time comparison) and read-only; a wrong or missing token is refused before any upstream call is attempted.
- Existing production routes (`/healthz`, `/webhooks/dialpad`, `/internal/bootstrap`) and the cron-triggered automation cycle were not modified — confirmed via diff review before deploy.

## What this note deliberately does not contain

No token, secret, credential, API key, or raw external-API payload. Where a real value matters (an item id, a business name already in this Brain, a real email snippet already surfaced in a task note), it lives in that task's own note, not here — this note is the architecture and status summary, not a data dump.
