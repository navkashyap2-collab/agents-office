---
agent: FOLLOW-UP, REACTIVATION & WIN-BA
department: EMAILS
task: mubxwzfa67b3
done: 2026-09-22T00:34:17.156Z
tools: reset-bridge
skills: client-reply, house-style, followup-reactivation-winback
model: Fable (router)
---
# Send Wave 1 follow-up nudge: Sterling & Accumulate

Wave 1 follow-up nudge — Sterling Taxation Services and Accumulate Accountants + Business Advisors, 22 Sep 2026

**Case + reason**
- Sterling (Colin Simcock, reactivation cohort) and Accumulate (Greg Mawer, cold cohort): scheduled follow-up. Both Wave 1 emails were sent 15 Sep 2026, no reply logged, and the 7-day deadline passed at 08:18 AWST today.
- Safety check: neither appears on the monday.com protection register (8 records) or the suppression list. Neither is a current client. No opt-out found.

**Sequencing note — read before release**
- Gmail shows a second in-thread touch already went to both on 18 Sep 2026 ("I'm following up as promised", "wanted to make this follow-up more useful"). The outbox does not record it. So this nudge is touch 3, not touch 2, four days after the last one.
- Recommendation: hold these to 25 Sep 2026 (assumed), or route Sterling to a VA call since Colin's prior contact was by phone. If neither lands, close the file. No touch 4.

**Draft 1 — Sterling** (reply in thread, from director@resetcommercial.com.au)
Subject: Re: Following up as discussed — Reset Commercial Cleaning

Hi Colin,

You suggested we check back around now, so this is my last note on it.

If the timing has moved, tell me a month and I'll come back then. If a comparison is useful, a 20-minute walkthrough is all we need to give you a fixed monthly figure for the Perth office.

Reply with a day that suits, or "not now" and I'll stop here.

Nav

**Draft 2 — Accumulate** (reply in thread)
Subject: Re: Commercial cleaning for Accumulate, Applecross

Hi Greg,

Last note from me on this. I emailed on 15 Sep 2026 about recurring cleaning for the Applecross office.

If it's useful, we can walk the office in 20 minutes and give you a fixed monthly price. No obligation.

If cleaning is covered, reply "no thanks" and I'll close the file.

Nav

**Compliance**: real sender identity, in-thread subject, plain opt-out line, no pricing claims. Kill switch is OFF — a released draft will send.

**reset_run_agent("followup")**: blocked — "Requires a specific due follow-up record — not available on demand."

**Held, not sent.** Prepared for director release.

Used: reset-bridge — reset_wave1, reset_outbox, reset_suppression_status, reset_monday_protection, reset_department_status, reset_recent_activity, reset_gmail_search/message, reset_run_agent.
Skill: followup-reactivation-winback, house-style

---
Read: [[2026-09-18 check-pipeline-via-reset-bridge-and-draft-proposal-if-ready]] · [[2026-09-18 check-outbox-for-follow-up-emails-needing-compliance-review]] · [[2026-09-18 check-reset-bridge-activity-for-a-case-study-ready-job]] · [[2026-09-18 check-reset-bridge-activity-for-gbp-local-search-updates]] · [[MOC-Emails]]
