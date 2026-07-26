# AutoEstate — TODO

Task status, order, and sub-checklists. CLAUDE.md owns the brief/phase/architecture; the session-handoff file owns where work stopped. This file owns what's left to do.

Last updated: 2026-07-26 (**PR #34 MERGED — buyer-inquiry shipped, and with it the whole marketing-automation roadmap.** Nothing is blocking; everything left is productionization (Hetzner, Vercel, the public instance's security gates, the WhatsApp re-confirmation, and the buyer-channel transport decision). PR #33 closed — its `Stop`-hook mechanism conflicts with the hook removal. The dev buyer bot has been stopped.)

Previously: 2026-07-25 (live Telegram spike RUN + PASSED — Phase 0 (a) and (c) both resolved: open channel via `TELEGRAM_ALLOWED_USERS=*` admits strangers with no pairing; two senders get isolated per-user sessions so the `hermesSessionId` thread key stands. All 4 Phase-0 blockers now green; 1H is the only remaining buyer-inquiry build step. Also earlier: 1A–1G built + verified, Telegram notify with per-customer routing; buyer-channel transport open decision; skill-version doc-drift correction).

---

## 🔜 Next up (in order)

### 1. Nothing is blocking. The roadmap is done.

Buyer-inquiry shipped on 2026-07-26 (PR #34), which was the last item on the marketing-automation roadmap. Every roadmap feature — listing-to-social, status updates, just-sold, re-engagement, locator lookup, weekly digest, and the buyer-facing receptionist — is built, live-tested and merged.

**What remains is productionization, not features.** It is all listed below and none of it is blocked on more building. The shortest path to a real pilot customer:

1. `terraform apply` to a real Hetzner account (item 3) — needs an account, an account-level action.
2. Deploy the reporting app to Vercel Pro (item 4) — also account-level.
3. The public buyer instance's production security gates (items 5 and 6): container isolation, a scoped second ingestion secret so the buyer box does not hold one that can write to `/api/ingest`, and re-running `hermes security audit` once anything is publicly exposed.
4. Re-confirm open-channel behaviour on **WhatsApp** — the spike and both live tests proved Telegram only.
5. Settle the **buyer-channel transport** open decision below.

Also outstanding and non-blocking: create the Telegram notifier bot and set `OPERATOR_TELEGRAM_BOT_TOKEN` so operator lead alerts actually push (the dashboard records leads either way).


**Deferred to production (Phase 2/3):** public-instance security hardening (container isolation + a scoped 2nd ingestion secret — the tool-lockdown half is done and shipped in PR #34), and a Terraform 2nd instance per customer (`instance_role`).

**OPEN DECISION — buyer-channel transport (per customer).** The buyer receptionist must be a *separate channel* from the operator's outbound bot — this is forced, not a preference: the Hermes allowlist is a hard adapter gate and sender identity isn't available to skills, so buyers cannot share the operator's number without exposing the outbound, DB-mutating skills (`just-sold`/price-drops) to strangers. So each fully-provisioned customer has **two channels**: the operator's outbound number (they message it) and a public buyer-facing channel (strangers message it). What that buyer channel *is* is still undecided:
  - **(i) 2nd WhatsApp eSIM per customer (Baileys)** — matches the rest of the prototype; but the Baileys ban risk now applies to a *public-facing* number strangers hit (materially riskier than the operator number only the operator messages), plus another eSIM to provision/pair/babysit per customer. Fine for the **pilot**.
  - **(ii) Official WhatsApp Business Cloud API** — the right long-term home for a public receptionist: no ban risk, uses the number the customer already advertises. Costs Meta Business Verification per customer + real per-message pricing. Overlaps with item 7 (currently scoped there only for the *operator* side; the *buyer* side is the stronger reason to migrate, since it's the public one that can't be a throwaway).
  - **(iii) Non-WhatsApp buyer channel** (Telegram bot / web-chat widget linked from the Instagram/Yad2 ad) — zero WhatsApp numbers, no ban risk; but loses "reply on WhatsApp," the native local buyer behavior.
  - Leaning: **(i) for the pilot, (ii) at scale for the buyer side specifically.** Decide at deployment; the buyer instance itself is transport-agnostic so no code depends on this yet.

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

### 9. Keep README.md from drifting
Wanted 2026-07-25; reframed 2026-07-26. `README.md` is the **public-facing** description of AutoEstate and nothing keeps it current, so it drifts behind the real state of the project.

Originally scoped as an end-of-session `Stop` hook. **That mechanism is dropped** — all hooks were removed from this repo on 2026-07-26 (see CLAUDE.md section 3). The refresh is now ordinary work, done the same way the other docs are maintained: when something user-visible actually changes, update it, in a normal commit on a feature branch.

The thinking already done here still applies and is the real content of this item:
- [ ] Decide which README sections are maintained vs. hand-written-and-left-alone. README is public-facing; CLAUDE.md is the internal brief. Blindly syncing internal state into it would leak working detail and make it worse, not better.
- [ ] Only refresh when something **user-visible** actually changed — not every session. A README rewritten constantly makes noisy diffs in a history that is otherwise meaningful PRs.
- [ ] Same git workflow as everything else: feature branch and PR, never straight to `main`.
- [ ] Do a first pass to see how far it has actually drifted — it has not been reviewed since well before the multi-tenant pivot, the reporting-app redesign, or any of the buyer-inquiry work.

---

## 🐛 Known small issues / awareness (not blocking, no owner yet)

- [x] ~~Disambiguation menu lists SOLD listings without marking them~~ **FIXED 2026-07-26, `buyer-inquiry` v0.2.0.** Anything the skill offers unprompted is now `ACTIVE`-only, with two new branches (exactly one ACTIVE = nothing to disambiguate; nothing ACTIVE = say so plainly and defer). Verified via `hermes -z` on the real four-listing data, including the regression that mattered — a buyer who *names* a sold property still gets the honest answer plus alternatives and the verbatim defer sentence.
- [ ] **Command-refusal text leaks internal config vocabulary at strangers:** a denied command replies "ask an admin to add you to `allow_admin_from` or set `user_allowed_commands`". Vendored gateway text, so changing it means patching code an upstream `hermes update` would overwrite. Low impact now that `/start` is allowed and buyers rarely trigger commands.
- [ ] **The sync plugin sends a `sender` field that nothing stores:** `/api/inquiries` accepts it, but the `Inquiry` model has no such column (the thread key is `hermesSessionId` by design). Harmless dead weight; either persist it or drop it from the payload.

- [ ] **Batched-follow-up rule occasionally violated:** the agent sometimes asks for missing facts (e.g. rooms, then sqm) as separate single-field questions instead of one batched question. Pre-existing, flagged in PR #26, unrelated to the locator feature.
- [ ] **Reporting-app platform parser misses some real headers:** `platform-content.ts` doesn't always recognize plain-caps `INSTAGRAM` / `עברית:` headers (vs. the spec's bold/ATX format), so an occasional real reply fails to split into platform sections. The Listing-record parser is independently robust; this only affects the platform-split display.
- [ ] **`app/page.tsx` Activity list still `max-w-3xl`:** PR #17 was believed to have widened it to `max-w-5xl`, but only its empty-state branch was widened. One-line fix, left out of scope.
- [ ] **Anthropic Console auto-reload billing not confirmed enabled:** the `autoestate` profile's API credits have run dry repeatedly across sessions, causing live outages. Recommended enabling auto-reload at console.anthropic.com — not confirmed done.
- [ ] **`sync-to-webapp` silently drops turns when the ingest server is unreachable:** the plugin POSTs fire-and-forget with no retry queue (agent/plugins/sync-to-webapp/__init__.py) — a failed POST just logs a warning and the turn's data (including any `Listing` footer) is lost permanently. Surfaced live 2026-07-25 when the 4127 dev server was down during PR #28's turn-two test. Harmless for dev, but for a deployed customer, transient reporting-app downtime = permanently lost listing-tracking events. Consider a lightweight retry/queue before/at production (Vercel deploy, item 4).
- [ ] **Gateway silently depends on ambient Claude Code OAuth credentials:** the profile's own `ANTHROPIC_API_KEY` keeps going dry and the `credential_pool` is empty, so the gateway falls back to the machine's ambient Claude Code OAuth login. Fragile single point of failure for a customer-facing bot — restarting the gateway from a Claude Code agent environment has knocked this out and caused a full outage before.
- [ ] **Skill `version:` fields drift from the docs — no cross-check:** the doc discipline keeps docs *current* as changes happen but nothing re-verifies on-disk `version:` frontmatter against CLAUDE.md's stated versions. Caught 2026-07-25: `just-sold`/`listing-reengagement` were on-disk `0.2.0` (docs said v0.1.0) and `listing-status-update` `0.4.0` (docs said v0.3.0) — all bumped by PR #26 but recorded in prose without the numbers. Corrected in CLAUDE.md's PR #26 paragraph. Consider a periodic `grep '^version' agent/skills/**/SKILL.md` vs. the docs, or fold it into the README-refresh pass (item 9).

---

## ✅ Done (recent, for context)

- **Buyer-inquiry auto-reply (PR #34) — MERGED 2026-07-26. The last roadmap item.** A locked-down, public, buyer-facing Hermes instance (`autoestate-buyer`) plus the `/inquiries` dashboard. Role-by-channel isolation: the outbound skills are simply not loaded there, since the Hermes allowlist is a hard adapter gate and sender identity never reaches a skill. The model on that instance receives **3 tools**. Live-tested end to end from the operator's account *and* a genuine non-operator account; six defects found by those runs and all six fixed (the worst: `buyerContact` silently null on every lead, and `/start` blocked so every buyer's first tap would have been a permissions refusal). Architecture, the three Hermes security findings, and every defect are written up in CLAUDE.md.
- **All Claude Code hooks removed from the repo — 2026-07-26.** `.claude/settings.json` deleted at the owner's request; doc-sync is a convention now, not automation. PR #33 (a background doc-consistency checker built on a `Stop` hook) was **closed** for the same reason — good engineering aimed at a real problem, wrong mechanism for this repo. Its branch `chore/doc-consistency-checker` still exists if the script is ever wanted as an on-demand check.

- Weekly-digest skill + Listing tracking (PR #19/#21/#22/#23) — real Listing data flowing end-to-end.
- Re-engagement / just-sold skills (PR #25) — live-tested.
- Locator-based listing lookup (PR #26) — name a listing instead of retyping facts.
- No-locator confirmation-deferral fix (PR #28) — rule moved into the always-injected `listing-footer-reminder` plugin (v1.4); turn one verified live.
- **PR #28 turn-two verification — CLOSED 2026-07-25.** Both turns confirmed live via the session `state.db`: turn one leads with intro + confirmation question and withholds the footer; turn two ("Yes") appends the `Status: Sold` footer. The **Ben Gurion** listing (`cmry5rje00004u8u6ctv54q67`) flipped `ACTIVE` → `SOLD` in the dev DB (same row, no duplicate — transition-in-place confirmed). Caveat: the ingest leg was **reconstructed** (the 4127 dev server was down during the live test, so `sync-to-webapp` silently dropped the "Yes" turn's POST — no retry queue; see the new known-issue below) — the real `/api/ingest` → parser → transition path ran, just not triggered by the live WhatsApp turn itself.
