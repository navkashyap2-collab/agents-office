---
department: ops
---
# Reset AI Sales Pipeline — the new prospect board, read before delegating any discovery/calling/pipeline work

Reset now has **two** real monday.com boards. Know which one to use:

| Board | Real id | Role |
|---|---|---|
| **Reset AI Sales Pipeline** | `5031414133` (workspace 3157505) | The live board for every new AI-discovered prospect going forward. Read it via `reset_monday_ai_sales_pipeline`. |
| **Reset Sales Control** | `5031212274` | **Read-only historical/protection source now.** Still real, still authoritative for anything already on it (ongoing conversations, current-client protection lookups, previous-decline history) — but no new prospect is ever written to it again. Read via `reset_monday_sales_control` exactly as before; never propose writing a new prospect there. |

Built and activated 19 September 2026. Production code: `src/ai-sales-pipeline-*.ts` in the Reset repo (schema, VA assignment, promotion job, outcome job, read adapter, write client). Every rule below is enforced **in code**, not by an LLM's judgment — this note is the same rule in policy, same relationship this brain has to [[va-outcome-routing]].

**The new board starts clean.** Director decision, 19 September 2026: no bulk historical migration from the old board, even though a one-time dry-run audit found 823 of 963 old-board rows nominally eligible. The new pipeline is populated only by fresh discovery below — the CEO/workforce finding, researching, verifying and qualifying genuinely new Perth prospects, never a bulk copy of old ones. See "Old prospects and reactivation" below for the one narrow, deliberate exception.

## The real end-to-end flow

1. **Discovery** — `discovery-web-job.ts` finds genuine Perth businesses via OpenStreetMap/Overpass (real premises, never invented), rotating suburb/category daily. Gated off by default (`discovery_engine_enabled`); the director decides when to arm it.
2. **Qualification** — `discovery-vetting.ts` scores each candidate (Perth premises, service fit, public contact, decision-maker evidence) and runs the same clearance chain as everything else in this system: live current-client/protection register + live personal suppression register + **duplicate check against the old Sales Control board's ~960 real rows** — which is exactly the previous-decline check, since any prior real outcome (including a decline) makes a business a duplicate. Only `status='qualified'` candidates are ever eligible to be written anywhere.
3. **Promotion** — `ai-sales-pipeline-promotion-job.ts` writes qualified candidates onto the new board only, under a daily budget, with a deterministic VA assignment (see below). Never runs outside a real Perth weekday — a prospect and its VA owner appear together, never as unassigned inventory.
4. **Calling & outcome** — a VA works the board and records the real Call Outcome (and, for the higher-touch stages, Sales Stage) exactly as before. `ai-sales-pipeline-outcome-job.ts` reads that live state, defers first to the same stop/continue gate as [[va-outcome-routing]] (`routeOutcome`), and:
   - **stop** (Not Interested, Wrong Number, Lost/Not Fit, Won-as-a-hard-stop-for-outreach, Do Not Contact, Existing/Duplicate) → no write-back; the terminal state a VA already recorded is itself the accurate, visible state.
   - **needs-human-review** (a Replied email status, or any value not in the known real vocabulary) → queued as a real escalation, never auto-decided.
   - **continue** → Sales Stage and a plain-English Next Action are advanced automatically (Calling → Decision Maker Reached → Follow-up → Interested → Walkthrough Booked → Quote Sent → Proposal Sent), each acted on exactly once per real change — a VA-recorded outcome is never re-processed or re-escalated on every tick.
   - **Won** is the one deliberate exception: checked *before* the stop gate, because a won deal needs a real next step (hand off to Delivery), not silence.

## VA assignment on the new board

Deterministic, in `ai-sales-pipeline-va-assignment.ts` — never a desk's or the CEO's own judgment call:

- **Bianca** — eligible now, every real Perth weekday.
- **Ife (Olusho Ifeoluwa)** — not eligible for any new-pipeline assignment until **2 October 2026**, then automatically eligible from that date onward with no code or config change needed. Before that date, every new-pipeline assignment goes to Bianca alone, even though both are configured in the primary pool (`va_roster` table). See [[va-roster]] for the wider roster note — that note now reflects this same date gate.
- **Dimaka** and **Josephine** (secondary pool) are unchanged: they continue to work the old Sales Control board's existing secondary-queue mechanism exactly as before. They are never assigned anything from the new pipeline.
- No assignment (of any kind) happens outside a real Perth weekday (`Australia/Perth`, UTC+8, no DST) — a Saturday/Sunday run promotes nothing and assigns no one.

## Old prospects and reactivation — never a bulk copy

`src/sales-control-migration-job.ts` has two functions; know what each one actually does in production:

- `runSalesControlMigrationDryRun` — a one-shot, read-only audit that ran once (19 September 2026): it walked every real row on the old board and *decided*, using the identical clearance chain as new discovery, whether each was nominally eligible. Its evidence (`sales_control_migration_dry_run_evidence` in production, and the `sales_control_migration_decisions` table) is kept **for audit only** — e.g. if you're asked to summarize "what happened to the old prospect list," this is where the real counts are (823 migrated-eligible / 118 needs-review / 21 stopped / 1 suppressed of 963 real rows) — never estimate them.
- `runSalesControlMigrationApply` — **retired, deliberately not wired into the scheduled handler.** It is never called in production and must not be re-added without an explicit director instruction to do so. Bulk historical migration was considered and declined.

The only path an old prospect ever takes into the new board is **one at a time**, and only when the CEO independently identifies it as a genuinely worthwhile reactivation opportunity under the real reactivation rules already in [[va-outcome-routing]] (e.g. a `Has Cleaner`/`Future Review` row that has genuinely gone stale past its reactivation window) — never a batch, never because it merely passed the old dry run's gate.

## What this doesn't change

Current-client protection, personal/relationship suppression, and unsubscribe checks (see [[safety-and-suppression]]) are the same earlier, always-first gate on both boards. A clean pipeline stage on the new board never overrides a suppression match.

See [[MOC-Sales]] for the wider sales workforce; see [[va-outcome-routing]] for the full real Call Outcome/Sales Stage/Lead Quality/Email Status vocabulary this pipeline reuses unchanged.
