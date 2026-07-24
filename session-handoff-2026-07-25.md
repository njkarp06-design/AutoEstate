## Session Handoff - 2026-07-25

### Task Overview

Building **AutoEstate**: a productized marketing-automation service for independent real estate agents in Tel Aviv, per [CLAUDE.md](CLAUDE.md) (source of truth — read it first on resume, especially the last few paragraphs of Section 5). This session did one focused thing: closed the one open live-verification gap left by PR #26, which turned out to be a **real bug**, and fixed it (PR #28). Plus routine housekeeping.

GitHub repo: https://github.com/njkarp06-design/AutoEstate (private). **Repo is on `main`, clean, up to date with origin. PR #28 is MERGED. Nothing is pending review.**

### What happened this session

1. **Housekeeping (done):** deleted three fully-merged branches locally + on remote (`feat/reengagement-just-sold-skills`, `feat/listing-lookup-by-locator`, `docs/refresh-claude-md-readme-handoff-2026-07-24`). Restarted the reporting-app dev server on **127.0.0.1:4127** (the previous one had died) — note a plain `npm run dev` grabs **port 3000**, which is the live WhatsApp bridge; always launch with `-- -p 4127`.
2. **Live-tested PR #26's no-locator confirmation-deferral path — it FAILED.** "Great news, the apartment sold! Make a sold post" (no locator) emitted the `Status: Sold` footer immediately and flipped the Ben Gurion listing to `SOLD` with no confirmation gate.
3. **Root-caused + fixed = PR #28 (merged).** The deferral rule lived only in `just-sold`'s `SKILL.md`, which the long-lived WhatsApp session never reloads (zero tool calls that turn, confirmed via `state.db`), while the `listing-footer-reminder` plugin's always-injected text told the model to emit the footer unconditionally. Moved the rule into the plugin. Iterated 4× with live feedback (plugin v1.0→v1.4): withhold footer + ask → make it a real separated question → move question to top → expand into a descriptive intro. See CLAUDE.md's PR #28 paragraph for the full detail.

### Files Modified

**In the git repo, merged to `main` (PR #28):**
- `agent/plugins/listing-footer-reminder/__init__.py` — added the no-locator confirmation-deferral rule to the injected reminder text (the EXCEPTION block), then iterated its wording/placement to v1.4 (descriptive intro at the top of the reply, footer withheld until a confirming turn). Also a docstring note explaining why the rule has to live here, not in the skill file.
- `agent/plugins/listing-footer-reminder/plugin.yaml` — `version` 1.0 → 1.4.
- `CLAUDE.md`, `README.md` — this work documented (done as part of this handoff).

**Outside the git repo (live machine state — matters for continuing on this machine):**
- `~/hermes/profiles/autoestate/plugins/listing-footer-reminder/` — the **live deployed copy is v1.4**, matching the repo. (Reminder: plugins are NOT loaded via `external_dirs` like skills — they're a manual file copy into the profile's `plugins/` dir + listed in `config.yaml`'s `plugins.enabled`, then gateway restart. `sync-to-webapp`, `listing-footer-reminder`, and `active-listings-context` are all enabled.)
- The gateway was restarted several times this session (once per plugin version). **Currently running, healthy, both WhatsApp + Telegram connected** (last PID 8340; may differ if restarted again).
- **Anthropic API credits:** the user topped up at the start of this session, so the live gateway is currently working. (This has run dry repeatedly across sessions — enabling Console auto-reload billing was recommended again; unknown if done.)
- **Reporting-app dev server** is running on **127.0.0.1:4127** (started this session). Check `Get-NetTCPConnection -LocalPort 4127` before starting another — don't spawn a duplicate.
- **Dev database state:** the **Ben Gurion, Tel Aviv (4 rooms, 95 sqm, floor 3)** listing is currently `ACTIVE` and **un-recorded as sold** — it was flipped back to ACTIVE for the retest and the final "yes" confirmation step was never sent, so it's sitting mid-test. Its Prisma id is `cmry5rje00004u8u6ctv54q67`. This is the dev Neon database (via `.env.local`), not a separate real-customer DB.

### Decisions Made

- **The deferral rule belongs in the plugin, not the skill file.** Anything a long-lived WhatsApp session must *do* or *not do* has to go in the always-injected `listing-footer-reminder` text — a `SKILL.md` edit doesn't reach a session that isn't reloading skills (the recurring PR #23 / PR #26 compliance gap).
- **Declined: two separate WhatsApp messages** (post in one bubble, confirmation in another). Impossible without patching vendored Hermes adapter code — the outgoing chunker splits only by length and there's no delivery/send hook. Not worth the `hermes update`-revert fragility for a cosmetic gain. The user's own suggestion — put the confirmation intro at the **top** of the single message — solved the visibility problem instead (v1.3/v1.4).
- **Confirmation intro must not imply auto-posting.** Posting to Instagram/Facebook/Yad2 stays manual in this product; replying "yes" only records the update to the reporting dashboard. Built into the v1.4 plugin text as an explicit guardrail.

### Verification status — READ THIS before assuming PR #28 is fully closed

- **Turn one (deferral): verified live on real WhatsApp**, repeatedly, across v1.1→v1.4. Footer withheld, `Status: Sold` absent, DB untouched, descriptive intro leads the reply. Checked against the live session's `state.db` content, not just the visible bubble.
- **Turn two (the confirming "yes" → footer appended → Ben Gurion `ACTIVE`→`SOLD`): NOT separately re-verified live** with the v1.4 intro in place. Low-risk — the `ACTIVE`→`SOLD` transition-in-place itself was already proven live by the *original failing* test (same row updated, no duplicate) — but "the user trusts it works" is not the same as "we watched it work." If you want it fully closed: send "Great news, the apartment sold! Make a sold post" from the user's WhatsApp, confirm the reply leads with the intro + no footer, then reply "yes" and confirm the footer lands and Ben Gurion flips to SOLD (query `/api/listings/active` or the Listing row directly).

### How to query the dev DB / live session (commands that worked this session)

- Active listings (live bearer token): read `AUTOESTATE_INGESTION_SECRET` from `~/hermes/profiles/autoestate/.env`, then `Invoke-WebRequest http://127.0.0.1:4127/api/listings/active -Headers @{Authorization="Bearer <secret>"}`.
- Direct Listing row via Prisma: a throwaway `.mts` in `reporting-app/` importing `./lib/prisma`, run with `npx tsx --env-file=.env.local <file>.mts` (NOT `@prisma/client` directly — the generated client is at `@/prisma/generated/prisma/client`, and env must be loaded via `--env-file=.env.local` or the pg adapter throws "client password must be a string").
- Live session transcript / injected context: `~/hermes/profiles/autoestate/state.db`, `messages` table. The **`api_content`** column is the literal text sent to the model (includes plugin-injected context); the **`content`** column is the persisted assistant reply. Columns are `timestamp` (float epoch), not `created_at`.

### Next Step — ordered

1. **(Optional, ~2 min) Fully close PR #28's turn-two verification** — see Verification status above. Not blocking anything; the fix is merged and turn one is proven.
2. **Next roadmap item: buyer-inquiry auto-reply** (see `project_marketing_automation_roadmap` memory). Deliberately last on the roadmap — inbound, not outbound: a new sender/allowlist model and a materially different trust surface than the existing operator-only allowlist. Biggest lift, most differentiated pitch value. Nothing blocks starting it.
3. **Longer-standing deferred items** (unchanged, still outstanding, not blocking): `terraform apply` to a real Hetzner account (infra module written + validated, never applied — no Hetzner account exists yet) and a Vercel Pro deployment of the reporting app (still `npm run dev`-only). Revisit when there's a real customer to onboard.

### How to Resume

Paste this at the start of a new session:

> Read session-handoff-2026-07-25.md and continue from where we left off
