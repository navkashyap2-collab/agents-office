---
agent: LOCAL SEO & GOOGLE BUSINESS PROF
department: MARKETING
task: mudfpbigkthy
done: 2026-09-23T01:40:11.220Z
tools: reset-bridge
skills: house-style
model: Sonnet (router)
---
# Diagnose and fix Google Business Profile verification job

# GBP Verification Job — Diagnosis, 23 Sep 2026

**Checked:** `reset_system_health`, `reset_agent_runs`, `reset_business_profile`, `reset_business_profile_location`, `reset_department_status` (marketing), `reset_recent_activity`.

**Root cause**
`google_business_profile_verify_job` shows `failed`, last updated at epoch 1789882463079. It has no paired detail record. Compare that to the jobs next to it in the same health log: `google_verify_job` (mail/calendar) and `google_search_console_verify_job` both succeeded and each wrote a companion record with mode, scope, and verified data. `google_business_profile_verify_job` wrote none.

That pattern points to a Business Profile–specific failure, not a broken Google login: the general Google OAuth session works (mail, calendar, Search Console all verified fine). The Business Profile attempt ran about 14.8 hours after Search Console succeeded (53,314,049 ms apart, both real timestamps) and failed before it could return any structured result. That is consistent with one of: the Business Profile API not enabled for this Google Cloud project, the `business.manage` scope never being granted or being denied at consent, or the authenticated Google account not having manager/owner access to the Reset Commercial Cleaning listing. I cannot tell which — the health log gives no error message for this job.

Confirmed live: `reset_business_profile` and `reset_business_profile_location` both return `business-profile-not-yet-verified`. There is no data source yet, matching the standing note.

**Why I stopped here**
Both GBP tools are read-only by design and both require verification to already exist before they'll return anything. No tool available to me can retrigger this job, complete Google OAuth consent, or grant Business Profile API access — that step happens outside this bridge, in the Google account itself.

**Escalating to director:** confirm which Google account should hold the Business Profile grant, and complete OAuth consent for the `business.manage` scope for that listing. I'll re-check `reset_system_health` once that's done.

No review response drafted — no verified data source exists yet to ground one in.

Skill: house-style

---
Read: [[2026-09-22 diagnose-4-failed-office-tasks-and-sales-control-migration-a]] · [[2026-09-18 check-reset-bridge-activity-for-gbp-local-search-updates]] · [[2026-09-18 check-reset-bridge-for-today-s-invoicing-accounts-data]] · [[2026-09-19 pull-live-local-seo-gbp-social-ad-performance-data]] · [[MOC-Marketing]]
