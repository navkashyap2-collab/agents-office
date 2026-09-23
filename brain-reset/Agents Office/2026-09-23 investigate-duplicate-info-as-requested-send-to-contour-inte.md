---
agent: FOLLOW-UP COMPLIANCE REVIEWER
department: EMAILS
task: mudfkm95nl7p
done: 2026-09-23T01:35:54.861Z
tools: reset-bridge
skills: client-reply, house-style
model: Sonnet (router)
---
# Investigate duplicate 'Info as requested' send to Contour Interiors

# Duplicate Send Investigation — Contour Interiors Perth, 23 Sep 2026

**Confirmed: two real sends, one item, two idempotency keys**
Outbox item 2863352594 (Contour Interiors Perth, perth@contourinteriors.com.au) has two `sent` rows, both subject "Info as requested — Reset Commercial Cleaning", both from director@resetcommercial.com.au:
- `ai-sales-pipeline-email-requested:2863352594` — created 1789965493034, completed 1789965503188 (21 Sep 2026, ~12:38 AWST, assumed UTC+8)
- `ai-sales-pipeline-auto:email-requested:2863352594` — created 1789968194771, completed 1789968219252 (21 Sep 2026, ~13:23 AWST)

Gap between completions: 2,716,064 ms ≈ 45 minutes. Matches the reported gap.

**Root cause: two trigger paths, separate idempotency namespaces**
Both keys respond to the same VA call outcome, "Email Requested," on this item. `ai-sales-pipeline-email-requested:` is a direct release trigger; `ai-sales-pipeline-auto:email-requested:` is a separate automated pipeline trigger. Each deduplicates only against its own key prefix, so the second trigger had no way to see the first had already sent. This is a trigger-design gap, not a resend loop: only two rows exist for this item, both `state: sent`, `escalationState: none`, no third or pending row.

**Yes — the automated send trigger duplicates outbound emails** when two trigger paths can both fire off one call outcome without a shared dedup key.

**Pipeline record still stale, unresolved from 22 Sep**
`emailStatus` correctly reads "Follow-up Sent." `nextActionNotes` still reads "Send the requested information email" — one day after this was flagged and a corrected text was ready to apply.

**Fix, unchanged from prior review:** merge both trigger paths onto one shared idempotency key per item+outcome (e.g. `ai-sales-pipeline:email-requested:<itemId>`), or have the auto trigger check the direct trigger's key before firing.

Used: reset-bridge — reset_department_status, reset_recent_activity, reset_outbox, reset_monday_ai_sales_pipeline.
Skill: house-style.

---
Read: [[2026-09-22 investigate-duplicate-info-as-requested-emails-to-contour-in]] · [[2026-09-22 verify-contour-interiors-duplicate-send-fix-pipeline-record]] · [[2026-09-18 check-outbox-for-follow-up-emails-needing-compliance-review]] · [[2026-09-18 verify-outbound-email-kill-switch-state-before-wave-1-releas]] · [[MOC-Emails]]
