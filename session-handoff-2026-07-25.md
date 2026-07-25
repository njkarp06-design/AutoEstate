## Session Handoff - 2026-07-25

### Task Overview

Building **AutoEstate** (see [CLAUDE.md](CLAUDE.md) — read it first, especially the last two paragraphs of Section 5). This session did two things:
1. **Closed PR #28's turn-two verification** (a leftover from last session) — merged as **PR #32** (docs only).
2. **Planned and started the buyer-inquiry auto-reply feature** — the last and biggest roadmap item. Currently mid-Phase-0. **This is the live thread to resume.**

**Buyer-inquiry in one line:** a prospective *buyer* (a stranger, not the operator) messages a dedicated bot and gets factual answers about a listing 24/7 from real listing data, captured as a reachable lead, with anything human deferred to the operator — a "receptionist, not a closer." It's the first *inbound* feature. Full plan: **`~/.claude/plans/quirky-honking-wave.md`**. Architecture + locked decisions: CLAUDE.md's buyer-inquiry paragraph. Phased checklist: TODO.md item 1.

GitHub repo: https://github.com/njkarp06-design/AutoEstate (private).

### Current git state (IMPORTANT for resuming)

- **On branch `feat/buyer-inquiry`** (created off `main` @ `c42cb10`).
- **CLAUDE.md, TODO.md, session-handoff-2026-07-25.md are MODIFIED but UNCOMMITTED** on this branch — they hold the plan, locked decisions, and Phase-0 findings. Nothing else changed yet (no skill/plugin/app code written this session).
- `main` is clean and up to date; PR #28 (fix) and PR #32 (docs) are both merged.

### Files Modified this session

- **PR #32 (merged to main):** `CLAUDE.md`, `TODO.md`, `session-handoff-2026-07-25.md` — recorded PR #28's turn-two closure + the new `sync-to-webapp`-drops-turns-when-ingest-down known-issue.
- **On `feat/buyer-inquiry` (uncommitted):** same three docs — added the full buyer-inquiry plan, the role-by-channel architecture, locked decisions, and the Phase-0(b)/(d) read-only findings.
- No `agent/` or `reporting-app/` source touched yet.

### Decisions Made (buyer-inquiry)

- **Role-by-channel isolation** is mandatory. The Hermes sender allowlist is a hard gate *inside the vendored adapter*, upstream of every hook/skill, and sender identity is NOT passed to hooks; there's no inbound-auth or send/approval hook, and the adapter isn't patchable (upstream image). So buyers CANNOT share the operator's number — a **separate, locked-down buyer instance** (only the `buyer-inquiry` skill; dangerous built-in tools denied) is the only safe design. One buyer-bot **per customer** (each answers only that customer's listings), alongside their existing operator bot.
- **Two-layer safety** (a self-review correction of an initial overstatement): skill-layer lockdown (only the buyer skill loaded) is airtight by construction, but the **tool layer is orthogonal** — built-in tools (terminal/file/etc.) must be explicitly denied or a public instance is an RCE surface.
- **Locked with the user:** fully-automatic replies (per-reply approval isn't possible anyway); lead priority = **capture buyer contact > notify operator > dashboard**; **verify-first sequencing**.
- **Multi-tenant:** production = 2 instances per customer (operator + buyer); needs a 2nd phone number per customer (deferred to production).

### Errors Hit / findings

- No blocking errors. Notable finding recorded as a known-issue: `sync-to-webapp` silently drops a turn if the ingest server is unreachable (no retry) — matters before the production Vercel deploy.

### Current State — Phase 0 (verify blockers) is HALF DONE

Two of four must-verifies resolved **read-only** (no live bot needed):
- ✅ **(d) Tool lockdown works via `config.yaml` alone — no adapter patching.** Per-platform `platform_toolsets.<platform>` + global `agent.disabled_toolsets`. Lock the buyer instance to a minimal set (`skills`, maybe `clarify`) and exclude `terminal`/`file`/`code_execution`/`browser`/`web`/`computer_use`/`delegation`/`cronjob`/`memory`/`image_gen`. Toolset registry: `hermes_cli/tools_config.py` `CONFIGURABLE_TOOLSETS` (in the installed Hermes at `%LOCALAPPDATA%\hermes\hermes-agent`).
- ✅ **(b) Buyer-contact capture is viable via a read-only `state.db` `sessions` read.** No `sender` column — identity is in `id`/`user_id`/`chat_id`/`display_name`/`origin_json`. Real WhatsApp session had `display_name`="Natanel Karp" + a 19-char `user_id`. **Caveat to confirm live:** that `user_id` looks like a WhatsApp **LID, not a dialable phone** — a lead may carry a stable id + name but not always a callable number.

Still pending, **blocked on a live Telegram test bot** the user is creating right now via @BotFather:
- ⬜ **(a)** Does an open channel actually admit non-operator senders? (empty allowlist = allow-all vs block-all.)
- ⬜ **(c)** Do two distinct senders get isolated sessions, or collide? (decides the inquiry thread key: session vs sender.)
- The user is creating the throwaway bot now; token pending. They were also asked whether they can get a **second Telegram account** for the two-sender isolation test (unanswered).

**Environment:** reporting-app dev server is running on **127.0.0.1:4127**. Anthropic API credits were topped up earlier this session. `autoestate` gateway is running (operator profile) — untouched by this work.

### Progress this continuation (2026-07-25, later)

**Phase 1A + 1B written, and the CHECKPOINT passed via `hermes -z`.** Committed on `feat/buyer-inquiry`.
- **1A** `agent/skills/real-estate/buyer-inquiry/SKILL.md` (v0.1.0) — conversational (no 3-platform format, no Listing Record footer); answers ONLY from the injected "Available listings" block (never memory/guess); match-one / ask-one-if-ambiguous / defer-if-absent; status honesty (never call SOLD/UNDER_CONTRACT available); mirror the buyer's language; **canonical defer sentence** in HE + EN that must appear verbatim (the 1D display heuristic will key on it — coupling documented in the skill); lead capture (ask for contact once on defer); prompt-injection resistance.
- **1B** `agent/plugins/buyer-listings-context/` (`__init__.py` + `plugin.yaml`, syntax-checked) — cousin of `active-listings-context` but **always-on (no keyword gate)**, platform-gated `{whatsapp,telegram}`, reads `/api/listings/buyer-view` (derived from `AUTOESTATE_INGESTION_URL`), injects each listing WITH status; empty → explicit "no listings, defer"; any fetch failure → `None` (skill then defers — safe). **`/api/listings/buyer-view` doesn't exist yet (that's 1D)**, so a live fetch 404s→`None` until built; harmless, and `hermes -z` is `cli` so the plugin doesn't fire there anyway (simulate the block in the prompt).
- **Checkpoint 5/5** (simulated context, `autoestate` profile): ACTIVE answer+lead; SOLD honesty + exact EN defer sentence; Hebrew reply + parking-deferred-not-invented + exact HE defer sentence; prompt-injection fully refused; ambiguous → one clarifying question. Routing picked `buyer-inquiry` every time. **Caveat:** the injection test proves the *skill/prompt* layer only — tool-layer lockdown (deny built-in tools) is still the 1H/Phase-2 gate.

### Next Step

1. **(When the user's bot token is ready) Run Phase 0(a)/(c):** stand up a minimal isolated Hermes profile for the throwaway Telegram bot (open allowlist; tools locked to `skills`/`clarify`; own skills dir with ONLY the buyer skill — NOT the shared `external_dirs`), have the user drop the token into its `.env`, message it from two accounts, inspect `state.db` to confirm (a) strangers get through and (c) sessions stay separate. **Token was NOT provided in this session — still pending from @BotFather.**
2. **Build the plumbing (1C–1G):** schema (`Inquiry`/`InquiryMessage`), the two endpoints (`/api/inquiries` + `/api/listings/buyer-view`) + `proxy.ts` public routes, `sync-inquiries-to-webapp` plugin, `/inquiries` UI, operator notification. Then stand up the dev buyer instance (1H) and test end-to-end via Telegram.

### How to Resume

Start a fresh Claude Code session and open with:

> Read session-handoff-2026-07-25.md and continue from where we left off. We're on branch `feat/buyer-inquiry` building the buyer-inquiry feature; check whether I've got the Telegram test bot token ready, and meanwhile continue writing the buyer-inquiry skill + context plugin (Phase 1A/1B).
