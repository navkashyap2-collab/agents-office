---
agent: FOLLOW-UP, REACTIVATION & WIN-BA
department: EMAILS
task: muc0bkxp8s71
done: 2026-09-22T01:41:06.040Z
tools: reset-bridge
skills: client-reply, house-style, followup-reactivation-winback
model: Fable (router)
---
# Draft follow-up emails for Accumulate & Sterling (deadline passed)

Follow-up drafts — Accumulate and Sterling, 22 Sep 2026

**Case + reason**
- Both: scheduled follow-up. Wave 1 sent 15 Sep 2026 from director@resetcommercial.com.au. Outbox shows repliedAt null for both; follow-up deadline passed 08:18 AWST today. No inbound from either address in 14 days.
- Sterling (Colin Simcock): reactivation cohort — he asked us to check back around now.
- Accumulate (Greg Mawer): cold cohort — first outreach.
- Safety: neither is on the suppression view (Steel Blue, Strata Asset Services only), neither is a current client, no opt-out on record.

**Sequencing note**
- Gmail shows a second in-thread touch already went to both on 18 Sep 2026 at 13:15 AWST, not logged in the outbox. This is touch 3 for each. Release no earlier than 25 Sep 2026 (assumed) to keep a 7-day gap. If no reply, close both files — no touch 4. Sterling could go to a VA call instead, since Colin's original contact was by phone.
- Kill switch is OFF. Released items send within minutes. Director to confirm before release.

**Draft 1 — Sterling** (reply in thread)
Subject: Re: Following up as discussed — Reset Commercial Cleaning

Hi Colin,

You asked us to check back around now. This is my last note on it.

If the timing has moved, tell me a month and I will come back then. If you would like to compare your current arrangement, a 20-minute walkthrough is all we need to give you a fixed monthly figure.

Reply with a day that suits, or "not now" and I will stop here.

Nav

**Draft 2 — Accumulate** (reply in thread)
Subject: Re: Commercial cleaning for Accumulate, Applecross

Hi Greg,

I wrote on 15 Sep about recurring cleaning for the Applecross office. I have not heard back, which usually means the timing is off or you are covered.

Either is fine. If a quote is ever useful, one short site visit gives you a fixed monthly figure with no obligation.

If you would rather I stop, reply "no thanks" and I will close the file.

Nav

**Held, not sent** — both drafts prepared and held for Follow-Up Compliance Reviewer, then director release.

Used: reset-bridge — reset_run_agent("followup") returned blocked ("Requires a specific due follow-up record — not available on demand"); reset_outbox, reset_gmail_search/message, reset_suppression_status, reset_ceo_priorities, reset_department_status, reset_recent_activity.
Skill: followup-reactivation-winback, client-reply, house-style

---
Read: [[2026-09-22 send-wave-1-follow-up-nudge-sterling-accumulate]] · [[2026-09-19 confirm-director-decision-on-outbound-kill-switch-state]] · [[2026-09-18 assess-outbound-kill-switch-status-before-any-release]] · [[2026-09-18 check-outbox-for-follow-up-emails-needing-compliance-review]] · [[MOC-Emails]]
