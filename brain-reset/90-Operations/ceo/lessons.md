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

