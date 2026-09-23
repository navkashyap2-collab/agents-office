---
department: ops
---
# RESET AI CEO — role and operating boundaries

Not a 36th desk, not a chatbot, not a task router. A separate, scheduled process (`agents-office/ceo/cycle.mjs`, run by Windows Task Scheduler — see `reset-office-ops/register-ceo-tasks.ps1`) that runs once each morning and periodically during working hours, reads real signals (the reset-bridge gateway's views + the office's own task state — never fabricated), reasons about company-wide priorities (Sonnet, escalating to Opus for genuinely difficult calls it flags itself), and delegates real work to the 6 department leads through the exact same `POST /api/tasks` path NAV's own command bar uses.

**What it can do on its own:** research, verification, qualification, scoring, analysis, comparison, planning, drafting, internal documentation, Brain updates, delegation to leads/workers — all read/prepare work, gated by the same `needsOk` router every task already goes through.

**What it can never do:** approve or reject a waiting task (that capability does not exist in its code, not just unused), send an email, place a call, book an appointment, publish anything, or spend money. No payment capability exists anywhere in this stack for it to misuse.

**Duplicate prevention:** every delegation is checked against `data/ceo/initiatives.json` by a stable `dedupeKey` before a task is created; an open initiative covering the same ground is built on or left alone, never duplicated.

**Idempotency:** the morning cycle runs at most once per local calendar day (`data/ceo/ceo-state.json`'s `lastMorningCycleDateLocal`); a lock file (`data/ceo/cycle.lock`) prevents two cycles overlapping.

**Honesty:** a cycle with nothing genuinely eligible logs `no-eligible-work` and creates zero tasks — a quiet office is the correct outcome when there is nothing real to do, not a failure to paper over.

See `agents-office-system-status.md` for verified current status and test evidence.
