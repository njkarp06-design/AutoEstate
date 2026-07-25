## Session Handoff - 2026-07-25

### Task Overview

Building **AutoEstate** (see [CLAUDE.md](CLAUDE.md) — read it first, especially the buyer-inquiry paragraphs at the end of Section 5). The live thread is the **buyer-inquiry auto-reply** feature — the last and biggest roadmap item, and the first **inbound** one.

**Buyer-inquiry in one line:** a prospective *buyer* (a stranger, not the operator) messages a dedicated bot and gets factual answers about a listing 24/7 from real listing data, captured as a reachable lead, with anything human deferred to the operator — a "receptionist, not a closer." Full plan: **`~/.claude/plans/quirky-honking-wave.md`**. Architecture + locked decisions: CLAUDE.md's buyer-inquiry paragraphs. Phased checklist: TODO.md item 1.

GitHub repo: https://github.com/njkarp06-design/AutoEstate (private).

### Current state at a glance

- **Branch `feat/buyer-inquiry`** (off `main` @ `c42cb10`), **7 commits ahead of main, all pushed, working tree clean.** No open PR yet (correct — the feature isn't finished; don't merge until 1H + the spike are done). The two most recent commits are docs-only (2026-07-25 continuation session): the **buyer-channel transport open decision** (two channels forced per customer — see CLAUDE.md's buyer-inquiry section + TODO's "OPEN DECISION" block: 2nd eSIM vs official Cloud API vs non-WhatsApp, deferred to deployment) and a **skill-version doc-drift correction** (PR #26's locator feature had bumped `just-sold`/`listing-reengagement` to v0.2.0 and `listing-status-update` to v0.4.0 without the docs recording the numbers — now fixed, and logged as a known issue in TODO). No feature code changed in this continuation session.
- **Phase 1A–1G: built, verified, committed, pushed.** The skill, the context plugin, the full reporting pipeline (schema → endpoints → sync plugin → dashboard), and the Telegram operator-notification with per-customer routing all done.
- **Live Telegram spike (Phase 0a/c): RUN and PASSED 2026-07-25.** A throwaway `spike` profile (`@autoestate_spike_bot`, `TELEGRAM_ALLOWED_USERS=*`, `disabled_toolsets` lockdown, no real skills) was stood up; the user messaged from their own phone and their flatmate's. Results: **(a)** a non-operator got a real agent reply → open channel works with no pairing (use explicit `*`, not empty, to skip the pairing flow); **(c)** the two senders got two isolated sessions keyed `agent:main:telegram:dm:<user_id>` → the `hermesSessionId` thread key is correct, no schema change; **(b) bonus** Telegram gave a stable numeric `user_id` + `display_name` but no phone (same "id+name, no callable number" shape as WhatsApp). The spike profile was **deleted** immediately after; `default` + `autoestate` untouched. **User still to `/revoke` the spike bot token in BotFather.**
- **What remains: only 1H (the dev buyer instance).** Now UNBLOCKED. Needs no new token from the user — reuses what the spike proved.

### Phase 0 — verify blockers — ALL FOUR RESOLVED 2026-07-25

- ✅ **(a) Open channel admits strangers, no pairing.** Live spike: a throwaway profile with `TELEGRAM_ALLOWED_USERS=*` replied to a non-operator (the flatmate, never allowlisted). Code note: an *empty* allowlist passes the intake prefilter (`adapter._is_user_authorized_from_message` returns `True`) but then routes unknown DMs into a **pairing flow** — so the buyer instance must use explicit `*`, not empty, to skip pairing. Re-confirm on WhatsApp before production (spike was Telegram only).
- ✅ **(b) Buyer-contact capture** viable via a read-only `state.db` `sessions` read — no `sender` column; identity is in `id`/`user_id`/`chat_id`/`display_name`/`origin_json`. Confirmed live on **Telegram** too: `display_name`="Natanel Karp" + numeric `user_id`=`8543293827` (a Telegram id, not a phone). **Caveat holds on both platforms:** a lead carries a stable id + name but **not a callable number** (WhatsApp = LID, Telegram = numeric id) — ask for a phone if a callback number is wanted.
- ✅ **(c) Isolated sessions, no collision.** Live spike, two real senders → two separate sessions keyed `agent:main:telegram:dm:<user_id>` (Natanel `8543293827`, flatmate Maxime `5353927310`). So the current schema's `hermesSessionId` thread key is correct — **no `@@unique` change needed.**
- ✅ **(d) Tool lockdown** works via `config.yaml` alone, no adapter patching — per-platform `platform_toolsets.<platform>` + global `agent.disabled_toolsets`; lock the buyer instance to `skills`/`clarify` and exclude `terminal`/`file`/`code_execution`/`browser`/`web`/`computer_use`/`delegation`/`cronjob`/`memory`/`image_gen`. Registry: `hermes_cli/tools_config.py:CONFIGURABLE_TOOLSETS`. Incidentally exercised live (locked spike config; flatmate typed "spend money" — nothing happened).
- Spike hygiene (done): known accounts only, locked-down throwaway `spike` profile, bot link never broadcast, profile deleted right after, and the spike bot token **revoked** by the user in @BotFather (2026-07-25). No spike artifacts remain.

### What was built (Phase 1A–1G) — all on `feat/buyer-inquiry`

- **1A** `agent/skills/real-estate/buyer-inquiry/SKILL.md` (v0.1.0) — conversational (no 3-platform format, no Listing Record footer); answers ONLY from the injected "Available listings" block; match-one / ask-one-if-ambiguous / defer-if-absent; status honesty (never call SOLD/UNDER_CONTRACT available); mirrors the buyer's language; **canonical defer sentence** HE+EN that must appear verbatim (the dashboard heuristic keys on it — coupling documented in the skill and in `lib/inquiries.ts`); lead capture on defer; prompt-injection resistance.
- **1B** `agent/plugins/buyer-listings-context/` — always-on (no keyword gate), platform-gated `{whatsapp,telegram}`, reads `/api/listings/buyer-view`, injects each listing WITH status; empty → "no listings, defer"; any failure → `None` (skill then defers — safe).
- **CHECKPOINT** — skill proven via `hermes -z`, 5/5 (ACTIVE answer+lead; SOLD honesty + exact EN defer sentence; Hebrew reply + parking-deferred-not-invented + exact HE defer sentence; prompt-injection fully refused; ambiguous → one clarifying question). Routing picked `buyer-inquiry` every time. **Caveat:** injection test proves the *skill/prompt* layer only — tool-layer lockdown is still the 1H/Phase-2 gate.
- **1C** schema — `InquiryStatus` enum + `Inquiry`/`InquiryMessage` (thread key = `hermesSessionId`, one Inquiry per buyer conversation; msg dedup on `(inquiryId, hermesTurnId, role)`; back-relations on Customer+Listing). Migration `20260725130804_add_inquiries`.
- **1D** endpoints — `app/api/listings/buyer-view/route.ts` (all statuses incl. `status`) + `app/api/inquiries/route.ts` (zod union + optional `sender`/`buyerContact`; per-session upsert; `createMany skipDuplicates`; best-effort area-match listing-link + defer→notify, never fails the request); both added to `proxy.ts` public routes.
- **1E** plugin — `agent/plugins/sync-inquiries-to-webapp/` (inbound twin of `sync-to-webapp`; resolves `sender`/`buyerContact` best-effort from hook kwargs; **logs `hook kwargs keys = [...]` once** for the Phase-0c spike to read).
- **1F** UI — `lib/inquiries.ts` (getInquiries/getInquiry/setInquiryHandled + the shared `replyDefersToOperator` matcher the ingest route reuses); `app/inquiries/` page+list (stat strip Total/Auto-answered/Need you/by-channel + search/status filter) + `[id]` detail (buyer contact, linked listing, RTL-aware thread, Mark handled) + actions; nav link in `layout.tsx`.
- **1G** notification — **transport = Telegram (user-approved).** `lib/notify-operator.ts` fires best-effort on a deferring reply, buyer contact attached. Per-customer routing: `Customer.operatorTelegramChatId` (migration `20260725141319_add_operator_telegram_chat_id`), set on the **Settings page** ("Buyer-lead alerts" section, digits-only validation, blank = dashboard-only), delivered via one shared `OPERATOR_TELEGRAM_BOT_TOKEN` notifier bot; env `OPERATOR_TELEGRAM_CHAT_ID` is a dev fallback only. **Inert until the bot token env + a customer chat id exist.**

**Verification:** `npm run lint`/`build` clean; a throwaway-customer dry-run drove the **real** `/api/inquiries` route + real read layer against dev Neon (dedup held, disposition correct, listing-link + contact-capture + cross-customer isolation + buyer-view-all-statuses all passed); chat-id setter round-trip verified. All temp scripts deleted (not committed).

### Environment notes

- **Reporting-app dev server is running on `127.0.0.1:4127`** (background). It was restarted twice this session after Prisma migrations — the generated client loads at server *start*, not via hot-reload, so a new-model query 500s until restart (lesson in CLAUDE.md). Always test locally via `127.0.0.1`, not `localhost` (IPv6 collision on this machine).
- `autoestate` gateway (operator profile) is running — **untouched by this work.** The buyer instance (1H) will be a *separate* profile.
- Dev Neon DB is the reporting-app's `DATABASE_URL` in `reporting-app/.env.local`; both new migrations are applied to it.

### Next steps (in order)

1. ~~Run the live spike (Phase 0 a/c)~~ **DONE 2026-07-25 — passed** (see Phase 0 above). Both (a) and (c) green; no schema change.
2. **1H — stand up the DEV buyer instance (the only remaining build step):** a *separate* Hermes profile/data dir — `TELEGRAM_ALLOWED_USERS=*` (explicit allow-all, proven by the spike; NOT empty, which triggers the pairing flow); built-in tools locked via `config.yaml` `agent.disabled_toolsets` (exclude `terminal`/`file`/`code_execution`/`browser`/`web`/`computer_use`/`delegation`/`cronjob`/`memory`/`image_gen`); **its own skills dir with ONLY `buyer-inquiry`** (NOT the shared `external_dirs`, which holds all 5 outbound skills — reusing it would break isolation); plugins `buyer-listings-context` + `sync-inquiries-to-webapp` copied in + enabled; a locked `USER.md`/`SOUL.md` persona; `.env` reuses the customer's ingestion secret + points at the local reporting app (4127). Then a full end-to-end buyer→dashboard test. **Needs no new token from the user** — a fresh throwaway Telegram bot for the dev instance is enough (or reuse a new BotFather bot). The `spike` profile pattern (config.yaml + .env) is a working template; the deleted spike showed the exact steps.
3. **(Deployment, non-blocking) Notifier bot:** create the Telegram alert bot, set `OPERATOR_TELEGRAM_BOT_TOKEN`, paste a chat id in Settings — needed before a real lead *push* works (the dashboard already records leads regardless).
4. **After 1H:** open the PR into `main` (don't auto-merge — confirm first, per the standing rule).

**Spike bot token:** revoked by the user in @BotFather (2026-07-25) — no longer valid, nothing outstanding.

### How to Resume

Start a fresh Claude Code session and open with:

> Read session-handoff-2026-07-25.md and continue from where we left off. We're on branch `feat/buyer-inquiry`; buyer-inquiry Phase 1A–1G is built and the live Telegram spike (Phase 0 a/c) passed — all four Phase-0 blockers are green. Stand up the dev buyer instance (1H): a separate locked-down Hermes profile with only the buyer-inquiry skill + the two buyer plugins, then run an end-to-end buyer→dashboard test.
