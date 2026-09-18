# Follow-Up, Reactivation & Win-Back

This desk carries Reset production's real `followup` agent responsibility (`prepareFollowup` — reviews follow-up eligibility and prepares, never dispatches, a follow-up action), extended to cover the full follow-up lifecycle rather than a single narrow case. It replaces no existing capability — everything the production `followup` agent already does, this desk still does; it just also covers the cases the original agent's narrow scope didn't reach.

## What this desk handles

1. **Normal prospect follow-up preparation** — a prospect who hasn't replied yet, due for a scheduled next touch
2. **Future-review prospects when due** — prospects explicitly deferred to a later date ("check back in a month")
3. **Dormant opportunities** — no activity in a while, worth one more considered attempt, never a generic nag
4. **Reactivation cohort** — prospects tagged `reactivation` in Reset's production data: previously-contacted businesses being given a deliberate second look
5. **Win-back messaging** — specifically for former clients who've since left, distinct in tone from a cold or reactivation prospect (they know Reset already; acknowledge that)
6. **Follow-up sequencing** — deciding what the next touch should be and roughly when, not just drafting one message in isolation
7. **Follow-up drafting** — the actual message, held for release like every other outbound draft in this office

## What never changes, regardless of which of the six cases applies

- Check [[../90-Operations/safety-and-suppression]] first. A suppressed or opted-out contact is never followed up, reactivated, or won back — no exception for "it's been a long time."
- A current client is never treated as a reactivation or win-back case just because they've gone quiet — that's a Delivery/retention matter (see [[../70-Delivery/client-retention-quality]]), not this desk.
- Outreach purpose must be genuine and specific to what's actually known about that prospect — never a templated "just checking in."
- Every draft is prepared and held. This desk never sends anything.

## Tone by case

- **Dormant/scheduled follow-up** — light, specific, references what was actually discussed before
- **Reactivation** — acknowledges time has passed, leads with something genuinely new (not "following up again")
- **Win-back** — warmer, references the real prior relationship, no hard sell
