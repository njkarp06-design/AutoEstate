## Session Handoff - 2026-07-26

### Task Overview

Building **AutoEstate** (see [CLAUDE.md](CLAUDE.md) — read it first, especially the buyer-inquiry paragraphs at the end of Section 5). The live thread is the **buyer-inquiry auto-reply** feature — the last and biggest roadmap item, and the first **inbound** one.

**Buyer-inquiry in one line:** a prospective *buyer* (a stranger, not the operator) messages a dedicated bot and gets factual answers about a listing 24/7 from real listing data, captured as a reachable lead, with anything human deferred to the operator — a "receptionist, not a closer." Full plan: **`~/.claude/plans/quirky-honking-wave.md`**. Architecture + locked decisions: CLAUDE.md's buyer-inquiry paragraphs. Phased checklist: TODO.md item 1.

GitHub repo: https://github.com/njkarp06-design/AutoEstate (private).

### Current state at a glance

- **Branch `feat/buyer-inquiry`**, ahead of `main` (`git log --oneline main..HEAD`), working tree clean, all pushed. **No open PR yet** — correct; don't open or merge until 1H's live test passes.
- **Phase 0: all four blockers resolved** (2026-07-25 — two read-only, two via a live throwaway Telegram spike that was deleted and its token revoked).
- **Phase 1A–1G: built, verified, committed** — the skill, the two buyer plugins, the full reporting pipeline (schema → endpoints → sync plugin → `/inquiries` dashboard), and Telegram operator notification with per-customer routing.
- **Phase 1H: BUILT, RUNNING, and live-tested from the operator's account (2026-07-26).** The bot is `@autoestate_buyerdev_bot`; the gateway is up (`hermes -p autoestate-buyer gateway run`, foreground). The skill layer passed all seven test cases; four defects in the *surrounding* plumbing were found and fixed. **What's left is a fresh-session test from a genuine non-operator account** (the ambiguity path + contact capture) — see Next steps.

### Where 1H actually stands

**Done and verified by running the resolution code, not by reading config:**

- `agent/skills-buyer/real-estate/buyer-inquiry/` — the skill was **moved** out of the shared `agent/skills/` (user-approved). Verified: buyer profile discovers **1** skill, operator profile discovers **5**, neither sees the other's.
- Profile `autoestate-buyer` created via `hermes profile create autoestate-buyer --no-skills --no-alias`. Empty, with a `.no-bundled-skills` marker so `hermes update` never re-seeds skills into it. No alias/startup item installed.
- Tool lockdown verified end-to-end: the model receives exactly **3 tools** — `skills_list`, `skill_view`, `skill_manage`. Nothing else.
- `SOUL.md` locked receptionist persona; `memory`, `vision`, `curator` all off; `skills.write_approval: true`.
- Both plugins physically copied into the profile's `plugins/` dir and named in `plugins.enabled`; confirmed loaded with `pre_llm_call`/`post_llm_call` registered.
- `.env` written — `TELEGRAM_ALLOWED_USERS=*` (explicit, not empty), ingestion URL/secret + API key carried from the operator profile, **no `WHATSAPP_*` vars at all**.
- `buyer-listings-context` tested live against the running 4127 reporting app with the buyer profile's own env: returned the real two-listing block, and correctly returned `None` for a non-buyer platform.
- The whole lockdown committed as a reviewable repo template: `agent/profiles/autoestate-buyer/` (`config.yaml` + `SOUL.md` verbatim, secret-stripped `.env.example`, README). `.gitignore` gained `!agent/profiles/*/.env.example`.

**Also done 2026-07-26 (after the above):**

- **Bot + gateway live.** `@autoestate_buyerdev_bot` ("AutoEstate Property Desk", id `8870082036`); token in the profile `.env` only. Started with `gateway run` (foreground) — deliberately not `gateway install/start`, so no third Windows Startup-folder login item exists.
- **Slash-command hole closed.** 68 gateway commands (`/profile`, `/model`, `/yolo`, …) were reachable by any sender: gating is off unless an admin list exists, and `ALLOWED_USERS=*` makes everyone an "allowed caller". Fixed via `platforms.telegram.extra.allow_admin_from`; verified operator=admin, stranger=`/help`+`/whoami` only.
- **Dev DB seeded** — 2 ACTIVE listings (Rothschild Boulevard sale, Neve Tzedek rental) alongside the 2 SOLD; a leftover `_dryrun_` customer deleted (the docs had wrongly claimed it was cleaned up).
- **Four defects found by the live test and fixed** — `computeDisposition` (latest-reply-only → a viewing lead showed as auto-answered), `maybeLinkListing` (required the full "Area, Tel Aviv" string → linked nothing), Hermes's first-contact note offering a stranger a profile-build + web_search (disabled via `onboarding.profile_build: "off"`), and the discovery that **the running gateway rewrites `config.yaml` and strips comments** — stop it before editing.

### Next steps (in order)

**The operator-account leg of the end-to-end test PASSED on 2026-07-26.** Seven real messages to `@autoestate_buyerdev_bot`; the skill layer was correct on every case it owns (data-only price answer, honest SOLD, Hebrew mirroring, missing fact deferred not invented, viewing deferred + contact asked, prompt injection refused, defer sentence verbatim x3). All synced as one Inquiry, 14 messages, correct order. Four surrounding defects were found and fixed the same day — detail in CLAUDE.md.

What is left:

1. **Flatmate / fresh-session leg — the real remaining test.** Two things are still unverified and both need a *fresh* session from a genuine non-operator account:
   - **The ambiguity path.** Send a cold **"is it still available?"** as the FIRST message, with no prior property mentioned. Expected: ONE clarifying question naming both ACTIVE listings (Rothschild + Neve Tzedek). In the operator run this turn had a clear referent from the previous message, so the model reasonably resolved it instead of asking — the case was never cleanly exercised.
   - **Contact capture.** Ask for a viewing and then actually **give a phone number**. Expected: it lands in `Inquiry.buyerContact`. In the operator run no number was ever supplied, so `buyerContact` is correctly `null` and the field has never been proven end to end.
   - Also worth confirming incidentally: the stranger tier of the slash-command gating (`/model` should be refused, `/help` allowed), and that the first-contact onboarding note does NOT reappear.
2. **Then** open the PR into `main` — and confirm before merging (standing rule, never auto-merge).
3. **(Deployment, non-blocking) Notifier bot:** create the Telegram alert bot, set `OPERATOR_TELEGRAM_BOT_TOKEN`, paste a chat id in Settings — needed before a real lead *push* works (the dashboard already records leads regardless).

### Environment notes

- Reporting-app dev server runs on **`127.0.0.1:4127`** — always `127.0.0.1`, never `localhost` (IPv6 collision on this machine). Verify a *newly launched* server's own log for `EADDRINUSE`; a stale process answering curl has fooled a previous session.
- The `autoestate` operator gateway is running and **untouched** by this work. Port 3000 is the live Hermes WhatsApp bridge — never kill it. All three profiles (`default`, `autoestate`, `autoestate-buyer`) run gateways concurrently without conflict.
- **Never edit a profile's `config.yaml` while its gateway is running** — the gateway rewrites the file (persisting things like `onboarding.seen`), strips all comments, and will silently clobber the edit. The commented copy in `agent/profiles/autoestate-buyer/config.yaml` is the documented source of truth.
- Live buyer profile dir: `%LOCALAPPDATA%\hermes\profiles\autoestate-buyer\`. Its log would be `.../autoestate-buyer/logs/gateway.log` — the per-profile path, not the shared `%LOCALAPPDATA%\hermes\logs\` one, which has misled a previous session into a needless restart.
- Anthropic credits for this API key have run dry repeatedly across sessions and caused live outages; top up at console.anthropic.com if replies start failing with a credit error.

### How to Resume

Start a fresh Claude Code session and open with:

> Read session-handoff-2026-07-26.md and continue from where we left off. We're on branch `feat/buyer-inquiry`. The buyer instance (1H) is built, running, and passed a live end-to-end test from the operator's own Telegram account. What's left is a fresh-session test from a genuine non-operator account — the ambiguity path (a cold "is it still available?") and contact capture (give a real phone number and check it lands in `Inquiry.buyerContact`) — then open the PR.
