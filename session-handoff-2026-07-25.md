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
- **Dev database state:** the **Ben Gurion, Tel Aviv (4 rooms, 95 sqm, floor 3)** listing (`cmry5rje00004u8u6ctv54q67`) is now `SOLD` as of 2026-07-25 — the PR #28 turn-two verification (below) was completed and the row flipped in place (no duplicate). This is the dev Neon database (via `.env.local`), not a separate real-customer DB.
- **Reporting-app dev server:** was **down** at the start of the 2026-07-25 continuation; **restarted on 127.0.0.1:4127** (background, log in scratchpad `devserver.log`). Check `Get-NetTCPConnection -LocalPort 4127` before spawning another.

### Decisions Made

- **The deferral rule belongs in the plugin, not the skill file.** Anything a long-lived WhatsApp session must *do* or *not do* has to go in the always-injected `listing-footer-reminder` text — a `SKILL.md` edit doesn't reach a session that isn't reloading skills (the recurring PR #23 / PR #26 compliance gap).
- **Declined: two separate WhatsApp messages** (post in one bubble, confirmation in another). Impossible without patching vendored Hermes adapter code — the outgoing chunker splits only by length and there's no delivery/send hook. Not worth the `hermes update`-revert fragility for a cosmetic gain. The user's own suggestion — put the confirmation intro at the **top** of the single message — solved the visibility problem instead (v1.3/v1.4).
- **Confirmation intro must not imply auto-posting.** Posting to Instagram/Facebook/Yad2 stays manual in this product; replying "yes" only records the update to the reporting dashboard. Built into the v1.4 plugin text as an explicit guardrail.

### Verification status — PR #28 fully CLOSED 2026-07-25

- **Turn one (deferral): verified live on real WhatsApp**, repeatedly, across v1.1→v1.4. Footer withheld, `Status: Sold` absent, DB untouched, descriptive intro leads the reply. Checked against the live session's `state.db` content, not just the visible bubble.
- **Turn two (the confirming "yes" → footer appended → Ben Gurion `ACTIVE`→`SOLD`): now DONE.** Confirmed via `state.db`: the "Yes" turn's assistant reply appended the `Listing Record` footer with `Status: Sold`. Ben Gurion (`cmry5rje…`) flipped `ACTIVE`→`SOLD` in the dev DB, same row, no duplicate.
- **How the DB flip actually happened (honest caveat):** the model side was fully live, but the ingest leg was **not** triggered by the live WhatsApp turn — the 4127 dev server was **down** during the test, and `sync-to-webapp` is fire-and-forget with **no retry** (agent/plugins/sync-to-webapp/__init__.py), so the "Yes" turn's POST was silently dropped. Closed the DB side by starting the dev server and **reconstructing that exact dropped `turn_completed` payload** (real session id `20260722_211453_5df9b593` + the real footer reply pulled from `state.db`) and POSTing it to the live `/api/ingest` — so the real ingest→parser→transition path ran, just not off a live turn. Added this drop-on-unreachable behavior to TODO.md's known-issues (matters before a production Vercel deploy — transient downtime would lose real listing-tracking events).

### How to query the dev DB / live session (commands that worked this session)

- Active listings (live bearer token): read `AUTOESTATE_INGESTION_SECRET` from `~/hermes/profiles/autoestate/.env`, then `Invoke-WebRequest http://127.0.0.1:4127/api/listings/active -Headers @{Authorization="Bearer <secret>"}`.
- Direct Listing row via Prisma: a throwaway `.mts` in `reporting-app/` importing `./lib/prisma`, run with `npx tsx --env-file=.env.local <file>.mts` (NOT `@prisma/client` directly — the generated client is at `@/prisma/generated/prisma/client`, and env must be loaded via `--env-file=.env.local` or the pg adapter throws "client password must be a string").
- Live session transcript / injected context: `~/hermes/profiles/autoestate/state.db`, `messages` table. The **`api_content`** column is the literal text sent to the model (includes plugin-injected context); the **`content`** column is the persisted assistant reply. Columns are `timestamp` (float epoch), not `created_at`.

### Next Step

**`TODO.md` (repo root) owns the full task list, order, and sub-checklists** — read it first. The short version of what to pick up:

1. **Next roadmap item: buyer-inquiry auto-reply** — deliberately last on the roadmap, inbound (new sender/allowlist + trust surface), biggest lift. (TODO.md item 1.)
2. Everything else (Hetzner `terraform apply`, Vercel deploy, Phase 5 security items, known small issues) is captured and prioritized in TODO.md. Note the new known-issue: `sync-to-webapp` drops turns when the ingest server is unreachable — worth a retry/queue before the production Vercel deploy.

(PR #28 turn-two verification is now CLOSED — see Verification status above.)

### How to Resume

Paste this at the start of a new session:

> Read session-handoff-2026-07-25.md and continue from where we left off
