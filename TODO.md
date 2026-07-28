# AutoEstate — TODO

Task status, order, and sub-checklists. CLAUDE.md owns the brief/phase/architecture; the session-handoff file owns where work stopped. This file owns what's left to do.

Last updated: 2026-07-28 (buyer bot on two channels — Telegram + WhatsApp).

**Status:** every planned feature is built, live-tested and merged — the last, buyer-inquiry, in PR #34. The `/inspect` forensic sweep (PR #37) then fixed 41 defects across infra, plugins and the reporting app. Those fixes were then **deployed to the live profiles and the operator gateway restarted (2026-07-27)** — merging alone would not have done it, since plugins are physical copies inside each profile. **Nothing is blocked on more building.** Everything below is productionization. **Nothing is half-deployed** (re-verified 2026-07-28 after PR #52: parity 5/5 and the operator gateway restarted onto the new code).

**Blocked on the owner (account-level, cannot be done for you):** creating a Hetzner account so `terraform apply` can run (item 3), and setting up Vercel Pro to deploy the reporting app (item 4). These two gate a real pilot customer.

**Must happen before a real customer:** hardening the public buyer instance (items 5–6) — not blocked. The buyer-channel transport decision is **settled** (2026-07-28: both Telegram and WhatsApp; see below). Re-confirming open-channel behaviour on WhatsApp rather than Telegram alone is still **blocked** on credentials: it needs a runnable buyer instance, i.e. a fresh BotFather token and a paired WhatsApp number (item 10).

**Both former open questions are answered (owner, 2026-07-27), and both have consequences:**
- **The buyer bot's Telegram token was revoked on 2026-07-27 and REPLACED on 2026-07-28.** The old one was verified dead (`getMe` -> 401) rather than assumed; the new one is verified live -> `@autoestate_buyer_bot`. The buyer instance's remaining blocker is the **WhatsApp half** (a dedicated number, being provisioned) — see item 10.
- **Anthropic auto-reload billing is now ENABLED** (owner, 2026-07-28), closing the single most recurrent live-outage mode this project has had. Reported by the owner rather than verified from here — it is an account-level setting with no API surface I can query. See item 9.

**In flight:** deliberately not stated here. Whether a PR is open, and which, changes the moment anything merges — including the PR that would update this line, which is how this sentence has already gone stale once. `gh pr list` is the only trustworthy answer; merged branches are deleted on merge, so `git branch -a` corroborates it.

**Verification record:** a full `/docs` pass on **2026-07-27** re-read all three docs plus every tracked file, and re-ran the live checks (gateway processes, repo↔live plugin and buyer-config parity, all four machine routes, the dev database, `lint`/`tsc`, `terraform fmt`/`validate`, on-disk skill versions, the defer-sentence coupling, and Telegram `getMe` against the buyer token). Four stale claims found and fixed, all in code comments rather than the docs — see the Done section. Earlier the same day: the second `/inspect` sweep read all 91 in-scope tracked files on `main` plus the 4 genuinely-changed files on the then-extant doc-checker branch (27 findings, all fixed), and before that a `/fastpassdocs` reconciled live systems without sweeping files. `npm run build` was deliberately **not** re-run — it shares `.next/` with the dev server the live gateway syncs to, and no source changed in this pass beyond comments.

**Deployed and live, 2026-07-28.** PR #52's five plugin files and the buyer `config.yaml` were copied into the live profiles and verified (parity 5/5; buyer config parity clean with the documented exclusions; live-profile resolution confirms `whatsapp` yields the same 3 tools as `telegram`, gating on, stranger denied `/profile`, `bridge_port` 3001). The buyer gateway was stopped throughout, which is when editing its config is safe, and its machine-written `onboarding.seen` was preserved rather than clobbered.
**Operator gateway restarted by the owner, 2026-07-28 15:53** (from their own shell — restarting it from an agent session has caused a full outage before). Verified: PID 36868 → **27952**, started 15:53:50, three minutes *after* the plugin files were written at 15:50:50, which is what proves loaded code rather than a cache; log shows a clean drain, both adapters reconnecting, `Gateway running with 2 platform(s)`, no errors and no inert-plugin warning. Worth knowing: the WhatsApp bridge (PID 2996) was **not** killed and re-paired — the adapter health-checks the existing bridge and reuses it, so the live WhatsApp session survives a gateway restart untouched.

**Plugin deployment: 5/5, verified 2026-07-28 (post-#52).** Split by role — the operator profile carries `sync-to-webapp`, `listing-footer-reminder`, `active-listings-context`; the buyer profile carries `buyer-listings-context`, `sync-inquiries-to-webapp`. The operator gateway is loaded onto this code (evidence in the paragraph above). **The buyer profile's copies are in place but unloaded** — its gateway is stopped pending credentials, so they take effect whenever it next starts. Re-run CLAUDE.md §5's parity recipe rather than trusting this paragraph; the next plugin change invalidates it.

---

## 🔜 Next up (in order)

### 1. Nothing is blocking. The roadmap is done and the fixes are live.

Buyer-inquiry shipped on 2026-07-26 (PR #34), which was the last item on the marketing-automation roadmap. Every roadmap feature — listing-to-social, status updates, just-sold, re-engagement, locator lookup, weekly digest, and the buyer-facing receptionist — is built, live-tested and merged.

**What remains is productionization, not features.** It is all listed below and none of it is blocked on more building. The shortest path to a real pilot customer:

1. `terraform apply` to a real Hetzner account (item 3) — needs an account, an account-level action.
2. Deploy the reporting app to Vercel Pro (item 4) — also account-level.
3. The public buyer instance's remaining production security gates (items 5 and 6): container isolation, and re-running `hermes security audit` once anything is publicly exposed. **The scoped second ingestion secret is done** (2026-07-27) — the buyer box no longer holds a credential that can write to `/api/ingest`.
4. ~~Settle the buyer-channel transport.~~ **Done 2026-07-28** — both Telegram and WhatsApp, with the gating landed in the same change as the transport. The equivalent gate is now open only for `whatsapp_cloud`.
5. Re-confirm open-channel behaviour on **WhatsApp** — the spike and both live tests proved Telegram only. **Blocked** on credentials (item 10): the channel is built and gated, but needs a fresh BotFather token and a paired WhatsApp number before a stranger can be sent at it.

Also outstanding and non-blocking: create the Telegram notifier bot and set `OPERATOR_TELEGRAM_BOT_TOKEN` so operator lead alerts actually push (the dashboard records leads either way).


**Deferred to production (Phase 2/3):** public-instance container isolation, and a Terraform 2nd instance per customer (`instance_role`). The other two halves of that hardening are done: the tool lockdown (PR #34) and the scoped 2nd ingestion secret (2026-07-27).

**DECIDED 2026-07-28 — buyer-channel transport: BOTH Telegram and WhatsApp.** The owner's market observation settled it, and the answer wasn't on the either/or menu below: Facebook-sourced buyers reply on **Telegram**, Yad2/Instagram-sourced buyers reply on **WhatsApp**, so the buyer instance runs both simultaneously (one Hermes gateway serves multiple platforms — the operator profile has since 2026-07-22). Built and gated; **ready to pair, not yet paired** — it needs a fresh BotFather token and a dedicated second WhatsApp number, both owner actions. Baileys for the pilot, Cloud API once Hetzner exists.

The buyer receptionist must still be a *separate channel* from the operator's outbound bot — this is forced, not a preference: the Hermes allowlist is a hard adapter gate and sender identity isn't available to skills, so buyers cannot share the operator's number without exposing the outbound, DB-mutating skills (`just-sold`/price-drops) to strangers. So each fully-provisioned customer has an operator outbound number plus a public buyer-facing channel — now two of the latter.

**Correction to option (ii) below:** it does **not** require writing an adapter. Hermes already ships `gateway/platforms/whatsapp_cloud.py` (2081 lines) plus a `hermes whatsapp-cloud` setup command and tests. It is also cheaper than assumed — Meta bills per *template* message, while free-form replies inside a buyer-opened 24-hour window are **free**, and a receptionist is purely inbound-driven. It stays blocked behind Hetzner because it needs a **public HTTPS webhook**, which the Terraform firewall (no inbound but operator SSH) forbids.

The original option list is kept below for the reasoning, now historical:
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
- [ ] **Settle operator slash-command access at first apply.** The generated `config.yaml` sets no `allow_admin_from`, and gating is off unless one exists — so the customer holds admin tier on all ~68 commands (`/yolo`, `/restart`, `/update`, `/profile`) on their own instance. Blast radius is their own single-tenant box and their own ingestion secret, which is why this was documented rather than "fixed" blind by the 2026-07-27 sweep: shipping untested gating into the first-ever real provisioning run is the riskier move. Decide with a real instance in front of you.

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

### 9. Anthropic auto-reload billing (account-level, owner only) — DONE 2026-07-28
**Enabled by the owner on 2026-07-28.** Historical context below, kept because the failure mode explains why this mattered.
**Was confirmed OFF.** The `autoestate` profile's API credits have run dry mid-session repeatedly and taken the live WhatsApp bot down each time — every reply becoming a credit-balance error. The gateway's only fallback is the machine's ambient Claude Code OAuth login, which is itself fragile (see the known issue below), so a dry key plus an unavailable ambient credential is a total outage with no backstop.
- [x] **Enabled 2026-07-28** at console.anthropic.com. Cheapest possible fix for the single most recurrent live failure this project has had. Owner-reported; not verifiable from here (no API surface for the billing setting).

### 10. The buyer instance has no usable bot token
**The dev buyer bot's Telegram token was revoked by the owner on 2026-07-27** (correct hygiene — it was a public bot accepting messages from anyone, and it had already served its testing purpose). **Verified rather than taken on trust:** the token still present in the buyer profile's `.env` returns **401 Unauthorized** from `https://api.telegram.org/bot<token>/getMe`. Consequence: `hermes -p autoestate-buyer gateway run` will fail to authenticate. The profile, its lockdown and both its plugins are intact and version-controlled; only the credential is gone.
- [x] **Done 2026-07-28.** Fresh BotFather token minted and written to the buyer profile's `.env`; verified LIVE via `getMe` -> `@autoestate_buyer_bot` ("autoestate Buyer", id 8895045306). Telegram was **not** skipped — the transport decision kept it as the Facebook-sourced buyer channel.
  - [ ] **Consider disabling group-join for the bot** (`/setjoingroups` -> Disable in BotFather). `getMe` reports `can_join_groups: True`, so a stranger can add the public bot to any group — inconsistent with the WhatsApp side, where `group_policy: disabled` was set for exactly that reason. Privacy mode is on (`can_read_all_group_messages: False`), so it is a spam/noise surface rather than a data-leak one.
- [ ] **Provision the WhatsApp half.** An SMS-capable number on a **dedicated** line (never the operator's, never a personal one — a Baileys ban takes that number's WhatsApp with it), registered on the WhatsApp Business app, then `hermes -p autoestate-buyer whatsapp` → separate-bot-number mode → scan the QR. Finally uncomment the three `WHATSAPP_*` vars in `.env`. No contract needed: WhatsApp only requires one OTP to register, so a cheap prepaid eSIM suffices — but a *data-only* travel eSIM will not work, as it has no number that can receive SMS.
  - Registering it does **not** require logging the operator bot out; it requires a free *slot* (a spare handset, or multi-account support in WhatsApp / WhatsApp Business).
  - **Keepalive:** a linked device is logged out after **14 days** of its primary phone account not opening WhatsApp. If that happens the bridge drops silently and the buyer bot goes dark.
  - Pairing is safe to do at any time and will **not** disturb the live operator bridge — `--pair-only` starts no HTTP server (verified 2026-07-28).
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
- [x] **The buyer profile's lockdowns cover Telegram AND WhatsApp — closed 2026-07-28.** `platform_toolsets.whatsapp` and a `platforms.whatsapp.extra` block with `allow_admin_from` landed in the *same change* as the transport, which is what this gate demanded. Verified by resolution: `whatsapp` yields the same 3 tools as `telegram`, gating is on, and a stranger is denied `/profile`/`/model`/`/yolo`/`/restart`.

- [ ] **STILL OPEN — the lockdowns do not cover `whatsapp_cloud`.** The official Meta Cloud API registers as a **distinct platform name**, so neither `platform_toolsets` nor the slash gating applies to it. Slash gating is switched on *by the presence of an admin list*, so a `platforms.whatsapp_cloud` block without `allow_admin_from` returns every stranger to admin tier on all ~68 commands — `/profile` included, which hands them the operator's outbound `Listing`-mutating skills, i.e. exactly what PR #34 exists to prevent. **Add the gating in the same change as the transport, never after.** Deliberately not pre-added: the Cloud admin id is unknowable until a real Cloud sender exists, and untested gating config would manufacture the false confidence this gate exists to prevent. Documented in the config, the profile README and CLAUDE.md.
  Note the **data plane is already Cloud-ready** (2026-07-28): `whatsapp_cloud` is in all five plugin platform sets and both API Zod enums, so a migration won't silently no-op every plugin. That is explicitly *not* the same as being security-ready.

- [ ] **Partial unique index on `Listing`** — the durable fix for the ingest dedupe race. The 2026-07-27 sweep shipped a `Serializable` transaction around the match-and-write, which removes the race on that code path without a migration. The database-level guarantee needs `UNIQUE (customerId, lower(area), rooms, sqm) WHERE status <> 'SOLD'` — a partial *expression* index, because a plain `@@unique([customerId, area, rooms, sqm])` is case-sensitive and status-blind and would wrongly block a legitimate relist of a sold property. Land it before the Vercel deploy (item 4).

- [x] **Scoped second ingestion secret — DONE 2026-07-27**, verified 15/15 against the real routes. The buyer instance holds its own credential and gets 401 on `/api/ingest`. Full design and reasoning in CLAUDE.md; what remains of item 5 is container isolation, which is genuinely separate.

> Both config keys above are left at their real dev values on purpose, so the repo copy stays a verbatim match of the deployed file and CLAUDE.md's parity recipe keeps working. **Exclude `skills.external_dirs`, and `allow_admin_from`/`group_allow_admin_from` under BOTH `platforms.telegram.extra` and `platforms.whatsapp.extra`**, from that key-by-key comparison, alongside the machine-written `onboarding.seen`. The WhatsApp pair joined this list on 2026-07-28 — read the `MACHINE-SPECIFIC` markers in the file rather than trusting this sentence, since each new platform block adds two more.

---

## 🐛 Known small issues / awareness (not blocking, no owner yet)

- [ ] **Command-refusal text leaks internal config vocabulary at strangers:** a denied command replies "ask an admin to add you to `allow_admin_from` or set `user_allowed_commands`". Vendored gateway text, so changing it means patching code an upstream `hermes update` would overwrite. Low impact now that `/start` is allowed and buyers rarely trigger commands.
- [ ] **The sync plugin sends a `sender` field that nothing stores:** `/api/inquiries` accepts it, but the `Inquiry` model has no such column (the thread key is `hermesSessionId` by design). Harmless dead weight; either persist it or drop it from the payload.

- [ ] **Batched-follow-up rule occasionally violated:** the agent sometimes asks for missing facts (e.g. rooms, then sqm) as separate single-field questions instead of one batched question. Pre-existing, flagged in PR #26, unrelated to the locator feature.
- [ ] **Reporting-app platform parser misses some real headers:** `platform-content.ts` doesn't always recognize plain-caps `INSTAGRAM` / `עברית:` headers (vs. the spec's bold/ATX format), so an occasional real reply fails to split into platform sections. The Listing-record parser is independently robust; this only affects the platform-split display.
- [ ] **Sync plugins are still not durable across a gateway restart** (partially addressed 2026-07-26). Both `sync-to-webapp` and `sync-inquiries-to-webapp` now retry 3× with 1s/4s backoff (4xx is not retried — that means our own payload or secret is wrong), which covers the case that actually bit us: the reporting app restarting, or a momentary blip. It is **not** durable delivery — nothing survives a gateway restart or a long outage, which needs an on-disk spool. Revisit at the Vercel deploy (item 4) if lost turns show up in practice.
- [ ] **Gateway silently depends on ambient Claude Code OAuth credentials:** the profile's own `ANTHROPIC_API_KEY` keeps going dry and the `credential_pool` is empty, so the gateway falls back to the machine's ambient Claude Code OAuth login. Fragile single point of failure for a customer-facing bot — restarting the gateway from a Claude Code agent environment has knocked this out and caused a full outage before.
- [ ] **Skill `version:` fields drift from the docs — no cross-check:** the doc discipline keeps docs *current* as changes happen but nothing re-verifies on-disk `version:` frontmatter against CLAUDE.md's stated versions. Caught 2026-07-25: `just-sold`/`listing-reengagement` were on-disk `0.2.0` (docs said v0.1.0) and `listing-status-update` `0.4.0` (docs said v0.3.0) — all bumped by PR #26 but recorded in prose without the numbers. Corrected in CLAUDE.md's PR #26 paragraph. Recurred and was caught again on 2026-07-26: `agent/README.md` stated 4 of 5 skill versions wrongly. **Versions are asserted in two places — CLAUDE.md prose and `agent/README.md` — so both must be checked.** A `grep '^version:' agent/skills*/**/SKILL.md` against both is the cheap periodic check. **Last run 2026-07-27 (`/docs` pass): all six agree** — `listing-to-social` 0.4.0, `listing-status-update` 0.4.0, `just-sold` 0.2.0, `listing-reengagement` 0.2.0, `weekly-digest` 0.1.0, `buyer-inquiry` 0.2.0.

---

## ✅ Done (recent, for context)

- **`/docs` reconciliation — 2026-07-27, after the scoped-credential PR.** Full re-read of every tracked file plus the live checks. The three docs were already accurate; **all four stale claims were in code comments**, and the worst of them told a future reader to do the exact thing the credential split exists to prevent: both buyer plugins still said they reuse the operator's ingestion secret ("no separate secret to provision"), written when that was true and left alone by the PR that made it false. Also fixed: a comment naming `authenticateIngestRequest`, a function renamed in the same PR; three places crediting the Listing Record footer to two skills when `just-sold` — the only one that ever writes `SOLD` — also emits it; and a schema comment still carrying a conditional whose trigger had fired ("if the Phase-0c spike shows buyers colliding into one session, switch the key"), when the spike and a later live test had both confirmed the opposite.
  **Standing rule this establishes:** a renaming or scope-changing PR must grep for *prose* that describes the old arrangement, not just callers of the old name. A compiler finds the call sites; nothing finds the sentence that tells the next person to reintroduce the bug. Both misleading comments sat in the buyer instance's own code, which a security-focused review had passed over twice.

- **Second `/inspect` forensic sweep — 2026-07-27.** All 91 in-scope files on `main` plus the chore branch's 4 genuinely-changed files. 27 findings (2 critical, 9 major, 10 minor, 6 nitpick), all fixed. The one that mattered most: **`provision-customer.ts` could never have worked when run the documented way** — `dotenv` resolved `.env.local` against `cwd`, which the infra README sets to `infra/customers/<slug>/`, so a first real onboarding would have died on an opaque Prisma error. Also: a Terraform `null_resource` doesn't re-run just because its `depends_on` target did, so an edited `SKILL.md` was uploaded to a gateway that never restarted; `_extract_phone`'s newline fix had left the identical single-line splice unfixed (`"4 95 3 3950000"` would have been stored as a buyer's phone number); and the buyer profile's lockdowns turned out to be Telegram-only, which sits on the leading transport decision (now a deploy gate above). Everything verified by running it, including a throwaway-customer round-trip through the real ingest routes with cleanup proven by query.

- **PR #37's plugin fixes deployed to the live profiles — 2026-07-27.** Merging did not deploy them: plugins are physical copies inside each profile's `plugins/` dir, and the parity check found 4 of 5 drifted with the running operator gateway still on pre-fix code. The four changed `__init__.py` files were copied into `autoestate` and `autoestate-buyer`, and the owner restarted the operator gateway from their own PowerShell (not an agent session — that has caused an outage before). Verified end to end: live files were confirmed to be unmodified pre-#37 copies **before** overwriting; parity 5/5 after; all five import and register with the right hooks; PID 8340 → 6072 with a start time 7 minutes *after* the files were written, which is what proves the new code was loaded rather than a cache; log shows a clean shutdown and `Gateway running with 2 platform(s)`. No second restart was needed — the known inert-on-first-restart quirk applies to *newly enabled* plugins, not updated ones.
  **Standing rule this establishes:** a plugin PR is not finished when it merges. Run the parity recipe and redeploy, or the fix exists only in git.

- **`/inspect` forensic sweep of `main` — PR #37, MERGED 2026-07-26.** 41 findings (3 critical, 9 major, 18 minor, 11 nitpick), all fixed across five commits (40 files, +807/−257) except the scoped-ingestion-secret item, which is a feature and is now tracked as a deploy gate above. Its plugin fixes were deployed to the live profiles the next day — see the entry above. The three findings that mattered most: the **Terraform module had drifted to a 2026-07-22 snapshot** and shipped 1 of 5 skills and 1 of 3 plugins — a customer provisioned from it would have tracked **zero** listings, reproducing the exact bug PR #23 fixed; both context plugins could **raise `KeyError` out of `pre_llm_call`** on the public buyer instance, on every turn, breaking their own documented degrade-to-`None` contract; and **every dashboard timestamp would have rendered in UTC on Vercel**, 2-3 hours off for Tel Aviv users, with Today/Yesterday flipping at the wrong moment. Two fixes were changed by measurement rather than shipped as planned: the inquiry→listing matcher's "obvious" fix would have produced **zero** links on real data, and `next build` caught a `"use server"` export error that neither `tsc` nor eslint saw.

- **`buyer-inquiry` v0.2.0 — never offer a SOLD listing as a choice (2026-07-26).** The disambiguation menu had listed sold properties as if on offer, so a buyer could pick one and only then be told. Anything the skill offers unprompted is now `ACTIVE`-only. Verified via `hermes -z` including the regression case (a buyer *naming* a sold property still gets the honest answer).

- **Buyer-inquiry auto-reply (PR #34) — MERGED 2026-07-26. The last roadmap item.** A locked-down, public, buyer-facing Hermes instance (`autoestate-buyer`) plus the `/inquiries` dashboard. Role-by-channel isolation: the outbound skills are simply not loaded there, since the Hermes allowlist is a hard adapter gate and sender identity never reaches a skill. The model on that instance receives **3 tools**. Live-tested end to end from the operator's account *and* a genuine non-operator account; six defects found by those runs and all six fixed (the worst: `buyerContact` silently null on every lead, and `/start` blocked so every buyer's first tap would have been a permissions refusal). Architecture, the three Hermes security findings, and every defect are written up in CLAUDE.md.
- **All Claude Code hooks removed from the repo — 2026-07-26.** `.claude/settings.json` deleted at the owner's request; doc-sync is a convention now, not automation. PR #33 (a background doc-consistency checker built on a `Stop` hook) was **closed** for the same reason — good engineering aimed at a real problem, wrong mechanism for this repo. Its branch was kept in case the script was ever wanted as an on-demand check, and **retired on 2026-07-28** once it had actually been run: one hallucinated finding, one artifact of auditing the stale branch it lived on, one real finding `main` had already fixed. The commits survive as the tag `archive/doc-consistency-checker`; the branch, and the "never merge this" caveat it needed in three files, are gone. Reasoning and the two durable lessons are in CLAUDE.md.

- Weekly-digest skill + Listing tracking (PR #19/#21/#22/#23) — real Listing data flowing end-to-end.
- Re-engagement / just-sold skills (PR #25) — live-tested.
- Locator-based listing lookup (PR #26) — name a listing instead of retyping facts.
- No-locator confirmation-deferral fix (PR #28) — rule moved into the always-injected `listing-footer-reminder` plugin (v1.4); turn one verified live.
- **PR #28 turn-two verification — CLOSED 2026-07-25.** Both turns confirmed live via the session `state.db`: turn one leads with intro + confirmation question and withholds the footer; turn two ("Yes") appends the `Status: Sold` footer. The **Ben Gurion** listing (`cmry5rje00004u8u6ctv54q67`) flipped `ACTIVE` → `SOLD` in the dev DB (same row, no duplicate — transition-in-place confirmed). Caveat: the ingest leg was **reconstructed** (the 4127 dev server was down during the live test, so `sync-to-webapp` silently dropped the "Yes" turn's POST — no retry queue; see the new known-issue below) — the real `/api/ingest` → parser → transition path ran, just not triggered by the live WhatsApp turn itself.
