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

1. **Get the bot token.** User creates a dev bot in @BotFather (`/newbot`), separate from the operator bot and from the revoked 2026-07-25 spike bot. Write it into `%LOCALAPPDATA%\hermes\profiles\autoestate-buyer\.env` as `TELEGRAM_BOT_TOKEN`.
2. **Make sure there's an `ACTIVE` listing first.** Both `Listing` rows in the dev DB are currently `SOLD` (Ben Gurion, Dizengoff), so as things stand the bot can only demonstrate status-honesty, not a real factual answer. Send a fresh listing through the operator WhatsApp bot, or seed one.
3. **Confirm the 4127 reporting-app dev server is up** before testing — `sync-inquiries-to-webapp` is fire-and-forget with no retry (same known issue as `sync-to-webapp`), so a down server means the inquiry is silently lost.
4. **Start the gateway:** `hermes -p autoestate-buyer gateway`. Watch for a Windows Startup-folder login-item prompt — a previous session had one auto-install non-interactively; flag it rather than accept it silently.
5. **Run the end-to-end test** from a Telegram account that is *not* the operator's (the flatmate account worked for the spike): a factual question on an ACTIVE listing, a question about a SOLD one, a Hebrew message, a "can I see it?" (should defer + capture contact), and a prompt-injection attempt. Then confirm the `/inquiries` dashboard shows the thread, the disposition, and the captured contact.
6. **Then** open the PR into `main` — and confirm before merging (standing rule, never auto-merge).

### Environment notes

- Reporting-app dev server runs on **`127.0.0.1:4127`** — always `127.0.0.1`, never `localhost` (IPv6 collision on this machine). Verify a *newly launched* server's own log for `EADDRINUSE`; a stale process answering curl has fooled a previous session.
- The `autoestate` operator gateway is running and **untouched** by this work. Port 3000 is the live Hermes WhatsApp bridge — never kill it.
- Live buyer profile dir: `%LOCALAPPDATA%\hermes\profiles\autoestate-buyer\`. Its log would be `.../autoestate-buyer/logs/gateway.log` — the per-profile path, not the shared `%LOCALAPPDATA%\hermes\logs\` one, which has misled a previous session into a needless restart.
- Anthropic credits for this API key have run dry repeatedly across sessions and caused live outages; top up at console.anthropic.com if replies start failing with a credit error.

### How to Resume

Start a fresh Claude Code session and open with:

> Read session-handoff-2026-07-26.md and continue from where we left off. We're on branch `feat/buyer-inquiry`. The buyer instance (1H) is built and statically verified but has never been run — it needs a dev Telegram bot token in the `autoestate-buyer` profile's `.env`, an ACTIVE listing in the dev DB to test against, and then the end-to-end buyer→dashboard test.
