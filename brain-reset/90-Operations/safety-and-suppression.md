---
department: ops
---
# Safety and suppression — read before any prospect- or client-facing task

Reset's production system enforces this in code; this brain enforces it in policy. Both rules are the same rule.

## The two protected lists

- **Current clients** — anyone already a paying Reset client is protected from being treated as a cold or reactivation prospect. Checked against Reset's "Current Clients" register.
- **Personal/relationship suppression** — anyone on the director's personal suppression list (existing relationships, referrals, people who asked not to be contacted) is protected the same way.

Reset's production check is **fail-closed**: if the register snapshot is missing, incomplete, or older than 5 minutes, the check denies rather than allows. Any desk preparing prospect contact should apply the same default — if you cannot confirm someone is clear, treat them as held, not clear.

## What "prepare, don't send" means here

Every desk in Emails, Sales and Delivery may draft, research, score, and write its findings to the brain freely. None of them send an email, place a call, book an appointment, or write to the CRM on their own — those actions wait for the owner.

## Unsubscribe / opt-out

Anyone who has asked not to be contacted is suppressed permanently, not just for the current campaign. A follow-up or reactivation task must never re-surface someone who opted out, regardless of how long ago.

## Dormant vs. suppressed

These are different states. A **dormant** opportunity is simply overdue for another look — it's fine to prepare a follow-up. A **suppressed** contact is off-limits entirely. Never treat "we haven't followed up in a while" as license to ignore a suppression flag.
