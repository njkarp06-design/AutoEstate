## Session Handoff - 2026-07-26

### Task Overview

Building **AutoEstate** (see [CLAUDE.md](CLAUDE.md) — read it first, especially the buyer-inquiry paragraphs at the end of Section 5). The live thread is the **buyer-inquiry auto-reply** feature — the last and biggest roadmap item, and the first **inbound** one.

**Buyer-inquiry in one line:** a prospective *buyer* (a stranger, not the operator) messages a dedicated bot and gets factual answers about a listing 24/7 from real listing data, captured as a reachable lead, with anything human deferred to the operator — a "receptionist, not a closer." Full plan: **`~/.claude/plans/quirky-honking-wave.md`**. Architecture + locked decisions: CLAUDE.md's buyer-inquiry paragraphs. Phased checklist: TODO.md item 1.

GitHub repo: https://github.com/njkarp06-design/AutoEstate (private).

### Current state at a glance

- **Branch `feat/buyer-inquiry`**, ahead of `main` (`git log --oneline main..HEAD`), working tree clean, all pushed. **No open PR yet** — correct; don't open or merge until 1H's live test passes.
- **Phase 0: all four blockers resolved** (2026-07-25 — two read-only, two via a live throwaway Telegram spike that was deleted and its token revoked).
- **Phase 1A–1G: built, verified, committed** — the skill, the two buyer plugins, the full reporting pipeline (schema → endpoints → sync plugin → `/inquiries` dashboard), and Telegram operator notification with per-customer routing.
- **Phase 1H: COMPLETE (2026-07-26)** — built, running, and live-tested from BOTH the operator's account and a genuine non-operator (flatmate) account. Six defects found across the two runs, all fixed. The bot is `@autoestate_buyerdev_bot`; the gateway is up (`hermes -p autoestate-buyer gateway run`, foreground). The skill layer passed every case in both runs; every defect was in the surrounding plumbing. **Nothing on the buyer-inquiry feature is outstanding — the next step is the PR.**

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

**Both live legs of the end-to-end test have now PASSED (2026-07-26).** The operator's own account covered the factual/SOLD/Hebrew/defer/injection cases; the flatmate's fresh session then closed the two gaps that had never been cleanly exercised — the **ambiguity path** (a cold "is it still available?" produced one clarifying question naming real candidates) and **contact capture**. Session isolation confirmed: two separate `Inquiry` rows. Six defects were found across the two runs and all six are fixed — the most serious being `buyerContact` silently null on every lead (the feature's #1 field) and a `/start` regression that would have met every future buyer with a permissions refusal. Detail in CLAUDE.md.

1. **Open the PR into `main`.** 1H is complete. Nothing is outstanding on the buyer-inquiry feature itself. **Confirm before merging — never auto-merge.**
2. **(Deployment, non-blocking) Notifier bot:** create the Telegram alert bot, set `OPERATOR_TELEGRAM_BOT_TOKEN`, paste a chat id in Settings. Needed before a real lead *push* works; the dashboard records leads regardless.
3. ~~Optional polish~~ **DONE 2026-07-26** — the disambiguation defect (the menu listing `SOLD` properties as if on offer) is fixed in `buyer-inquiry` v0.2.0 and re-verified via `hermes -z`, including the regression case. Nothing on the feature is outstanding.

After that the whole marketing-automation roadmap is done, and what remains is productionization: `terraform apply` to a real Hetzner account, deploying the reporting app to Vercel, the buyer-instance security gates (container isolation, a scoped second ingestion secret, re-running `hermes security audit`), re-confirming open-channel behaviour on WhatsApp, and the still-open buyer-channel transport decision.

### Environment notes

- **There are no Claude Code hooks in this repo** — `.claude/settings.json` (the doc-sync `UserPromptSubmit` hook) was deleted 2026-07-26 at the owner's request; no git hooks either. Keeping CLAUDE.md / TODO.md / this file current is a convention now, not automation. See CLAUDE.md section 3.

- Reporting-app dev server runs on **`127.0.0.1:4127`** — always `127.0.0.1`, never `localhost` (IPv6 collision on this machine). Verify a *newly launched* server's own log for `EADDRINUSE`; a stale process answering curl has fooled a previous session.
- The `autoestate` operator gateway is running and **untouched** by this work. Port 3000 is the live Hermes WhatsApp bridge — never kill it. All three profiles (`default`, `autoestate`, `autoestate-buyer`) run gateways concurrently without conflict.
- **Never edit a profile's `config.yaml` while its gateway is running** — the gateway rewrites the file (persisting things like `onboarding.seen`), strips all comments, and will silently clobber the edit. The commented copy in `agent/profiles/autoestate-buyer/config.yaml` is the documented source of truth.
- Live buyer profile dir: `%LOCALAPPDATA%\hermes\profiles\autoestate-buyer\`. Its log would be `.../autoestate-buyer/logs/gateway.log` — the per-profile path, not the shared `%LOCALAPPDATA%\hermes\logs\` one, which has misled a previous session into a needless restart.
- Anthropic credits for this API key have run dry repeatedly across sessions and caused live outages; top up at console.anthropic.com if replies start failing with a credit error.

### How to Resume

Start a fresh Claude Code session and open with:

> Read session-handoff-2026-07-26.md and continue from where we left off. We're on branch `feat/buyer-inquiry`. Buyer-inquiry (1H) is complete — live-tested end to end from both the operator's account and a real non-operator account, with all six defects found along the way fixed. The next step is opening the PR into main (confirm before merging).
