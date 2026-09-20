---
agent: OPERATIONS LEAD
department: OPERATIONS
task: mu84ahud0n3h
done: 2026-09-19T08:21:33.409Z
tools: reset-bridge, plugin:claude-mem:mcp-search
skills: house-style
model: Fable (router)
---
# Check status of sales_control_migration_apply_job

Sales Control Migration Apply Job — Status, 19 Sep 2026

**Verdict: deliberately held. Not stalled. Not awaiting a manual run.**

**Live state (reset_system_health, live D1)**
- `sales_control_migration_dry_run_job`: complete, 12:02 AWST 19 Sep.
- `sales_control_migration_apply_job`: pending, updated 0 ms. The row has never been touched since migration 0032 seeded it at 11:44 AWST.
- Cron liveness: UNKNOWN. Ingestion errors, 24h: 0.

**Why it is pending (office memory, obs #1750, #1814, #1832, #1833)**
- Design: two-phase. Dry run is read-only and one-shot. Apply writes to the AI Sales Pipeline board, 20 rows a day, and is gated by `sales_control_migration_apply_enabled` (default off, director-only).
- Director decision, 19 Sep: bulk historical migration rejected. Fresh discovery replaces it.
- Deployed 12:32 AWST, Worker version 9002deca: the apply path was removed from the scheduled handler. It cannot run even if the flag is switched on.
- Dry-run evidence kept for audit: 963 rows judged, 823 eligible, 118 needs-review, 21 stop, 1 suppressed (source: obs #1833).

**What the bridge could not show**
- The `apply_enabled` flag row is not in the health view. Off is per the deploy record, not re-read live today.
- AI Sales Pipeline board read failed (gateway 404). Not needed for this verdict.

**Recommended action**
1. Do nothing to the job. Leave it pending.
2. Optional tidy-up for the owner to approve: set the row value to "retired" so health views stop reading it as work-in-waiting. This is a production D1 write; prepared, not done.
3. If the director later wants selective reactivation, the 118 needs-review decisions are queryable in `sales_control_migration_decisions`.

**CEO inspect (ran first, run b399c37e):** held, live actions off, 2 of 7 components available, 5 unavailable. Per-component names still not exposed.

Used: reset-bridge — reset_run_agent (ceo), reset_system_health, reset_agent_runs, reset_department_status, reset_recent_activity, reset_ceo_priorities; claude-mem — searched and read migration observations.
Skill: house-style

---
Read: [[2026-09-18 run-full-revenue-pipeline-system-status-check]] · [[2026-09-18 clear-held-calls-in-dialpad-review-queue-and-route-to-sales]] · [[2026-09-19 audit-gmail-signals-backlog-confirm-kill-switch-before-wave-]] · [[2026-09-19 confirm-director-decision-on-outbound-kill-switch-state]] · [[MOC-Operations]]
