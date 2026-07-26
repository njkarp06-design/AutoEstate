## Session Handoff - 2026-07-26

### Task Overview

Building **AutoEstate** (see [CLAUDE.md](CLAUDE.md) — read it first). As of 2026-07-26 the **entire marketing-automation roadmap is built, live-tested and merged.** The last item, buyer-inquiry auto-reply, shipped in **PR #34**.

GitHub repo: https://github.com/njkarp06-design/AutoEstate (private).

### Current state at a glance

- **On `main`, clean.** PR #34 merged 2026-07-26 (`7ba4c21`). No feature work outstanding.
- **Every roadmap feature is done:** listing-to-social, listing-status-update, just-sold, listing-reengagement, locator-based lookup, weekly-digest, and the inbound buyer-inquiry receptionist.
- **There are no Claude Code hooks in this repo.** `.claude/settings.json` was deleted 2026-07-26 at the owner's request; no git hooks either. Keeping CLAUDE.md / TODO.md / this file current is a **convention**, not automation — see CLAUDE.md section 3. PR #33 (a background doc-consistency checker on a `Stop` hook) was closed for the same reason; its branch survives if the script is ever wanted as an on-demand check.
- **The dev buyer bot is STOPPED.** `@autoestate_buyerdev_bot`'s gateway was deliberately shut down after testing, since it accepts messages from anyone (`TELEGRAM_ALLOWED_USERS=*`). Restart with `hermes -p autoestate-buyer gateway run`.
- **The operator gateway (`autoestate`) is untouched and still running**, as is the WhatsApp bridge on port 3000 — never kill that one.

### What shipped in PR #34

A locked-down, public, buyer-facing Hermes instance plus the `/inquiries` dashboard. A stranger messages a dedicated bot, gets factual answers from real listing data, and is captured as a reachable lead; anything human defers to the operator.

**Why a second instance is forced, not preferred:** the Hermes sender allowlist is enforced inside the vendored adapter, upstream of every hook and skill, and sender identity is never passed to a skill — so a skill cannot tell an operator from a stranger. The isolation is structural: the outbound, `Listing`-mutating skills are simply not loaded on the buyer instance. Verified by resolving each profile's real config — buyer sees 1 skill, operator sees 5.

**Security posture:** the buyer model receives exactly 3 tools (`skills_list`, `skill_view`, `skill_manage`). Three non-obvious Hermes findings drove the config, all written up in CLAUDE.md — `platform_toolsets` is not a complete allowlist, `skill_manage` cannot be dropped (neutered via `skills.write_approval`), and 68 slash commands were reachable by any stranger until an admin list was set.

**Six defects were found by two live tests and all six fixed** — including `buyerContact` silently null on every lead (the feature's most important field) and `/start` blocked for buyers. Full detail in CLAUDE.md.

### Next steps — all productionization, none blocked on building

1. **`terraform apply` to a real Hetzner account** (TODO item 3). Module is written and validated, never applied. Needs an account — an account-level action requiring the owner's sign-off.
2. **Deploy the reporting app to Vercel Pro** (item 4) — still `npm run dev` only. Also account-level.
3. **Public buyer-instance security gates** (items 5–6): container isolation (`terminal.backend: local` today), a scoped second ingestion secret (the buyer box currently shares one that can also write to `/api/ingest`), and re-running `hermes security audit` once anything is publicly exposed.
4. **Re-confirm open-channel behaviour on WhatsApp.** The spike and both live tests proved Telegram only.
5. **Settle the buyer-channel transport open decision** (in TODO) — 2nd eSIM vs. official Cloud API vs. non-WhatsApp. No code depends on it; the buyer instance is transport-agnostic.
6. **Non-blocking:** create the Telegram notifier bot and set `OPERATOR_TELEGRAM_BOT_TOKEN` so operator lead alerts actually push. The dashboard records leads either way.

### Environment notes

- Reporting-app dev server: **`127.0.0.1:4127`** — always `127.0.0.1`, never `localhost` (IPv6 collision on this machine). Verify a newly launched server's own log for `EADDRINUSE`; a leftover process answering curl has fooled a previous session. A transient Turbopack 500 during recompile is not necessarily a degraded server — re-check before restarting.
- **Never edit a profile's `config.yaml` while its gateway is running** — the gateway rewrites the file, strips all comments, and will silently clobber the edit. The commented copies under `agent/profiles/` are the documented source of truth; diff them against live rather than assuming they match (real drift was caught that way on 2026-07-26).
- Per-profile logs live at `%LOCALAPPDATA%\hermes\profiles\<profile>\logs\gateway.log` — not the shared path, which has misled a previous session. Note `session-run.log` stays nearly empty (stdout is unflushed); `gateway.log` is the real one.
- Anthropic credits on this key have run dry repeatedly and caused live outages; top up at console.anthropic.com if replies start failing with a credit error.
- Dev DB currently holds one customer and four listings: 2 `ACTIVE` (Rothschild Boulevard, Neve Tzedek — seeded for testing) and 2 `SOLD` (Ben Gurion, Dizengoff).

### How to Resume

Start a fresh Claude Code session and open with:

> Read session-handoff-2026-07-26.md and continue from where we left off. We're on `main`; the whole marketing-automation roadmap is built and merged as of PR #34, and nothing is blocked on more building. What's left is productionization — see the Next steps in that file — starting with whichever of the two account-level steps (Hetzner, Vercel) I want to authorize first.
