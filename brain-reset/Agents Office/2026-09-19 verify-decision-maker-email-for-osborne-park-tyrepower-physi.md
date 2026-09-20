---
agent: DECISION-MAKER ENRICHMENT
department: SALES
task: mu7ntk0p31ct
done: 2026-09-19T00:40:30.105Z
tools: reset-bridge, web fetch, web search
skills: house-style
model: Sonnet (router)
---
# Verify decision-maker email for Osborne Park Tyrepower & PhysioLogix

# Decision-Maker Email Verification — Osborne Park Tyrepower & PhysioLogix, 19 Sep 2026

**reset_run_agent (decision-maker):** blocked (runId 43d7f200). Real reason: needs live monday.com prospect and protection-register data. This tool has no monday.com credentials, so production verification did not run. Used reset-bridge's on-file records plus web research instead.

**Suppression check:** neither business is on the protection/duplicate register (reset_suppression_status shows only Strata Asset Services WA, unrelated).

**Osborne Park Tyrepower** — On file: Bryn Sawford, Owner/Operator, phone confirmed, no verified email. Checked the business's own site (osborneparktyrepower.com.au) and the Tyrepower franchise page: no email published on either. A search result surfaced "[email protected]" — a placeholder artifact, not a real address. No verifiable email found.

**PhysioLogix** — On file: Vincent Harvey, Principal Physiotherapist & Owner, phone confirmed, no verified email. Checked myphysiologix.com.au and its team page: no email published. A search turned up a masked email for a "Vincent Harvey" at BPC Physiotherapy, Malaga — a different clinic and likely a different person (common name). Not used; would risk misattribution. No verifiable email found.

**Name and title only — not verified authority.** Both records give a name and role from public sourcing. Neither has been phone-confirmed as the actual cleaning-purchase decision-maker.

**Flag: both prospects still lack a verifiable email.** No registry write performed — this tool has no monday.com write access. Recommend the VA ask for a direct email on the next call (Bianca Maduforo — Osborne Park Tyrepower; Olosho Ifeoluwa — PhysioLogix), then log it manually to Sales Control.

Skill: house-style.
Used: reset-bridge (reset_run_agent, reset_department_status, reset_recent_activity, reset_decision_makers, reset_suppression_status, reset_monday_sales_control) — web search and web fetch for both businesses.

---
Read: [[2026-09-18 verify-decision-makers-for-5-newly-promoted-prospects]] · [[2026-09-18 rank-vetted-prospects-to-prioritize-this-week-s-first-contac]] · [[2026-09-18 verify-decision-maker-for-crane-worldwide-lwp-logistics]] · [[2026-09-18 set-phone-first-email-next-step-for-6-new-prospects]] · [[MOC-Sales]]
