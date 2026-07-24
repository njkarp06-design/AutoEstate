## Session Handoff - 2026-07-24

### Task Overview

Building **AutoEstate**: a productized marketing-automation service for independent real estate agents in Tel Aviv, per [CLAUDE.md](CLAUDE.md) (source of truth — read it first on resume, especially the last few paragraphs of Section 5). This session's explicit goal, picked up from the previous handoff: resume debugging the gateway footer-omission bug rather than leave it as an accepted "known gap." It's now **resolved and merged**, plus two reporting-app UX gaps the user caught by actually using the app were fixed in the same PR.

GitHub repo: https://github.com/njkarp06-design/AutoEstate (private). **Repo is on `main`, clean, up to date with origin. PR #23 is MERGED.** Nothing is pending review.

### Files Modified

**In the git repo, merged to `main` via PR #23** (`feat/listing-footer-reminder-plugin`, branch deleted both locally and remotely post-merge):
- `agent/plugins/listing-footer-reminder/__init__.py` + `plugin.yaml` — new. A `pre_llm_call` hook (same mechanism as `active-listings-context`) that force-injects the exact 7-line "Listing Record" footer format into context on every WhatsApp/Telegram turn, unconditionally (platform-gated only, no keyword gate — see Decisions Made).
- `reporting-app/lib/listings.ts` — `getListings()` now includes each listing's most recent linked `Run` (via the `runs` reverse relation), returning `latestRunId: string | null`.
- `reporting-app/app/listings/listing-list.tsx` — each row is now a real `<Link href="/runs/[id]">` when `latestRunId` exists (falls back to a non-clickable row for the rare mixed-two-listings-in-one-turn case).
- `reporting-app/app/layout.tsx` — added an explicit "Activity" nav link next to "Listings" (previously the only way back to `/` was clicking the logo).

**Outside the git repo** (local machine / live profile state — matters for reproducing or continuing on this machine):
- `~/hermes/profiles/autoestate/memories/USER.md` — edited mid-session to add a footer mention + an explicit "always reload the skill" instruction. **This fix did NOT work** (see Errors Hit) — the edit is still in place (harmless) but the actual fix is the plugin above, not this file. Don't assume this file drives correct behavior.
- `~/hermes/profiles/autoestate/plugins/listing-footer-reminder/` — the plugin manually copied in from the repo (plugins aren't loaded via an `external_dirs` config pointer the way skills are).
- `~/hermes/profiles/autoestate/config.yaml` — `plugins.enabled` now includes `listing-footer-reminder` (alongside the pre-existing `sync-to-webapp`). Note `active-listings-context` (built in PR #19) is still NOT in this list and still not deployed to `~/hermes/profiles/autoestate/plugins/` — a pre-existing, deliberate deferral, not something this session changed.
- The `autoestate` Hermes gateway process was killed and restarted twice this session (once for the memory-edit attempt, once for the plugin) and is currently running normally.
- `~/hermes/profiles/autoestate/.env`'s `ANTHROPIC_API_KEY` **was confirmed dead mid-session** (credit balance too low) — this caused a real live outage (see Errors Hit). **The user topped it up during this session**, so it should be working now, but this is a recurring risk (pay-as-you-go balance, no auto-reload configured) — recommend the user enable Anthropic Console's auto-reload billing setting; not yet confirmed done.
- The reporting-app dev server (port 4127) **was left running** at the end of this session (`http://127.0.0.1:4127` — always use `127.0.0.1`, not `localhost`, unrelated IPv6 collision on this machine). Check `Get-NetTCPConnection -LocalPort 4127` before starting another one — don't create a duplicate/orphaned instance (see PR #17's documented gotcha on this).

### Decisions Made

- **First fix attempt (edit `USER.md` memory) was tried, tested live, and found not to work — don't repeat it.** This was a real, deliberate test of a hypothesis (stale memory → model skips reload), not skipped due to laziness. It failed cleanly, which is what reframed the bug as a tool-call *compliance* gap rather than a stale-fact gap.
- **Fixed via a new plugin instead of fighting model compliance.** `listing-footer-reminder` force-injects the footer format rather than trying to make the model call `skill_view` more reliably — sidesteps the problem rather than re-litigating it.
- **No keyword gate on the new plugin, unlike `active-listings-context`.** Deliberate: this is pure static text with no network-call cost to firing on every turn, and real listing messages are often raw shorthand facts with no predictable trigger phrase — a keyword gate would just recreate the original silent-failure shape (missing the reminder on a genuine listing turn).
- **Listings page rows link to their most recent `Run`, not all related runs.** A `Listing` can have many related `Run`s over time (new listing, later a price-drop update, etc.); linking to the single most recent one is the simplest useful behavior and matches what a user actually wants ("show me the latest posts for this property").

### Errors Hit

1. **First fix attempt failed.** Edited `USER.md`, restarted the gateway, sent a real test listing — still zero tool calls, still no footer. This wasn't a bug in the edit itself; it directly disproved the "stale fact" hypothesis and pointed at a deeper tool-call compliance issue instead. Root-caused via direct SQLite evidence from `state.db`: every fresh CLI test's first action is a `skill_view` call; the real long-lived WhatsApp session called zero tools across every real turn.
2. **A real live outage, caused by my own restart.** Restarting the gateway from a Claude Code tool/agent environment (rather than the user's own interactive shell) lost access to whatever ambient Claude Code OAuth credential the previous process instance had been using as a fallback for the profile's own dead `ANTHROPIC_API_KEY`. Every reply became a generic "credit balance too low" error until the user topped up the real key. Confirmed via `agent.log`: `credential pool: no available entries` + `HTTP 400: credit balance too low`. Resolved by the user topping up the key directly at console.anthropic.com — after that, restarts from any environment worked fine since the real key now works standalone.
3. **The Listings page appeared "unresponsive" to the user** — not a bug, but a real UX gap: PR #21 built it as a pure read-only summary with zero click-through (plain `<li>`, no `Link`). Fixed as described above.
4. **No "Activity" nav link existed** — another real UX gap the user caught, not a bug per se. Fixed by adding one.

### Current State

- **PR #23 merged to `main`.** Local repo on `main`, clean, up to date.
- **The gateway footer-omission bug is resolved and verified live**, not just theoretically fixed: a real WhatsApp test (Ben Gurion Blvd listing) produced the footer and a real `Listing` row confirmed via `/api/listings/active`.
- **The reporting-app dev server is currently running** on port 4127 with real data now visible on `/listings` (at least the Ben Gurion listing; earlier test sends before the dev server was up did not sync).
- **CLAUDE.md is up to date** with the full writeup of this resolution — read it directly if anything here seems inconsistent.
- **Memory updated:** `project_gateway_footer_omission_bug.md` rewritten to reflect the failed first attempt and the actual working fix; `project_listing_memory_digest.md` and `project_marketing_automation_roadmap.md` updated to reflect the roadmap's weekly-digest item now being genuinely done end-to-end (not shipped-but-blocked); `MEMORY.md` index updated.
- **Open, not yet done:** enabling Anthropic Console auto-reload billing (recommended, not confirmed).

### Next Step

**Per the confirmed roadmap (see `project_marketing_automation_roadmap` memory): re-engagement / just-sold posts is next.** Small new skill(s), same shape as `listing-status-update` (v0.2.0, already in `agent/skills/real-estate/listing-status-update/`) — use it as the template. Nothing is blocking this; the Listing-tracking pipeline it would build on top of is now confirmed working end-to-end. After that: buyer-inquiry auto-reply (deliberately last — different product shape, inbound rather than outbound, new trust surface).

### How to Resume

Paste this at the start of a new session:

> Read session-handoff-2026-07-24.md and continue from where we left off
