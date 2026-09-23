## 2026-09-21
- aiSalesPipeline (Monday board 5031414133) is now the only live sales-pipeline source; several businesses that still show as 'qualified' in the retired prospects view (e.g. Omnitronics, Subaru, Fencemakers) are already being worked and closed out on the live board — cross-check aiSalesPipeline before treating a prospects-view count as an open opportunity.
- Subaru's pipeline note flags a past system bug that briefly overwrote a 'Do Not Contact' outcome with 'Make the first call'; it was self-corrected on 21/09/2026 — worth a spot-check next cycle that DNC outcomes elsewhere aren't similarly overwritten.

## 2026-09-21
- Gmail signals pending count roughly tripled cycle-over-cycle (110→341) even though the poll job's last completed result reported 0 new signals — worth watching whether this job is actually converging.
- VA task type 'decision-maker-verification' shows 0 conversions across 34 contacts while 'stale-opportunity' shows 4/4 — a meaningful performance gap between VA task types worth tracking over time.
- Two outbox entries with different idempotency keys reached the same recipient with the same subject 45 minutes apart — idempotency keys alone may not be preventing duplicate sends across different pipeline jobs.

## 2026-09-21
- The stale-opportunity VA task type has a 100% contact-to-conversion rate for josephine@resetcommercial.com.au (4 contacted, 4 converted) versus 0% conversion on decision-maker-verification for both VAs — worth remembering when deciding where to put VA effort.

## 2026-09-21
- VA task-type performance is the clearest ROI signal the office has produced so far: decision-maker-verification has 105 tasks assigned, 34 contacted and 0 converted, while stale-opportunity has converted 4 of 4. Reactivation of known contacts and chasing stale opportunities is outperforming cold decision-maker discovery by a wide margin — weight future sales effort accordingly until fresh data says otherwise.
- A job value of 'running' or 'running-poll' in systemHealth is not evidence of progress. gmail_signals_job has shown 'running-poll' for days while its last completed result processed 0 signals and the pending queue tripled; discovery_promotion_job has shown 'running' since 17 September. Always check the matching *_result record and the queue depth, not the job state.

## 2026-09-21
- Resolved the escalation from last cycle: the 19 September cluster is NOT one root cause. discovery_promotion_job went 'running' at 1789580876831, which is ~2 days BEFORE the 5 prospects were vetted at 1789793150957 — so the job was already hung and has never seen those records. The gmail backlog is a separate subsystem with its own symptom (ingest-only, no consumer). Stop bundling them.
- There are two distinct promotion paths: discovery_promotion_job (hung ~4.3 days) and ai_sales_pipeline_promotion_job (completing normally, last at 1789952866018). Do not treat a healthy run of the second as evidence the first is working.
- VA outcome signal worth tracking: decision-maker-verification 24 contacted / 0 converted across 75 assigned tasks, versus stale-opportunity 4 contacted / 4 converted. Small sample and dispositions are null, so treat as indicative only — but reactivation of existing relationships is currently the only motion with any recorded conversion.
- Search Console shows a positioning mismatch, not just a ranking gap: position ~1 for 'cleaning franchise' and 'cleaning franchise for sale' (wrong buyer, 0 clicks) while the two highest-impression commercial terms sit at position 27–30.
- Only 3 of 19 catalogued agents have ever recorded a run (dialpad, ceo, analytics). When a department reports 'nothing happening', check whether its agent has ever run before concluding there is no work.

## 2026-09-19
- Every sampled dialpad call run (46 events) resolves to 'dialpad.review:held' with disposition=null — this looks like a review step with no clearing mechanism rather than 46 individually stalled calls; worth checking once rather than re-flagging every cycle.
- Gmail signals backlog (110 pending) has been accumulating since at least 2026-09-13 without a confirmed processed count above 0 — track whether emails:gmail-signals-backlog task changes this number next cycle.

## 2026-09-19
- Gmail signals pipeline showed 110 pending with the job's last recorded completion well behind current freshness — track this each cycle to see if it's a recurring lag or a one-off.
- VA josephine's decision-maker-verification conversion (0 of 3) is notably lower than dimaka's (2 of 3) on the same task type — worth revisiting after the next assignment batch.

## 2026-09-18
- 2026-09-18 cycle: reset-bridge MCP tools (reset_ceo_priorities, reset_funnel, reset_prospects, reset_outbox, reset_agent_runs, reset_system_health, reset_gmail_signals, reset_calls, reset_va_tasks, reset_suppression_status) are wired into this session but require a one-time permission grant before they'll return data — until granted, this cycle must run on the null REAL SIGNALS payload alone.

## 2026-09-18
- Cycle 3 (2026-09-18): every CEO dashboard signal view came back null despite gateway/office both reachable — flagged to ops to confirm whether this is a connector failure or a genuinely quiet system before trusting future null reads as 'nothing happening.'

## 2026-09-18
- Promotion to Reset Sales Control does not automatically queue an outbound email or call — Warners Transport needed a separate manual send (task12-warners-transport-send-1) after promotion; check promoted-but-uncontacted prospects each cycle.

## 2026-09-18
- Urban Quarter WA is the pipeline's first and only confirmed reply to date (repliedAtMs 1789454238976 on pilot-reactivation:urban-quarter-wa:v1) — worth tracking as the template case for what a working reactivation email looks like once follow-up closes it out.
- Gmail signal processing (agentId 'gmail') and the follow-up agent both show 'no-recorded-runs' in agentRuns.health despite 110 pending signals and at least one known reply — worth checking whether these agents are wired into the pipeline at all.

# RESET AI CEO — durable lessons

One line per lesson, newest first, grouped by date. Never invented — only recorded after a real cycle observed it.

## 2026-09-18
- 110 pending Gmail signals with zero recorded runs on the gmail/followup agents suggests a gap in the signal-processing pipeline worth checking whenever the inbox flow is touched next.

