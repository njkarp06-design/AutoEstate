## Session Handoff - 2026-07-24

### Task Overview

Building **AutoEstate**: a productized marketing-automation service for independent real estate agents in Tel Aviv, per [CLAUDE.md](CLAUDE.md) (source of truth — read it first on resume, especially the last few paragraphs of Section 5). This session picked up the two items explicitly deferred from PR #19 (2026-07-23): the reporting-app read-only Listings page ("PR-2"), and a live WhatsApp end-to-end test of the Listing-tracking pipeline. The first is done; the second surfaced a real, unresolved bug.

GitHub repo: https://github.com/njkarp06-design/AutoEstate (private). **Current branch: `feat/listings-page`** (not `main` — working tree is clean, nothing uncommitted). **PR #21 "Add read-only Listings page to reporting app" is OPEN and MERGEABLE, NOT YET MERGED** — per the user's standing rule (never auto-merge), it needs their explicit go-ahead.

### Files Modified

**In the git repo**, all on branch `feat/listings-page` (PR #21):
- `reporting-app/lib/stat-tile.tsx` — new. `StatTile` extracted out of `run-list.tsx` (was duplicated verbatim) — lives in `lib/` matching the existing `lib/markdown-components.tsx` precedent for shared JSX, not a new `app/components/` directory.
- `reporting-app/app/run-list.tsx` — now imports `StatTile` from `lib/stat-tile.tsx` instead of defining it inline.
- `reporting-app/lib/listings.ts` — new. `getListings(customer)` — read-only, no mutation helpers, matches the schema's own "no edit UI in this pass" comment on the `Listing` model.
- `reporting-app/lib/format.ts` — added `formatPrice`, `statusLabel`, `transactionTypeLabel`.
- `reporting-app/app/listings/page.tsx` + `reporting-app/app/listings/listing-list.tsx` — new. Server-fetch/client-filter split mirroring the existing Activity list pattern exactly. Shows every listing status by default (not just Active), matching a comment already in `app/api/listings/active/route.ts` from PR #19 anticipating this exact page.
- `reporting-app/app/layout.tsx` — added a "Listings" nav link next to "Settings".

**Also updated this session, on their own dedicated docs branch/PR (matching this repo's established pattern of a separate docs PR per feature, e.g. PR #20 for PR #19) — NOT on `main` yet, NOT part of PR #21's diff:**
- `CLAUDE.md` — new Section 5 entries: the PR #21 build (plan self-review findings, what shipped, verification), and the full live-WhatsApp-test writeup with the gateway bug investigation.
- `README.md` — status paragraphs updated to reflect PR #21 (built, not merged) and the gateway bug (found, accepted as known gap).
- This file (`session-handoff-2026-07-24.md`).

**PR #22 "Document PR #21 and the gateway footer-omission bug" is OPEN, NOT YET MERGED**, branch `docs/update-readme-claude-md-pr21-gateway-bug`. So on resume there are **two open PRs** (#21 code, #22 docs), neither merged, plus the local repo currently checked out on `feat/listings-page`. Confirm current PR states with `gh pr list` before assuming anything's changed since this was written.

**Outside the repo** (local machine state, matters for reproducing on another machine):
- `%LOCALAPPDATA%\hermes\profiles\autoestate\.env` — `ANTHROPIC_API_KEY` confirmed **dead** (HTTP 400: credit balance too low). The gateway currently works anyway because it auto-detects ambient Claude Code OAuth credentials (`~/.claude/.credentials.json`) on this shared machine/account — see Errors Hit. If that OAuth session is ever unavailable, the gateway has no working fallback. Worth fixing (top up the Console credits) even though it isn't blocking anything today.
- The `autoestate` Hermes gateway process was killed and restarted three times this session (chasing the bug below) and is currently running in its normal (non-verbose) logging mode.
- The reporting-app dev server (port 4127) was stopped at the end of this session for a clean handoff — nothing should be listening on 4127 right now. Start it with `npm run dev -- -p 4127` from `reporting-app/` if needed; always use `http://127.0.0.1:4127`, not `localhost` (unrelated IPv6 collision on this machine).

### Decisions Made

- **Listings page scope: strictly read-only**, no create/edit/delete, no linking a listing row to its originating run(s) — the schema's own comment already called this out, and a `Listing` can have many related `Run`s with no single "the" run to link to.
- **Default filter shows every status, not just Active** — deliberate, matching a pre-existing comment in `app/api/listings/active/route.ts` that this page should make ingest/auto-matching mistakes visible rather than hide them.
- **Genuine plan self-review before implementing** (user's explicit standing request, see `feedback_plan_self_review` memory) caught 3 real issues: wrong location for the shared `StatTile` component, an under-scoped 3-tile stat strip instead of matching the existing 4-tile pattern, and sloppy query pseudocode. All fixed before any code was written.
- **Sent real listings via WhatsApp to test the pipeline**, with the user's explicit go-ahead at every step (gateway restart, session deletion, second restart, verbose-logging restart, final restart back to normal) — nothing was done unilaterally.
- **Root-caused as far as reasonably possible, then explicitly stopped** at the user's direction once the investigation crossed from "our code" into Hermes's own vendored internals (`gateway/run.py`'s prompt assembly) — a deliberate decision to accept a known gap rather than keep digging into third-party code that an upstream `hermes update` could overwrite anyway.

### Errors Hit / Debugging Journey (the gateway footer-omission bug)

**Symptom:** every real WhatsApp listing (5 total: Hertzl St, Shenkin St, Hayarkon, Ben Yehuda, King David St) produced a correct, complete Instagram/Facebook/Yad2 caption, but **none produced the "Listing Record" footer** that `listing-to-social` v0.4.0 (PR #19) is supposed to append — so nothing ever landed in the `Listing` table.

Theories tested and ruled out, each with direct evidence (not assumed):
1. **Stale gateway process, never reloaded the newer `SKILL.md`.** Plausible by timing (gateway had been running since before the skill file's last edit) — but restarting the gateway **did not fix it.**
2. **Long-lived session degrading instruction-following** (the real WhatsApp session has been one continuous thread since 2026-07-22; Hermes never resets sessions by design). Tested by resuming the *exact* live session via CLI (`hermes -p autoestate --resume <session_id> -z "..."`) — footer appeared correctly. **Ruled out.** (Side-finding: `hermes sessions delete <id>` only removes the DB row — a *running* gateway keeps an in-memory cache of that session and reuses the same ID regardless, confirmed via its own log line "Persisted transcript lagged live cached history... preserving live conversation context." Only a full process restart actually drops a session. Real gotcha, unrelated to root cause.)
3. **Token/length truncation.** Ruled out — the gateway's own debug log showed `finish_reason=stop` with a 128k token budget barely touched (~1300 chars generated). A natural stop, not a cutoff.
4. **Output redaction stripping the footer.** Ruled out — fed the literal footer text directly to Hermes's own `agent.redact.redact_sensitive_text(force=True)`; came back byte-for-byte unchanged.
5. **Stale/shadow skill file.** Ruled out — confirmed `config.yaml`'s `skills.external_dirs` points at the live repo path, and a filesystem-wide search found no duplicate/shadow copy of the skill anywhere under the Hermes install.
6. **Different model.** Ruled out — both the gateway and every CLI test logged the identical `model=claude-opus-4-6`.
7. **Different credentials** — a dead end, but a real separate finding: gateway and CLI run under the same Windows account, so `Path.home()` resolves identically and both auto-detect the same ambient Claude Code OAuth credentials (`agent/anthropic_adapter.py`'s priority list: `ANTHROPIC_TOKEN` > `CLAUDE_CODE_OAUTH_TOKEN` > Claude Code credentials file > `credential_pool` > `ANTHROPIC_API_KEY`). Confirmed separately: the profile's actual `ANTHROPIC_API_KEY` is dead and `credential_pool` is empty — not the cause of this bug, but a real latent risk (see Files Modified above).

**Not pinned down:** something in the real gateway turn's exact system-prompt/context assembly specific to `platform=whatsapp` causes the model to naturally omit the footer — reproducible 5-for-5 on real sends, never reproduced via CLI on the identical session/facts. The remaining leads require digging into Hermes's own vendored `gateway/run.py`, which we don't maintain. **User's explicit decision: stop here, accept as a known gap.** Revisit only if it keeps blocking real usage, or consider filing it upstream to Nous Research.

### Current State

- **PR #21 open, not merged.** Built and verified (lint/build clean, data layer checked against the real dev database with a throwaway customer). Browser verification not done — same known Clerk headless-auth limitation as PR #17 (documented, not a regression).
- **The real customer's `Listing` table is empty**, confirmed directly against the dev database (not assumed) — because of the gateway bug above, not because of anything wrong in PR #21 itself.
- **CLAUDE.md/README.md updated** with full detail on both the PR #21 work and the bug investigation — read those directly rather than trusting this summary if anything seems inconsistent.
- **Memory updated:** new `project_gateway_footer_omission_bug.md` (full evidence trail), `project_listing_memory_digest.md` amended (PR-2 done, live test done, links to the bug memory), `project_reporting_app_activity_layout.md` corrected (a stale claim about `app/page.tsx`'s width), `MEMORY.md` index updated.
- **Gateway is running normally** (non-verbose logging) — the live service is up and working correctly for everything except footer/Listing-tracking on real WhatsApp turns.
- **Dev server is stopped.** Nothing bound to port 4127 as of end of session.

### Next Step

Three open decisions, none yet made — surface these to the user rather than assuming an answer:
1. **Merge PR #21?** It's ready (`gh pr view 21` confirms MERGEABLE), just needs explicit sign-off per the user's standing "never auto-merge" rule.
2. **How to get real data onto the Listings page** given the gateway bug: manually enter a few real listings by hand (a real `Listing` row via a script, using facts the user actually sent), or leave it empty until the gateway bug is understood/fixed, or something else.
3. **Whether to pursue the gateway bug further** — it was explicitly parked, but the user may want to revisit, especially since it currently blocks the entire Listing-tracking feature (PR #19 + PR #21) from working on real traffic.

Beyond those: the roadmap's next item after this feature is **re-engagement/just-sold posts** (before the larger-scope buyer-inquiry auto-reply), per the explicit build order the user confirmed on 2026-07-23 (see `project_marketing_automation_roadmap` memory).

### How to Resume

Paste this at the start of a new session:

> Read session-handoff-2026-07-24.md and continue from where we left off
