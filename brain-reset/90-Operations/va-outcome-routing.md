---
department: ops
---
# VA Call Outcome → Next Action — read before touching any prospect a VA has already contacted

Reset's production system enforces this **in code** (`src/va-outcome-routing.ts` in the Reset repo, `routeOutcome`/`mustStopActiveWork`), not in an LLM's judgment. This brain note is the same rule in policy. If you (any desk, or the CEO) are about to call, email, follow up, or prepare a proposal/pricing/opportunity step for a prospect who already has a real Sales Control row, you defer to that row's real Call Outcome / Sales Stage / Lead Quality / Email Status — never your own read of "seems worth trying again."

**Audited live 19 September 2026**: 6 real Sales Control items (including Giles Partners Chartered Accountants, item 2856326099) were found still carrying an active Task Type or Sales Stage despite a real, VA-recorded terminal Call Outcome — a live gap this rule and its code closes going forward. No production record was changed by that audit.

## The real column values and what each one means

Real values on the live Reset Sales Control board (5031212274), as read via `reset_monday_sales_control` — never invent a value not in this list; an unrecognised one is a signal to escalate, not to guess.

| Real value | Field | Verdict | What happens next |
|---|---|---|---|
| `Not Interested` | Call Outcome | **Stop** | All active calling, email, follow-up and opportunity work for this prospect stops immediately. No automatic reactivation — this is not a "try again later" outcome. |
| `Wrong Number` | Call Outcome | **Stop** | Same as above — the number on file is wrong; nothing further happens until someone corrects it and starts fresh. |
| `Lost / Not Fit` | Sales Stage | **Stop** | Already resolved as a decline elsewhere in the pipeline. |
| `Won` | Sales Stage | **Stop** | This is now a client, not a prospect — never re-approach as cold outreach. |
| `Do Not Contact` | Lead Quality | **Stop** | Explicit instruction; permanent. |
| `Existing / Duplicate` | Lead Quality | **Stop** | Already a client or already elsewhere in the pipeline under another record — this row is not the real one to act on. |
| `Has Cleaner` | Call Outcome | **Stop now, reactivation-eligible later** | Stops all active work immediately. Becomes eligible for exactly one future reactivation attempt once ≥60 days (configurable) have passed since Last Contact — never sooner, and never automatically before that date. |
| `Future Review` | Sales Stage | **Stop now, reactivation-eligible later** | Same 60-day-minimum reactivation rule as Has Cleaner. |
| `Replied` | Email Status | **Human review, never automatic** | A reply — positive or negative — always goes to a human/email-thread review. Never auto-continue a calling queue or auto-send a follow-up just because a reply exists; the reply itself hasn't been read by an automated decision here. |
| Anything else not in this table | any | **Continue as normal / needs-human-review if genuinely unrecognised** | `No Answer`, `Callback Requested`, `Interested`, `Inspection Requested`, blank/unset, etc. carry on through the normal calling-queue and follow-up logic. A value that doesn't match *any* known real value (a new column option, a typo) is never silently treated as safe — it fails closed to human review. |

## Why "stop" means all four channels, not just calling

A prospect who told a VA "Not Interested" must not then receive a follow-up email, a pricing calculation, a proposal draft, or a walkthrough booking either — the decline is about the business relationship, not the channel it was delivered through. Before this hardening, the automated email-follow-up escalation job could write a fresh "Calling" task back onto a Sales Control row without checking whether a VA had already recorded a decline on it since the email was sent. It now checks the live row first and refuses to escalate if the real outcome says stop (`src/email-followup-escalation-job.ts`).

## What this doesn't change

Current-client protection, personal/relationship suppression, unsubscribe and duplicate checks (see [[safety-and-suppression]]) are a separate, earlier gate and always run first, regardless of anything on the Sales Control board — a clean Call Outcome never overrides a suppression match.

See [[MOC-Sales]] for the wider sales workforce; see the Reset repo's `src/va-task-classifier.ts` for how this feeds the secondary-VA-pool (Dimaka/Josephine) queue specifically.
