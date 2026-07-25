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

### Progress this continuation, part 2 (2026-07-25) — Phase 1C–1G built + verified

The user said: do the Telegram spike in their own time; **build everything else.** Done. All committed on `feat/buyer-inquiry`.
- **1C schema:** `InquiryStatus` enum + `Inquiry`/`InquiryMessage` (thread key = `hermesSessionId`; msg dedup on `(inquiryId, hermesTurnId, role)`; back-relations on Customer+Listing). Migration `20260725130804_add_inquiries` applied to dev Neon.
- **1D endpoints:** `reporting-app/app/api/listings/buyer-view/route.ts` (all statuses + `status` field), `reporting-app/app/api/inquiries/route.ts` (zod union + optional `sender`/`buyerContact`; per-session upsert; `createMany skipDuplicates`; best-effort area-match listing-link + defer→notify, never fails request); both added to `proxy.ts` public routes.
- **1E plugin:** `agent/plugins/sync-inquiries-to-webapp/` (inbound twin of `sync-to-webapp`; resolves `sender`/`buyerContact` best-effort from hook kwargs, logs kwarg keys once for the Phase-0c spike).
- **1F UI:** `reporting-app/lib/inquiries.ts` (+ shared `replyDefersToOperator` matcher), `app/inquiries/` page+list+`[id]` detail+actions, nav link.
- **1G notification SEAM:** `reporting-app/lib/notify-operator.ts` — **transport is an OPEN DECISION for the user.** Wired for Telegram (recommended, free), inert until `OPERATOR_TELEGRAM_BOT_TOKEN` + `OPERATOR_TELEGRAM_CHAT_ID` are set. Prod multi-tenant needs a `Customer.operatorTelegramChatId` column — NOT added without sign-off. **Decide before 1H live test.**
- **Verified:** `npm run lint`/`build` clean; a throwaway-customer dry-run drove the **real** `/api/inquiries` route + real `getInquiries`/`getInquiry`/`setInquiryHandled` against dev Neon — dedup held, disposition correct, listing-link + contact-capture + cross-customer isolation + buyer-view-all-statuses all passed; cleaned up. (Temp script deleted, not committed.)
- **Note:** had to **restart the 4127 dev server** (killed PID, relaunched `next dev -p 4127` in background — it's up now) because the running server held a stale Prisma client and 500'd on the new `inquiry` model until restart. Lesson recorded in CLAUDE.md.

### Next Step (all remaining items need the live Telegram bot)

1. **Decide the 1G notification transport** (Telegram recommended) — a quick call, unblocks the live test's notification leg.
2. **(When the bot token is ready) Phase 0(a)/(c) + 1H:** stand up a minimal isolated Hermes profile for the throwaway Telegram bot (open allowlist; tools locked to `skills`/`clarify` via `config.yaml`; own skills dir with ONLY `buyer-inquiry` — NOT shared `external_dirs`; plugins `buyer-listings-context` + `sync-inquiries-to-webapp`; locked `USER.md` persona). Message from two accounts; inspect `state.db` to confirm (a) strangers get through, (c) sessions stay isolated (and read the `sync-inquiries` "hook kwargs keys" log line to see what buyer identity is actually available). Then a full end-to-end buyer→dashboard test. **Token still pending from @BotFather; user is doing this in their own time.**

### How to Resume

Start a fresh Claude Code session and open with:

> Read session-handoff-2026-07-25.md and continue from where we left off. We're on branch `feat/buyer-inquiry` building the buyer-inquiry feature; check whether I've got the Telegram test bot token ready, and meanwhile continue writing the buyer-inquiry skill + context plugin (Phase 1A/1B).
