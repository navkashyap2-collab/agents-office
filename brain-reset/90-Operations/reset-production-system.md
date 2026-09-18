---
department: ops
---
# Reset's existing production system — what's already real

Reset already runs a separate, deterministic Cloudflare Worker (not this office) that has been doing real work since before this office existed. 19 of this office's 35 desks are modelled directly on that system's real, already-built agents — those desks are marked "Reset production agent" below and in each department's MOC. Their job here is to extend that real work with judgement and drafting the original system can't do on its own (it makes no LLM calls at all) — not to duplicate or override it.

## What the production system already does live
- Ingests real Dialpad call data for the VA calling team
- Reads monday.com (Reset's CRM) for prospect and protection-register data
- Sends real cold/reactivation outreach emails, under a hard 20/day cap and an explicit human release-for-send step per email
- Runs a net-new prospect discovery pipeline (capped, monday.com-write, autonomous within its cap)
- Tracks a Wave 1 pilot cohort of director-approved real prospects (see `60-Sales/moc.md`)

## What it does not yet do
- The D1 `revenue_events` ledger has no rows and its migration isn't applied to production — that's a gap in this *system's records*, not proof Reset has no clients. Reset's monday.com CRM has a real, director-confirmed won client (Advanced Perth Removals) this ledger just doesn't reflect yet. See `../00-Meta/index.md` for the exact wording to use.
- No invoicing, accounts payable, or reconciliation exists
- No content/marketing automation exists
- Nothing tracks existing-client retention, quality, or renewal — the production system is 100% new-business acquisition today

That second list is exactly where this office's 16 new desks earn their keep — they cover ground Reset's production system was never built to cover, rather than re-doing what it already does well.
