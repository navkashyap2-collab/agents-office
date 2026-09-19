---
department: ops
---
# Reset AI Sales Pipeline — the new prospect board, read before delegating any discovery/calling/pipeline work

Reset now has **two** real monday.com boards. Know which one to use:

| Board | Real id | Role |
|---|---|---|
| **Reset AI Sales Pipeline** | `5031414133` (workspace 3157505) | The live board for every new AI-discovered prospect going forward. Read it via `reset_monday_ai_sales_pipeline`. |
| **Reset Sales Control** | `5031212274` | **Read-only historical/protection source now.** Still real, still authoritative for anything already on it (ongoing conversations, current-client protection lookups, previous-decline history) — but no new prospect is ever written to it again. Read via `reset_monday_sales_control` exactly as before; never propose writing a new prospect there. |

Built and activated 19 September 2026. Production code: `src/ai-sales-pipeline-*.ts` in the Reset repo (schema, VA assignment, promotion job, outcome job, read adapter, write client), plus `src/sales-control-migration-job.ts` for the one-time historical migration. Every rule below is enforced **in code**, not by an LLM's judgment — this note is the same rule in policy, same relationship this brain has to [[va-outcome-routing]].

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

## The historical migration (old board → new board)

A one-time, deliberate, two-phase job — **never a blind bulk copy**:

1. **Dry run** (`sales_control_migration_dry_run_job`, one-shot, read-only) walks every real row on the old board and *decides* — using the identical clearance chain as new discovery (stop/needs-review gate → suppression/protection → duplicate-against-new-board) — whether it is genuinely active and eligible. Every decision (`migrated` / `skipped-stop` / `skipped-needs-review` / `skipped-duplicate` / `skipped-suppressed`) is persisted for director review before anything is ever written anywhere.
2. **Apply** (`sales_control_migration_apply_job`) only runs once `sales_control_migration_apply_enabled` is explicitly turned on by a director — this is a deliberate decision point, never auto-approved from the dry run's counts. It writes only already-decided `migrated` rows, preserving each row's real current Sales Stage/Call Outcome (a migration of an ongoing relationship, not a reset to "Calling"), and re-validates against the live old-board row at write time in case it went hard-stop between the dry run and the apply.

If you (the CEO or any desk) are ever asked to summarize "what happened to the old prospect list," this is the mechanism — check `sales_control_migration_dry_run_evidence` / `sales_control_migration_apply_evidence` in production for the real counts, never estimate.

## What this doesn't change

Current-client protection, personal/relationship suppression, and unsubscribe checks (see [[safety-and-suppression]]) are the same earlier, always-first gate on both boards. A clean pipeline stage on the new board never overrides a suppression match.

See [[MOC-Sales]] for the wider sales workforce; see [[va-outcome-routing]] for the full real Call Outcome/Sales Stage/Lead Quality/Email Status vocabulary this pipeline reuses unchanged.
