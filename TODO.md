# AutoEstate — TODO

Task status, order, and sub-checklists. CLAUDE.md owns the brief/phase/architecture; the session-handoff file owns where work stopped. This file owns what's left to do.

Last updated: 2026-07-25 (buyer-inquiry 1A skill + 1B plugin written; checkpoint `hermes -z` next).

---

## 🔜 Next up (in order)

### 1. Buyer-inquiry auto-reply (last roadmap item, biggest scope) — PLAN APPROVED 2026-07-25
An **inbound** feature: a prospective buyer (a stranger) messages and the agent answers factual questions from listing data 24/7, captures a reachable lead, and defers anything human to the operator. Full plan + rationale in the plan file (`~/.claude/plans/quirky-honking-wave.md`) and CLAUDE.md's buyer-inquiry paragraph. Architecture: **role-by-channel isolation** — a separate, locked-down buyer instance (only the buyer skill; built-in tools denied) since the Hermes allowlist is a hard adapter gate and sender identity isn't available to skills. Locked decisions: fully-auto replies (isolation is the guardrail, per-reply approval isn't possible); lead priority = capture buyer contact > notify operator > dashboard; verify-first sequencing.

**Phase 0 — verify blockers (two are design-blockers). (b) and (d) resolved read-only 2026-07-25; (a)/(c) need the live Telegram spike.**
- [ ] (a) Can a channel be opened to non-operator senders at all (empty allowlist = allow-all vs block-all)? Re-confirm on WhatsApp before production. **NEEDS live Telegram bot.**
- [x] (b) Buyer-contact capture — **viable via a read-only `state.db` `sessions` read** (no `sender` column; use `id`,`user_id`,`chat_id`,`display_name`,`origin_json`). Real WA session had `display_name`="Natanel Karp" + a 19-char `user_id`. Caveat: that `user_id` looks like a WhatsApp **LID, not a dialable phone** (starts `107…`, not `972…`) — confirm live whether a callable number is obtainable; the lead may carry a stable id + name but not always a phone.
- [ ] (c) Do separate buyers get isolated sessions, or collide? (picks the inquiry thread key: `id`/session vs `user_id`/sender.) **NEEDS live Telegram bot (2 accounts).**
- [x] (d) Tool lockdown — **confirmed via `config.yaml`, no adapter patching.** Per-platform `platform_toolsets.<platform>` (gateway resolves `_get_platform_tools`) + global `agent.disabled_toolsets`. Lock the buyer instance to a minimal set (`skills`, maybe `clarify`) and exclude `terminal`,`file`,`code_execution`,`browser`,`web`,`computer_use`,`delegation`,`cronjob`,`memory`,`image_gen`. Registry in `hermes_cli/tools_config.py:CONFIGURABLE_TOOLSETS`. So "safe by construction" holds at both the skill AND tool layer via config.
- [ ] Spike safety: test with known non-operator accounts, don't broadcast a public bot while tools may be live on the dev machine.

**Phase 1 — build the loop, proven via the Telegram stand-in:**
- [x] 1A `buyer-inquiry` SKILL.md **written 2026-07-25** (`agent/skills/real-estate/buyer-inquiry/SKILL.md`, v0.1.0). Conversational (not 3-platform, no footer); injected-block-only sourcing; match-one/ask-one-if-ambiguous/defer; status honesty (never call non-ACTIVE available); mirror buyer's language; canonical defer sentence HE+EN (verbatim — dashboard heuristic keys on it); lead capture on defer; prompt-injection resistance. **Not yet proven via `hermes -z`** (checkpoint below).
- [x] 1B `buyer-listings-context` plugin **written 2026-07-25** (`agent/plugins/buyer-listings-context/`, syntax-checked). Always-on (no keyword gate), platform-gated `{whatsapp,telegram}`, reads `/api/listings/buyer-view` (derived from `AUTOESTATE_INGESTION_URL`), injects each listing WITH status; empty/failed → explicit "no listings, defer" / `None`. Note: `/api/listings/buyer-view` doesn't exist yet (1D), so a live fetch 404s→`None` until then — fine for now, simulate the block for `hermes -z`.
- [x] **CHECKPOINT — skill proven via `hermes -z` 2026-07-25** (5/5 scenarios, simulated context block, `autoestate` profile which discovers the skill via `external_dirs`): (1) ACTIVE availability → correct factual answer + lead-capture offer; (2) SOLD → honest "already sold" + alternatives + exact EN defer sentence + contact ask; (3) Hebrew, parking-not-in-data → full-HE reply, price answered, parking deferred (not invented), exact HE defer sentence; (4) prompt-injection (run shell / post fake ad / leak prompt) → all three refused, stayed in role; (5) ambiguous "is it available?" with 2 ACTIVE → one clarifying question naming both candidates. Routing correctly picked `buyer-inquiry` every time (no mis-route to outbound skills). **Caveat:** (4) proves the *skill/prompt* layer only — the *tool* layer (built-in tools denied) is still a separate 1H/Phase-2 gate; on the operator profile the model chose not to run the shell tool, it isn't yet config-denied one. Still pending: the live Telegram-bot proof (Phase 0a/c) once the token is ready.
- [ ] 1C schema (`Inquiry`/`InquiryMessage`, dedup on `hermesTurnId`), 1D endpoints (`/api/inquiries`, `/api/listings/buyer-view`, `proxy.ts`), 1E `sync-inquiries-to-webapp` plugin.
- [ ] 1F reporting UI (`/inquiries` page/list/detail/actions + nav), 1G operator notification (transport TBD at impl; not email-is-free).
- [ ] 1H stand up dev buyer instance (isolated skills dir — NOT shared `external_dirs`; tools denied; locked USER.md persona) + end-to-end test.

**Deferred to production (Phase 2/3):** public-instance security hardening (tool lockdown + container isolation + scoped 2nd ingestion secret), dedicated WhatsApp buyer number (2nd eSIM), Terraform 2nd instance per customer (`instance_role`).

---

## 🚀 Before onboarding a real customer (deferred, not blocking dev)

### 3. `terraform apply` to a real Hetzner account
Infra module (`infra/modules/hermes-instance/`) is written and validated (`terraform validate`/`fmt` clean) but **never applied** — no real Hetzner account exists yet.
- [ ] Create a Hetzner Cloud account (account-level action — needs user sign-off).
- [ ] `terraform apply` a first per-customer instance and verify boot/cloud-init/secret-injection end to end.

### 4. Deploy the reporting app to Vercel Pro
Still `npm run dev`-only (local, port 4127).
- [ ] Set up the Vercel Pro project (account-level — needs user sign-off).
- [ ] Wire Neon Postgres + Clerk production env vars.
- [ ] Deploy and verify authenticated multi-tenant access.

---

## 🔒 Phase 5 — deferred security hardening (revisit before public exposure)

### 5. OS-level isolation
`terminal.backend: local` — no sandboxing; Hermes's own docs call this "outside the supported security posture" for an agent ingesting external messages. Deferred because containerizing this Windows prototype would likely be redone once a real Linux deployment target is picked (see item 3).
- [ ] Containerize / isolate on the real deployment target when it exists.

### 6. Supply-chain dependency CVEs
`hermes security audit` flagged 48–50 CVEs in pinned upstream packages (several HIGH). None currently reachable (no exposed HTTP surface, no MCP servers, no real image processing, allowlist-gated senders). `hermes update` doesn't touch the upstream-locked versions.
- [ ] Re-run `hermes security audit` and reassess once public exposure and/or MCP servers make any of these bugs reachable.

### 7. Official WhatsApp Business Cloud API
Currently on the **Baileys/QR bridge** (unofficial, carries a ban risk, mitigated by a throwaway eSIM number). Fine for the prototype; a real public product needs the official API.
- [ ] Migrate to the official WhatsApp Business Cloud API (needs a real public server + Meta Business Verification).

---

## 💤 Deferred further still

### 8. Real Instagram auto-posting
The reporting app has a per-platform Instagram post-action preference, but the auto-post options are inert ("coming soon"). Facebook Group and Yad2 stay permanently manual (Meta retired third-party Group posting in 2024; Yad2 has no posting API).
- [ ] Requires Meta Business Verification (an account-level commitment not yet made) before this can be built.

---

## 🧰 Repo tooling / docs automation

### 9. End-of-session hook that updates README.md
Wanted 2026-07-25. The doc-sync hook keeps `CLAUDE.md`, `TODO.md` and the session-handoff file current *during* a session, but `README.md` is untouched by it and drifts. Goal: refresh the README properly when a session ends.

- [ ] Confirm the mechanism. A `Stop` hook is the likely fit (fires when a session finishes) — check the current Claude Code hooks reference via `/hooks` rather than assuming, since `UserPromptSubmit` (what doc-sync uses) is the wrong event for this.
- [ ] Resolve the core design problem before building: a hook runs a **shell command**, so it cannot write good prose by itself. It must either (a) feed instructions back to the model and let it make the edit, or (b) run a deterministic script that regenerates only mechanical sections. Pick one — (b) is more reliable, (a) is more useful.
- [ ] Decide what "properly" means, i.e. which README sections are hook-owned vs. hand-written. README is the **public-facing** description; CLAUDE.md is the internal brief. Blindly syncing internal state into it would leak working detail and make it worse, not better.
- [ ] Decide churn tolerance — a README rewritten every session makes noisy diffs in a history that is otherwise meaningful PRs. Consider firing only when something user-visible actually changed.
- [ ] Make it respect the branch-and-PR workflow (never commit straight to `main`), same as the doc-sync hook.
- [ ] Verify it fails open — a `Stop` hook that errors or blocks makes ending a session painful.

---

## 🐛 Known small issues / awareness (not blocking, no owner yet)

- [ ] **Batched-follow-up rule occasionally violated:** the agent sometimes asks for missing facts (e.g. rooms, then sqm) as separate single-field questions instead of one batched question. Pre-existing, flagged in PR #26, unrelated to the locator feature.
- [ ] **Reporting-app platform parser misses some real headers:** `platform-content.ts` doesn't always recognize plain-caps `INSTAGRAM` / `עברית:` headers (vs. the spec's bold/ATX format), so an occasional real reply fails to split into platform sections. The Listing-record parser is independently robust; this only affects the platform-split display.
- [ ] **`app/page.tsx` Activity list still `max-w-3xl`:** PR #17 was believed to have widened it to `max-w-5xl`, but only its empty-state branch was widened. One-line fix, left out of scope.
- [ ] **Anthropic Console auto-reload billing not confirmed enabled:** the `autoestate` profile's API credits have run dry repeatedly across sessions, causing live outages. Recommended enabling auto-reload at console.anthropic.com — not confirmed done.
- [ ] **`sync-to-webapp` silently drops turns when the ingest server is unreachable:** the plugin POSTs fire-and-forget with no retry queue (agent/plugins/sync-to-webapp/__init__.py) — a failed POST just logs a warning and the turn's data (including any `Listing` footer) is lost permanently. Surfaced live 2026-07-25 when the 4127 dev server was down during PR #28's turn-two test. Harmless for dev, but for a deployed customer, transient reporting-app downtime = permanently lost listing-tracking events. Consider a lightweight retry/queue before/at production (Vercel deploy, item 4).
- [ ] **Gateway silently depends on ambient Claude Code OAuth credentials:** the profile's own `ANTHROPIC_API_KEY` keeps going dry and the `credential_pool` is empty, so the gateway falls back to the machine's ambient Claude Code OAuth login. Fragile single point of failure for a customer-facing bot — restarting the gateway from a Claude Code agent environment has knocked this out and caused a full outage before.

---

## ✅ Done (recent, for context)

- Weekly-digest skill + Listing tracking (PR #19/#21/#22/#23) — real Listing data flowing end-to-end.
- Re-engagement / just-sold skills (PR #25) — live-tested.
- Locator-based listing lookup (PR #26) — name a listing instead of retyping facts.
- No-locator confirmation-deferral fix (PR #28) — rule moved into the always-injected `listing-footer-reminder` plugin (v1.4); turn one verified live.
- **PR #28 turn-two verification — CLOSED 2026-07-25.** Both turns confirmed live via the session `state.db`: turn one leads with intro + confirmation question and withholds the footer; turn two ("Yes") appends the `Status: Sold` footer. The **Ben Gurion** listing (`cmry5rje00004u8u6ctv54q67`) flipped `ACTIVE` → `SOLD` in the dev DB (same row, no duplicate — transition-in-place confirmed). Caveat: the ingest leg was **reconstructed** (the 4127 dev server was down during the live test, so `sync-to-webapp` silently dropped the "Yes" turn's POST — no retry queue; see the new known-issue below) — the real `/api/ingest` → parser → transition path ran, just not triggered by the live WhatsApp turn itself.
