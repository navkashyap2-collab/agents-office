---
agent: FOLLOW-UP, REACTIVATION & WIN-BA
department: EMAILS
task: muchjlnh6cfq
done: 2026-09-22T09:44:24.251Z
tools: reset-bridge
skills: client-reply, house-style, followup-reactivation-winback
model: Sonnet (router)
---
# Audit Gmail signals queue stuck in pending vs running-poll

# Gmail Signals Queue Audit — 383 Pending vs "running-poll", 22 Sep 2026

**The number**: `reset_department_status`/`reset_gmail_signals` confirm **383 pending, 0 processed** — up from 352 at this morning's 00:37 check, 110 on 19 Sep. Still climbing, not frozen.

**Poll vs process — two different things, only one is alive**
The "running-poll" state is real, not a false positive: `reset_recent_activity` shows a fresh burst of 9 new signals discovered at 14:50 today, so the discovery job is actively finding new mail. But `reset_agent_runs` shows the `gmail` classification agent at **no-recorded-runs, 0 events processed — ever**, unchanged from the 19/22 Sep audits. There is no downstream processor. Every signal the poll finds lands at "pending" permanently. Poll alive, classifier dead — that's the real state, not a guess.

**Backlog composition** (sampled the 25 most recent rows + a live 1-day mailbox check)
- 23 of 25 recent rows are one thread (`1a0c7d976e0ceb8e`): Reset's own outbound supplier correspondence with Clark Rubber Balcatta re: cleaning supplies — misfiled as signals, confirms per-message not per-thread signaling still inflating counts.
- 1 row: inbound Clark Rubber tax invoice — vendor noise, not a prospect/client signal.
- Live `newer_than:1d` search surfaces 4 messages not yet in the queue at all — backlog undercounts current activity again, same pattern as 18/22 Sep. One is genuine: **Fremantle Foundation Admin (Natalie Sheridan)** replied today to a cleaning proposal — "let me speak to the higher ups and get back to you." Checked against both suppression registers — no match, though "Fremantle Chamber of Commerce" sits on the protection register at the same 16 Phillimore Street address (different name — flag, not block).

**`reset_run_agent("followup")`: blocked.** Real reason returned: "Requires a specific due follow-up record — not available on demand." No due record surfaced today beyond Fremantle Foundation, which is a live sales reply, not yet a due follow-up.

**Routing**: classifier gap → Ops/engineering, not desk-fixable. Fremantle Foundation reply → Prospect & Client Replies to action now; this desk revisits it if it goes quiet past a review date. No draft prepared — outside this audit's scope.

Skill: house-style (diagnostic audit, not a re-contact draft — followup-reactivation-winback's safety-gating step applied, six-case sequencing not applicable here).
Used: reset-bridge — reset_gmail_signals, reset_department_status, reset_recent_activity, reset_agent_runs, reset_run_agent, reset_ceo_priorities, reset_outbox, reset_gmail_search, reset_gmail_message, reset_suppression_status, reset_monday_suppression.

---
Read: [[2026-09-19 audit-gmail-signals-backlog-confirm-kill-switch-before-wave-]] · [[2026-09-22 triage-352-pending-gmail-signals-and-classify-backlog]] · [[2026-09-18 triage-110-pending-gmail-signals-for-unactioned-replies-boun]] · [[2026-09-22 triage-gmail-signals-backlog-and-diagnose-stall]] · [[MOC-Emails]]
