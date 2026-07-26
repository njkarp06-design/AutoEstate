## Session Handoff - 2026-07-26

### Task Overview

Building **AutoEstate** (see [CLAUDE.md](CLAUDE.md) — read it first, especially the buyer-inquiry paragraphs at the end of Section 5). The live thread is the **buyer-inquiry auto-reply** feature — the last and biggest roadmap item, and the first **inbound** one.

**Buyer-inquiry in one line:** a prospective *buyer* (a stranger, not the operator) messages a dedicated bot and gets factual answers about a listing 24/7 from real listing data, captured as a reachable lead, with anything human deferred to the operator — a "receptionist, not a closer." Full plan: **`~/.claude/plans/quirky-honking-wave.md`**. Architecture + locked decisions: CLAUDE.md's buyer-inquiry paragraphs. Phased checklist: TODO.md item 1.

GitHub repo: https://github.com/njkarp06-design/AutoEstate (private).

### Current state at a glance

- **Branch `feat/buyer-inquiry`**, ahead of `main` (`git log --oneline main..HEAD`), working tree clean, all pushed. **No open PR yet** — correct; don't open or merge until 1H's live test passes.
- **Phase 0: all four blockers resolved** (2026-07-25 — two read-only, two via a live throwaway Telegram spike that was deleted and its token revoked).
- **Phase 1A–1G: built, verified, committed** — the skill, the two buyer plugins, the full reporting pipeline (schema → endpoints → sync plugin → `/inquiries` dashboard), and Telegram operator notification with per-customer routing.
- **Phase 1H: the buyer instance is BUILT and statically verified (2026-07-26). It has never been run.** Everything except the Telegram bot token is done.

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

**Not done:**

- `TELEGRAM_BOT_TOKEN` is the literal string `REPLACE_ME` in the profile `.env`. **The user was asked to create a dedicated dev bot in @BotFather and supply the token; that is the only blocker.**
- The gateway has never been started for this profile.
- No end-to-end buyer→dashboard test has run.

### Next steps (in order)

1. ~~Get the bot token~~ **DONE 2026-07-26.** `@autoestate_buyerdev_bot` ("AutoEstate Property Desk", id `8870082036`) created by the user and validated live via `getMe`. Token lives only in the profile `.env` (outside the repo). **The gateway is running** — started with `hermes -p autoestate-buyer gateway run` (foreground, so no third Startup-folder login item was created).
2. ~~Make sure there's an `ACTIVE` listing~~ **DONE 2026-07-26.** The dev DB now holds 4 listings for the real customer — 2 `SOLD` (Ben Gurion, Dizengoff) and 2 newly seeded `ACTIVE`: **Rothschild Boulevard** (sale, 3 rooms, 78 sqm, floor 2, ₪3,950,000) and **Neve Tzedek** (rental, 2.5 rooms, 62 sqm, floor 1, ₪9,200). Confirmed visible through the real `/api/listings/buyer-view` endpoint via the plugin. A leftover `_dryrun_` test customer was also deleted (the docs had wrongly claimed it was already cleaned up); the dev DB now has exactly one customer.
3. **Confirm the 4127 reporting-app dev server is up** before testing — `sync-inquiries-to-webapp` is fire-and-forget with no retry (same known issue as `sync-to-webapp`), so a down server means the inquiry is silently lost.
4. ~~Start the gateway~~ **DONE 2026-07-26** — connected, `Gateway running with 1 platform(s)`. Started with `gateway run` (foreground) rather than `gateway install/start`, so no third Windows Startup-folder login item was created. Note: `logs/session-run.log` stays nearly empty (stdout unflushed) — the real log is the per-profile `logs/gateway.log`. Also closed while starting it: a **slash-command hole** — 68 gateway commands (`/profile`, `/model`, `/yolo`, `/update`, …) were reachable by any stranger, because slash gating is off unless an admin list exists and `TELEGRAM_ALLOWED_USERS=*` makes everyone an "allowed caller". Now gated via `platforms.telegram.extra.allow_admin_from`; verified operator=admin, stranger=`/help`+`/whoami` only. Full detail + the generalised lesson in CLAUDE.md.
5. **Run the end-to-end test** from a Telegram account that is *not* the operator's (the flatmate account worked for the spike). Suggested cases, matched to the seeded data:
   - *"How much is the Rothschild place?"* → factual answer from the ACTIVE sale listing.
   - *"Is the Ben Gurion apartment still available?"* → honest "already sold", no availability claim.
   - *"Is it still available?"* (no locator, 2 ACTIVE) → **one** clarifying question naming both candidates. This path has only ever been proven via `hermes -z`; this is its first live run.
   - A Hebrew message → full-Hebrew reply, mirroring language.
   - Ask about something not in the data (parking, balcony) → defers, does not invent.
   - *"Can I see it this week?"* → defers to the operator + captures contact.
   - A prompt-injection attempt → refused, stays in role.

   Then confirm the `/inquiries` dashboard shows the thread, the disposition, and the captured contact.
6. **Then** open the PR into `main` — and confirm before merging (standing rule, never auto-merge).

### Environment notes

- Reporting-app dev server runs on **`127.0.0.1:4127`** — always `127.0.0.1`, never `localhost` (IPv6 collision on this machine). Verify a *newly launched* server's own log for `EADDRINUSE`; a stale process answering curl has fooled a previous session.
- The `autoestate` operator gateway is running and **untouched** by this work. Port 3000 is the live Hermes WhatsApp bridge — never kill it.
- Live buyer profile dir: `%LOCALAPPDATA%\hermes\profiles\autoestate-buyer\`. Its log would be `.../autoestate-buyer/logs/gateway.log` — the per-profile path, not the shared `%LOCALAPPDATA%\hermes\logs\` one, which has misled a previous session into a needless restart.
- Anthropic credits for this API key have run dry repeatedly across sessions and caused live outages; top up at console.anthropic.com if replies start failing with a credit error.

### How to Resume

Start a fresh Claude Code session and open with:

> Read session-handoff-2026-07-26.md and continue from where we left off. We're on branch `feat/buyer-inquiry`. The buyer instance (1H) is built and statically verified but has never been run — it needs a dev Telegram bot token in the `autoestate-buyer` profile's `.env`, an ACTIVE listing in the dev DB to test against, and then the end-to-end buyer→dashboard test.
