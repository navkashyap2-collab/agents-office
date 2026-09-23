---
agent: SALES PIPELINE LEAD
department: SALES
task: muby4y0pa6by
done: 2026-09-22T00:40:58.563Z
tools: reset-bridge
skills: house-style
model: Sonnet (router)
---
# Investigate duplicate 'Info as requested' emails to Contour Interiors

Duplicate 'Info as requested' Emails — Contour Interiors Perth, 21 Sep 2026

**Confirmed: two real sends, not a display glitch**
Outbox record (item 2863352594, Contour Interiors Perth) shows two completed "Info as requested — Reset Commercial Cleaning" emails to perth@contourinteriors.com.au, both 21 Sep 2026: ~12:37 AWST and ~13:23 AWST, 45 minutes apart (assumed timezone, consistent with prior AWST-dated notes). Gmail search confirms two distinct message ids in that thread.

**Root cause: two trigger paths, not a loop**
The two outbox rows carry different idempotency keys:
- `ai-sales-pipeline-email-requested:2863352594`
- `ai-sales-pipeline-auto:email-requested:2863352594`

Same content fired twice because two separate triggers — a direct "email requested" release and a separate "auto" pipeline trigger — both responded to the same VA call outcome ("Email Requested") on this item. Each path deduplicates against its own key, so neither saw the other's send. This is a trigger-design gap, not a runaway loop: only two sends exist, both complete, no pending or escalated rows for this item.

**No resend currently queued**
Both outbox rows are `state: sent`, `escalationState: none`. No third row exists for this item. Kill switch is OFF (flagged separately, unrelated to this issue).

**Pipeline note is stale, not wrong**
`emailStatus` correctly reads "Follow-up Sent." `nextActionNotes` still reads "Send the requested information email" — left over from before either send, never cleared. Corrected text (for director/ops to apply): *"Follow-up sent 21 Sep 2026 (Contour Interiors requested info). Awaiting reply — no further send needed."*

**Escalating, not editing directly**
`nextActionNotes` is the field the "auto" trigger appears to read. Editing it through an unmediated write path, without confirming how that trigger consumes it, risks firing a third send — the exact failure being investigated. Routing the trigger-dedup fix and the note edit to the director/production owner rather than deciding it here.

Used: reset-bridge — department status, recent activity, outbox, AI Sales Pipeline board, Gmail search/signals.
Skill: house-style

---
Read: [[2026-09-18 check-outbox-for-follow-up-emails-needing-compliance-review]] · [[2026-09-19 confirm-director-decision-on-outbound-kill-switch-state]] · [[2026-09-18 verify-outbound-email-kill-switch-state-before-wave-1-releas]] · [[2026-09-22 send-wave-1-follow-up-nudge-sterling-accumulate]] · [[MOC-Sales]]
