# Reset Commercial Cleaning — Index

Start here, then follow a link to the department your task touches.

## Departments
- [[50-Emails/MOC-Emails]]
- [[60-Sales/MOC-Sales]]
- [[40-Marketing/MOC-Marketing]]
- [[90-Operations/MOC-Operations]]
- [[80-Finance/MOC-Finance]]
- [[70-Delivery/MOC-Delivery]]

## Reference
- [[90-Operations/safety-and-suppression]] — read before any task that touches a real prospect or client
- [[90-Operations/reset-production-system]] — what Reset's existing Cloudflare Worker already does, and what it doesn't yet
- [[90-Operations/agents-office-system-status]] — the authoritative current-state handoff for this office itself: verified 35/35 workers, 6/6 leads, integrations (monday.com/Gmail/Calendar/D1/Dialpad), model routing, tests, concurrency, safety boundaries
- [[60-Sales/va-roster]] — the human VAs who make real calls

## What's genuinely known vs. not yet known

Reset's production system tracks real prospects, real call outcomes, and real email activity in its own database. This brain does not duplicate that data — a desk that needs current pipeline numbers should say so honestly rather than estimate, per `../CLAUDE.md`.

**On revenue — read this carefully before ever answering a question about it.** Two separate facts, not one:
1. `revenue_events` (Reset's own D1 revenue ledger) has no rows and its migration isn't even applied to production yet — the ledger genuinely has no data. This is a real, current gap in the *system*, not evidence about the *business*.
2. Reset **does** have a real, director-confirmed won/current client: **Advanced Perth Removals**, tracked in monday.com (master item `2856099164`, protection-register item `2857736409`). It simply isn't reflected in the D1 ledger yet.

Never say "Reset has never won a client" or imply zero revenue — that's false. Say instead: "the D1 revenue ledger has no data; Reset's monday.com CRM records at least one real won client, Advanced Perth Removals, but a monthly revenue figure isn't available from any authoritative source this office can read." Never invent a dollar figure for that or any other client — no authoritative source in reach of this office contains one.
