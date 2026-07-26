# AutoEstate — TODO

Task status, order, and sub-checklists. CLAUDE.md owns the brief/phase/architecture; the session-handoff file owns where work stopped. This file owns what's left to do.

Last updated: 2026-07-27.

**Status:** every planned feature is built, live-tested and merged — the last, buyer-inquiry, in PR #34. The `/inspect` forensic sweep (PR #37) then fixed 41 defects across infra, plugins and the reporting app. **Nothing is blocked on more building.** Everything below is productionization, plus one deployment gap (item 0).

**Blocked on the owner (account-level, cannot be done for you):** creating a Hetzner account so `terraform apply` can run (item 3), and setting up Vercel Pro to deploy the reporting app (item 4). These two gate a real pilot customer.

**Not blocked, but must happen before a real customer:** hardening the public buyer instance (items 5–6), re-confirming open-channel behaviour on WhatsApp rather than Telegram alone, and settling the buyer-channel transport decision below.

**Both former open questions are now answered (owner, 2026-07-27), and both have consequences:**
- **The dev buyer bot's Telegram token is REVOKED.** Good hygiene, and the buyer gateway was already stopped, so nothing broke. But it means **the buyer instance can no longer be started** — a new BotFather token (or a decision on the buyer-channel transport) is a prerequisite for any further buyer testing, including the outstanding WhatsApp open-channel re-confirmation.
- **Anthropic auto-reload billing is NOT enabled.** This was previously recorded as merely unverified; it is now a confirmed-off setting, which makes the recurring credit-exhaustion outage a matter of when, not if. See item 9.

**In flight:** nothing. No PR is open (#37 merged 2026-07-26 23:11 UTC).

**Verification record:** reconciled by `/fastpassdocs` on **2026-07-27** — live systems and repo↔live parity verified, satellite docs read in full, only recently-changed files re-read. **Tracked files were NOT swept in full by that pass**; the last full file sweep was `/inspect` on 2026-07-26, which read all 88 in-scope files.

---

## 🔜 Next up (in order)

### 0. Deploy the merged plugin fixes to the live profiles ⚠️ NOT DONE

**PR #37's plugin fixes are on `main` but are NOT running.** Plugins are physical copies inside each profile's `plugins/` directory — merging deploys nothing. Verified 2026-07-27 by the parity recipe: **4 of 5 plugins have drifted**, and the live `autoestate` gateway is still executing pre-fix code.

| Profile | Plugin | State |
|---|---|---|
| `autoestate` (running) | `active-listings-context` | **drifted** — still has the `KeyError`-out-of-hook bug |
| `autoestate` (running) | `sync-to-webapp` | **drifted** — still no retry |
| `autoestate` (running) | `listing-footer-reminder` | matches (unchanged by #37) |
| `autoestate-buyer` (stopped) | `buyer-listings-context` | **drifted** — still has the `KeyError` bug |
| `autoestate-buyer` (stopped) | `sync-inquiries-to-webapp` | **drifted** — still no retry |

- [ ] Copy the four changed `__init__.py` files into `%LOCALAPPDATA%\hermes\profiles\<profile>\plugins\<name>\`.
- [ ] Restart both gateways, then re-run the parity check to confirm all five match.

**Do the restart from a normal interactive shell, not from a Claude Code agent session** — doing it from an agent environment has knocked out the ambient OAuth credential the gateway silently depends on and caused a full outage before (see the known issue below). Low urgency while nothing is deployed and the buyer bot is stopped, but the operator gateway is live, so it is running known-buggy code today.

### 1. Nothing is blocking on features. The roadmap is done.

Buyer-inquiry shipped on 2026-07-26 (PR #34), which was the last item on the marketing-automation roadmap. Every roadmap feature — listing-to-social, status updates, just-sold, re-engagement, locator lookup, weekly digest, and the buyer-facing receptionist — is built, live-tested and merged.

**What remains is productionization, not features.** It is all listed below and none of it is blocked on more building. The shortest path to a real pilot customer:

0. Deploy the merged plugin fixes to the live profiles (item 0) — five minutes, and the operator gateway is running pre-fix code until it happens.
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
- [ ] **Upload the operator SSH public key to the Hetzner project once** (Security → SSH Keys), named to match `operator_ssh_key_name` (default `autoestate-operator`). The module looks it up rather than creating it — Hetzner rejects the same public key twice in a project, so a per-customer `hcloud_ssh_key` broke every apply after the first (fixed 2026-07-26).
- [ ] `terraform apply` a first per-customer instance and verify boot/cloud-init/secret-injection end to end.
- [ ] **Verify the post-boot skill/plugin upload actually landed** — `ls /root/.hermes/skills/real-estate` (expect 5) and `/root/.hermes/plugins` (expect 3, no buyer plugins, no `__pycache__`). This step is new and has never run: skills/plugins are uploaded over SSH rather than embedded in cloud-init, because they exceed Hetzner's 32KB `user_data` cap.

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

## 🔑 Credentials — both answered 2026-07-27, both now actionable

### 9. Anthropic auto-reload billing (account-level, owner only)
**Confirmed OFF.** The `autoestate` profile's API credits have run dry mid-session repeatedly and taken the live WhatsApp bot down each time — every reply becoming a credit-balance error. The gateway's only fallback is the machine's ambient Claude Code OAuth login, which is itself fragile (see the known issue below), so a dry key plus an unavailable ambient credential is a total outage with no backstop.
- [ ] Enable auto-reload at console.anthropic.com. Cheapest possible fix for the single most recurrent live failure this project has had.

### 10. The buyer instance has no usable bot token
**The dev buyer bot's Telegram token was revoked by the owner on 2026-07-27** (correct hygiene — it was a public bot accepting messages from anyone, and it had already served its testing purpose). Consequence: `hermes -p autoestate-buyer gateway run` will now fail to authenticate. The profile, its lockdown and both its plugins are intact and version-controlled; only the credential is gone.
- [ ] Before any further buyer testing, mint a fresh BotFather token and put it in the buyer profile's `.env` — **or** skip Telegram entirely if the buyer-channel transport decision (above) lands on WhatsApp or a web widget.
- [ ] Note this blocks the outstanding **"re-confirm open-channel behaviour on WhatsApp"** item, which needs a runnable buyer instance either way.

---

## 🧰 Repo tooling / docs automation

### 11. Keep README.md from drifting
Wanted 2026-07-25; reframed 2026-07-26. `README.md` is the **public-facing** description of AutoEstate and nothing keeps it current, so it drifts behind the real state of the project.

Originally scoped as an end-of-session `Stop` hook. **That mechanism is dropped** — all hooks were removed from this repo on 2026-07-26 (see CLAUDE.md section 3). The refresh is now ordinary work, done the same way the other docs are maintained: when something user-visible actually changes, update it, in a normal commit on a feature branch.

The thinking already done here still applies and is the real content of this item:
- [x] **Decided 2026-07-26 by doing it.** `README.md` was rewritten from a chronological PR changelog (which is what it had drifted into — the exact failure this item warned about) into a stable public-facing description: what the product does, current state, security posture, structure. Only the **Current state** section is expected to change often; the rest is hand-written and left alone. Internal history stays in CLAUDE.md.
- [ ] Only refresh when something **user-visible** actually changed — not every session. A README rewritten constantly makes noisy diffs in a history that is otherwise meaningful PRs.
- [ ] Same git workflow as everything else: feature branch and PR, never straight to `main`.
- [x] **First pass done 2026-07-26.** It had drifted badly: the status line still read "Phase 2a and 2b complete" and the closing paragraph still called buyer-inquiry "next up" after it had shipped. Rewritten. `agent/README.md` (4 of 5 skill versions wrong, `buyer-inquiry` and `skills-buyer/` missing entirely) and `reporting-app/README.md` (status from 2026-07-23, schema section missing `Listing`/`Inquiry`/`InquiryMessage`) were corrected in the same pass.

---

## 🚧 Deploy gates opened by the 2026-07-26 `/inspect` sweep

These are **blocking** for a real deployment, not awareness items. Each is a real defect that the sweep found and deliberately did **not** paper over.

- [ ] **The buyer profile's `skills.external_dirs` is an absolute Windows path.** `agent/profiles/autoestate-buyer/config.yaml` points at `C:/dev/...`. On a Linux instance it resolves to nothing and the profile discovers **zero** skills — a public receptionist with no receptionist, failing silently and totally. Marked `MACHINE-SPECIFIC` in the file. Must be set to the deployed path before the buyer instance runs anywhere but this laptop.
- [ ] **The buyer profile hardcodes the operator's own Telegram user id** as `allow_admin_from` (and `group_allow_admin_from`). Shipped unchanged to every customer, one personal account would hold admin-tier slash-command access — including `/profile` — on every buyer bot. Marked `MACHINE-SPECIFIC`. Needs parameterising when Terraform grows `instance_role`.
- [ ] **Scoped second ingestion secret** (see also item 5). The buyer `.env` carries the *same* secret that authenticates `POST /api/ingest`, so the one untrusted-input surface in the product holds a credential that can create and mutate `Run` and `Listing` rows — including flipping a property to `SOLD`. The tool lockdown does not mitigate this: it is credential scope, not agent capability. **This is the highest-consequence open item in the repo** and should land before any public exposure, in its own PR (schema column + provisioning + per-route authorization).

> Both config keys above are left at their real dev values on purpose, so the repo copy stays a verbatim match of the deployed file and CLAUDE.md's parity recipe keeps working. **Exclude `skills.external_dirs` and `allow_admin_from`/`group_allow_admin_from` from that key-by-key comparison**, alongside the machine-written `onboarding.seen`.

---

## 🐛 Known small issues / awareness (not blocking, no owner yet)

- [ ] **Command-refusal text leaks internal config vocabulary at strangers:** a denied command replies "ask an admin to add you to `allow_admin_from` or set `user_allowed_commands`". Vendored gateway text, so changing it means patching code an upstream `hermes update` would overwrite. Low impact now that `/start` is allowed and buyers rarely trigger commands.
- [ ] **The sync plugin sends a `sender` field that nothing stores:** `/api/inquiries` accepts it, but the `Inquiry` model has no such column (the thread key is `hermesSessionId` by design). Harmless dead weight; either persist it or drop it from the payload.

- [ ] **Batched-follow-up rule occasionally violated:** the agent sometimes asks for missing facts (e.g. rooms, then sqm) as separate single-field questions instead of one batched question. Pre-existing, flagged in PR #26, unrelated to the locator feature.
- [ ] **Reporting-app platform parser misses some real headers:** `platform-content.ts` doesn't always recognize plain-caps `INSTAGRAM` / `עברית:` headers (vs. the spec's bold/ATX format), so an occasional real reply fails to split into platform sections. The Listing-record parser is independently robust; this only affects the platform-split display.
- [x] ~~**`app/page.tsx` Activity list still `max-w-3xl`**~~ — widened to `max-w-5xl` by the 2026-07-26 `/inspect` sweep.
- [ ] **Anthropic Console auto-reload billing is OFF — confirmed by the owner 2026-07-27.** No longer an unverified maybe: the `autoestate` profile's credits have run dry repeatedly across sessions and caused live outages, and nothing prevents the next one. Compounded by the ambient-OAuth issue below — when credits run out, the gateway's only fallback is a credential that is itself fragile. Enabling auto-reload at console.anthropic.com is an account-level action only the owner can take. See item 9.
- [ ] **Sync plugins are still not durable across a gateway restart** (partially addressed 2026-07-26). Both `sync-to-webapp` and `sync-inquiries-to-webapp` now retry 3× with 1s/4s backoff (4xx is not retried — that means our own payload or secret is wrong), which covers the case that actually bit us: the reporting app restarting, or a momentary blip. It is **not** durable delivery — nothing survives a gateway restart or a long outage, which needs an on-disk spool. Revisit at the Vercel deploy (item 4) if lost turns show up in practice.
- [ ] **Gateway silently depends on ambient Claude Code OAuth credentials:** the profile's own `ANTHROPIC_API_KEY` keeps going dry and the `credential_pool` is empty, so the gateway falls back to the machine's ambient Claude Code OAuth login. Fragile single point of failure for a customer-facing bot — restarting the gateway from a Claude Code agent environment has knocked this out and caused a full outage before.
- [ ] **Skill `version:` fields drift from the docs — no cross-check:** the doc discipline keeps docs *current* as changes happen but nothing re-verifies on-disk `version:` frontmatter against CLAUDE.md's stated versions. Caught 2026-07-25: `just-sold`/`listing-reengagement` were on-disk `0.2.0` (docs said v0.1.0) and `listing-status-update` `0.4.0` (docs said v0.3.0) — all bumped by PR #26 but recorded in prose without the numbers. Corrected in CLAUDE.md's PR #26 paragraph. Recurred and was caught again on 2026-07-26: `agent/README.md` stated 4 of 5 skill versions wrongly. **Versions are asserted in two places — CLAUDE.md prose and `agent/README.md` — so both must be checked.** A `grep '^version:' agent/skills*/**/SKILL.md` against both is the cheap periodic check.

---

## ✅ Done (recent, for context)

- **`/inspect` forensic sweep of `main` — PR #37, MERGED 2026-07-26.** 41 findings (3 critical, 9 major, 18 minor, 11 nitpick), all fixed across five commits (40 files, +807/−257) except the scoped-ingestion-secret item, which is a feature and is now tracked as a deploy gate above. **The plugin fixes are merged but not yet deployed to the live profiles — see item 0.** The three that mattered most: the **Terraform module had drifted to a 2026-07-22 snapshot** and shipped 1 of 5 skills and 1 of 3 plugins — a customer provisioned from it would have tracked **zero** listings, reproducing the exact bug PR #23 fixed; both context plugins could **raise `KeyError` out of `pre_llm_call`** on the public buyer instance, on every turn, breaking their own documented degrade-to-`None` contract; and **every dashboard timestamp would have rendered in UTC on Vercel**, 2-3 hours off for Tel Aviv users, with Today/Yesterday flipping at the wrong moment. Two fixes were changed by measurement rather than shipped as planned: the inquiry→listing matcher's "obvious" fix would have produced **zero** links on real data, and `next build` caught a `"use server"` export error that neither `tsc` nor eslint saw.

- **`buyer-inquiry` v0.2.0 — never offer a SOLD listing as a choice (2026-07-26).** The disambiguation menu had listed sold properties as if on offer, so a buyer could pick one and only then be told. Anything the skill offers unprompted is now `ACTIVE`-only. Verified via `hermes -z` including the regression case (a buyer *naming* a sold property still gets the honest answer).

- **Buyer-inquiry auto-reply (PR #34) — MERGED 2026-07-26. The last roadmap item.** A locked-down, public, buyer-facing Hermes instance (`autoestate-buyer`) plus the `/inquiries` dashboard. Role-by-channel isolation: the outbound skills are simply not loaded there, since the Hermes allowlist is a hard adapter gate and sender identity never reaches a skill. The model on that instance receives **3 tools**. Live-tested end to end from the operator's account *and* a genuine non-operator account; six defects found by those runs and all six fixed (the worst: `buyerContact` silently null on every lead, and `/start` blocked so every buyer's first tap would have been a permissions refusal). Architecture, the three Hermes security findings, and every defect are written up in CLAUDE.md.
- **All Claude Code hooks removed from the repo — 2026-07-26.** `.claude/settings.json` deleted at the owner's request; doc-sync is a convention now, not automation. PR #33 (a background doc-consistency checker built on a `Stop` hook) was **closed** for the same reason — good engineering aimed at a real problem, wrong mechanism for this repo. Its branch `chore/doc-consistency-checker` still exists if the script is ever wanted as an on-demand check.

- Weekly-digest skill + Listing tracking (PR #19/#21/#22/#23) — real Listing data flowing end-to-end.
- Re-engagement / just-sold skills (PR #25) — live-tested.
- Locator-based listing lookup (PR #26) — name a listing instead of retyping facts.
- No-locator confirmation-deferral fix (PR #28) — rule moved into the always-injected `listing-footer-reminder` plugin (v1.4); turn one verified live.
- **PR #28 turn-two verification — CLOSED 2026-07-25.** Both turns confirmed live via the session `state.db`: turn one leads with intro + confirmation question and withholds the footer; turn two ("Yes") appends the `Status: Sold` footer. The **Ben Gurion** listing (`cmry5rje00004u8u6ctv54q67`) flipped `ACTIVE` → `SOLD` in the dev DB (same row, no duplicate — transition-in-place confirmed). Caveat: the ingest leg was **reconstructed** (the 4127 dev server was down during the live test, so `sync-to-webapp` silently dropped the "Yes" turn's POST — no retry queue; see the new known-issue below) — the real `/api/ingest` → parser → transition path ran, just not triggered by the live WhatsApp turn itself.
