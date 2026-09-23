---
agent: OPERATIONS LEAD
department: OPERATIONS
task: muchcrxtfshx
done: 2026-09-22T09:39:45.740Z
tools: reset-bridge
skills: house-style
model: Sonnet (router)
---
# Diagnose 4 failed Office tasks and sales_control_migration_apply_job status

# Failed Office Tasks & Migration Apply Job — Root Cause, 22 Sep 2026

**ceo.inspect (live, `reset_run_agent`):** status held, live actions disabled. 2 of 7 pipeline components available, 5 unavailable — aggregate counts only, no per-component names returned.

**On the "4 failed Office tasks"**
I checked every failure surface the bridge exposes and none produces a set of 4:
- Agent run health (`reset_agent_runs`): 0 runs in a "failed" state. 17 of 19 agents show "no-recorded-runs" (never executed — not the same as failed). Only dialpad has history: 50 events, all "complete".
- System health job states (`reset_system_health`): 1 explicit failure — `google_business_profile_verify_job`, marked `failed`.
- Department status (all 6 checked live): marketing and fin return empty metrics — no data source configured yet, not a failure.
- Outbox (`reset_outbox`): 1 blocked send — Sterling Taxation Services, `escalation-blocked-by-outcome:sales-stage:Future Review`.

That's 1 genuine failure plus 2 "no data" states plus 1 blocked send — no combination is honestly "4 failed Office tasks." I'm not fabricating a matching set. If "Office tasks" refers to a tracker outside this bridge, I have no tool to read it — flagging for the owner to point me at the right source rather than guessing.

**sales_control_migration_apply_job — held, not stuck**
- `sales_control_migration_dry_run_job`: complete. `sales_control_migration_apply_job`: `pending`, `updatedAtMs: 0` — untouched since seeded, unchanged from the last check.
- Gating: `apply_enabled` flag isn't in the live health view (can't re-confirm today). Prior verified finding stands: director rejected bulk historical migration, and the apply path was removed from the scheduled handler in a later deploy — it can't run even if re-enabled.
- The only kill switch visible in `reset_ceo_priorities` is outbound email (OFF) — unrelated to this job.
- Verdict: intentional hold, not a technical stall.

**Recommendation:** get the "4 failed tasks" source named so it can be pulled directly. Leave the apply job pending — no action needed.

Used: reset-bridge — reset_run_agent(ceo), reset_agent_runs, reset_system_health, reset_ceo_priorities, reset_department_status (6 departments), reset_outbox, reset_va_tasks.
Skill: house-style.

---
Read: [[2026-09-19 check-status-of-sales-control-migration-apply-job]] · [[2026-09-18 run-full-revenue-pipeline-system-status-check]] · [[2026-09-22 triage-gmail-signals-backlog-and-diagnose-stall]] · [[lessons]] · [[MOC-Operations]]
