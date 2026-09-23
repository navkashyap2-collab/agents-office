---
agent: EMAILS LEAD
department: EMAILS
task: mubxz0kw6fy9
done: 2026-09-22T00:37:02.172Z
tools: reset-bridge
skills: client-reply, house-style
model: Sonnet (router)
---
# Triage Gmail signals backlog and diagnose stall

# Gmail Signals Backlog — Triage & Stall Diagnosis, 22 Sep 2026

## The number
`reset_department_status`: **352 pending**, 0 processed. Up from 110 on 19 Sep — roughly **+80/day** for three straight days. `reset_ceo_priorities`: kill switch still OFF, 2 items still awaiting owner approval, unchanged.

## Why it never clears — two root causes, both infra, not desk-actionable
1. **Classification never runs.** `reset_agent_runs`: the `gmail` agent shows `no-recorded-runs`, 0 events processed — ever. Signals get discovered by `gmail_signals_job` (alive, polling, last completed run found 0 new) but nothing downstream marks any of them processed. `reset_run_agent("gmail")` stays blocked on missing Google credentials. Every signal is permanently stuck at "pending."
2. **Ingestion is indiscriminate.** Sampled 14 of the newest signals via `reset_gmail_message`: 4 were newsletter/platform noise (LinkedIn x2, Apollo, Google Analytics), **8 were Reset's own sent mail** (Bianca's cold-outreach follow-ups, Nav's replies to Nancy Arimborgo/Sharna/Grace) getting signaled as if inbound, and only **2 were genuine unactioned inbound**. Also found duplicate rows: one thread produced 4 separate signal rows, another 6 — the pipeline signals per-message, not per-thread, inflating the count further.

## The 2 real items found (checked against `reset_suppression_status` and `reset_monday_suppression` — no match, clear to route)
- **Maria Arasi, Easy Living Homes Malaga** — sent signed form back, 21 Sep. → **Client Care & Support** (existing client, onboarding paperwork).
- **Janelle Shanahan, Silk Hospitality** — "Who did you speak to please?" on an active prospect thread, 21 Sep. → **Prospect & Client Replies**.

Note: your plan named desks "cmail/vmail/kmail" — those don't match any desk in `MOC-Emails`. Routed to the real desks above instead.

## Clearance plan
- **Ops/engineering** (can't be fixed from Emails): restore Gmail creds so `reset_run_agent("gmail")` runs and actually clears signals; filter the ingestion job to inbound-only (exclude director's Sent folder and known noise domains); dedupe to one signal per thread.
- **Emails desk, meanwhile**: keep manual sampling (as done 18/19 Sep) — but backlog grows faster than sampling covers it, so this is containment, not a fix.

Used: reset-bridge — `reset_department_status`, `reset_recent_activity`, `reset_gmail_signals`, `reset_system_health`, `reset_agent_runs`, `reset_gmail_search`, `reset_gmail_message` (x14), `reset_suppression_status`, `reset_monday_suppression`.

---
Read: [[2026-09-18 triage-110-pending-gmail-signals-for-unactioned-replies-boun]] · [[2026-09-19 diagnose-stalled-gmail-signal-pipeline-and-triage-110-pendin]] · [[2026-09-19 triage-110-gmail-signals-for-real-prospect-replies]] · [[2026-09-19 audit-gmail-signals-backlog-confirm-kill-switch-before-wave-]] · [[MOC-Emails]]
