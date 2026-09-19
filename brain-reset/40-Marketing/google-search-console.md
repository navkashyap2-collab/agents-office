---
department: marketing
---
# Google Search Console — real search performance data, read-only

Built 19 September 2026, on the same Google Cloud project/OAuth client Reset already uses for Gmail/Calendar (`308608062354-...`) — no new credentials, no new project. Google Search Console is verified for `https://resetcommercial.com.au/` and the Search Console API is enabled in that project.

**Status right now: code built and deployed, but not yet live.** The actual OAuth consent (a director-only browser step, `docs/google-search-console-oauth-setup.md` in the Reset repo) hasn't happened yet, so `GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN` doesn't exist as a secret. Until it does, every read below returns a `503 search-console-not-configured` — that is the honest, correct behaviour, not a bug. Check `reset_system_health` for `google_search_console_verify_job`: `secret-required` means still waiting on the director; `complete` means real data has been pulled and verified.

## What this is, once connected

A third, fully isolated Google OAuth grant — `webmasters.readonly` only, on its own refresh token, structurally unable to combine with the Gmail read grant or the Gmail send grant (same isolation principle as [[../90-Operations/reset-ai-sales-pipeline|the AI Sales Pipeline's]] separate boards). Read-only end to end: no site edits, no GBP posts, no review replies, no publishing capability exists anywhere in this stack — by construction, not by policy alone.

Real tools once live:
- `reset_search_console` — real search queries/pages for `resetcommercial.com.au` with clicks, impressions, CTR and average position, over a real date window (default: 28 days ending 3 days ago, since Search Console data itself lags a few real days).
- `reset_search_console_inspect` — real indexing verdict for one specific real URL on the site.

Feeds into the CEO's own reasoning too: `ceo/signals.mjs`'s `views.searchConsole` and the Command Centre's `departments.marketing` (`SEARCH_CONSOLE_CLICKS`, `SEARCH_CONSOLE_IMPRESSIONS`, `SEARCH_CONSOLE_TOP_QUERIES`) are both wired to the same real source — the first authoritative marketing data source Reset has had.

## Guardrails

- Never report a Search Console number without pulling it live through these tools — a stale/remembered figure is not real data.
- No stat is ever invented if the tools return no data (or a genuinely empty result) — say so plainly, same rule as everywhere else in this Brain.
- If asked to "post," "reply to a review," "edit the listing," or anything else that would write to Google Business Profile or the website, that capability does not exist here — say so and escalate, never improvise a workaround.

See [[MOC-Marketing]] and [[../90-Operations/safety-and-suppression]].
