## Session Handoff — 2026-07-29

### What this project is

**AutoEstate** — marketing automation for independent real estate agents in Tel Aviv. An agent messages a bot with listing facts and gets back bilingual (Hebrew + English) content for Instagram, Facebook and Yad2. Prospective buyers message a *separate, public* bot — on **either WhatsApp or Telegram** — and get honest answers about a property 24/7, captured as leads. Both show up in a Next.js dashboard the agent logs into. Built on Hermes, one dedicated instance per customer.

Read [CLAUDE.md](CLAUDE.md) for the brief, architecture and engineering history; [TODO.md](TODO.md) for what's outstanding. Repo: https://github.com/njkarp06-design/AutoEstate (private).

### Where things stand

- **Every roadmap feature is built, live-tested and merged.** So is the channel-consolidation work (item 12). **Everything remaining is productionization**, and every step that gates a pilot is account-level and belongs to the owner.
- **Nothing is hosted.** The reporting app runs only via `npm run dev` (port 4127). The Terraform module is `validate`-clean but has **never been applied** — there is no Hetzner account, no Vercel project and no Cloudflare account.
- **The buyer bot runs on both Telegram and WhatsApp**, answers amenity questions from the footer's `Features:` line, and resolves a **ref code** from a tapped ad link so it knows the exact property from message one. All live-tested, including by a genuine third party.
- **New 2026-07-29 — outbound file delivery is locked down on the buyer instance.** This was a *live* gap, not a hypothetical: the operator profile's `.env` and both profiles' `state.db` were deliverable to a prompt-injected buyer. Details below; it is the most important thing this session changed.
- **New 2026-07-29 — listing photos/videos (TODO 13) is scoped and its blob store decided (Cloudflare R2).** Nothing built, no Cloudflare account.
- **Whether a PR is open is deliberately not stated here** — it changes the moment anything merges, which is how this sentence has already gone stale once. Run `gh pr list`. Merged branches are deleted on merge, so `git branch -a` corroborates it.

### Live systems

Verified **2026-07-29** by listing processes, hashing files, calling the routes, and asking each provider directly. PIDs are a dated observation — re-derive rather than trust them.

| | State |
|---|---|
| `default` Hermes gateway | running, PID 1976 (unrelated personal profile) |
| `autoestate` gateway (operator) | running **detached** (`pythonw`, PID 43308) via the `Hermes_Gateway_autoestate.vbs` startup item. Use `gateway start` (service), **not** `gateway run` (foreground) |
| `autoestate-buyer` gateway | **stopped**, deliberately — it is public whenever it runs. Both channels credentialled: Telegram `@Auto_Estate_Buyer_bot` + a paired dedicated WhatsApp number |
| WhatsApp bridges | port **3000** = operator (PID 2996, unchanged since 07-24 — **never kill this**); port **3001** = buyer (PID 34008, survives its gateway stopping, which keeps the linked device alive) |
| Reporting app, 127.0.0.1:4127 | running. All four machine routes healthy — `401` on the two GETs, `405` on the two POST-only ones |
| Repo↔live plugin parity | **5/5**. Operator: `sync-to-webapp` / `listing-footer-reminder` / `active-listings-context`. Buyer: `buyer-listings-context` (1.2) / `sync-inquiries-to-webapp` |
| Repo↔live buyer `config.yaml` | **0 drift** (parsed YAML, `MACHINE-SPECIFIC` keys excluded) — including the two new `gateway.*` keys |
| Terraform template ↔ dev operator profile | **0 drift** on the widened key set (platform *set* compared first, then keys within each) |
| Anthropic API key | **live, has credit** — asked of the provider (HTTP 200 on a one-token request), not read off the console. All three profiles share this one key |
| Telegram bots | **replaced 2026-07-29** — operator `@Auto_Estate_Operator_bot` (id 8902059217), buyer `@Auto_Estate_Buyer_bot` (id 8838769580), both named "AutoEstate". Both tokens verified live via `getMe`, both `can_join_groups: False`, privacy on. New tokens written to each profile's `.env`; **the operator gateway has not been restarted, so it is still running the old, deleted token** |
| Skill / plugin versions | read off disk, all matching the docs — skills `listing-to-social` 0.5.0, `listing-status-update` 0.5.0, `just-sold` 0.3.0, `listing-reengagement` 0.2.0, `weekly-digest` 0.1.0, `buyer-inquiry` 0.4.0; plugins `listing-footer-reminder` 1.5, `buyer-listings-context` 1.2, others 1.0 |
| `tsc` / `eslint` / `terraform fmt` / `validate` | clean. **`npm run build` was NOT run** — the dev server was up and they share `.next/` |

### What to do next

Three account-level steps, all needing the owner, none of which I can do:

1. **Create a Hetzner account, then `terraform apply`** (TODO item 3). Three things there have **never run**: the operator SSH key must be uploaded to the project once beforehand (Hetzner rejects a duplicate public key, so the module looks it up); skills and plugins arrive via post-boot SSH upload rather than cloud-init, so confirm they landed; and operator slash-command access is ungated by default on that box.
2. **Deploy the reporting app to Vercel Pro** (item 4). **Land the partial unique index on `Listing` first** — the current `Serializable` transaction removes the ingest dedupe race on that code path, but the durable guarantee needs `UNIQUE (customerId, lower(area), rooms, sqm) WHERE status <> 'SOLD'`, and the obvious plain `@@unique` is wrong because it would block a legitimate relist of a sold property.
3. **Create the Cloudflare account + R2 bucket** (item 13). Smaller than the other two and independent of them: it unblocks all of listing media. Expected cost at pilot scale is zero, but re-check R2's pricing at signup rather than inheriting the projection in TODO.

**Then, before any real customer:**

4. **Harden the public buyer instance** (items 5–6): OS-level isolation, and re-running `hermes security audit` once anything is exposed.
5. **Add `WHATSAPP_ALLOW_ALL_USERS=true`** to any buyer instance Terraform provisions — with `dm_policy: open` Hermes refuses to boot without it. It blocked the dev instance and will block the first real one identically.

**Then the target state, not a pilot blocker:**

6. **Migrate the buyer channel to the official WhatsApp Cloud API** — TODO item 12b, step 4 of TODO's ordered path. Blocked *only* on the public HTTPS webhook the module's firewall forbids, so step 1 unlocks it. **Close the `whatsapp_cloud` lockdown gate in the same change, never after** — it is a distinct platform name, so neither `platform_toolsets` nor slash gating covers it, and an ungated block puts every stranger back at admin tier on ~68 commands.

**Do this first — it is small and the operator bot is dark until it happens.** Both Telegram bots were replaced on 2026-07-29 and the new tokens are in the profile `.env` files, but **the operator gateway was not restarted**, so it is still running the old, now-deleted token. Restart it **from your own PowerShell, not an agent session** (that has caused a full outage before). The buyer gateway is stopped and picks its new token up on next start. Then **`/start` both new bots from your Telegram account** — a fresh bot cannot open a DM with someone who has never messaged it, and both profiles set `TELEGRAM_HOME_CHANNEL` to your own user id, so anything the agent pushes rather than replies to will fail silently until you do.

**Unblocked work, if you want something that needs no account:** the **four skills never tested over Telegram** (only `listing-to-social` has been) — and the bot replacement means the first message to the new operator bot re-tests that path anyway. **Non-blocking:** create the Telegram notifier bot and set `OPERATOR_TELEGRAM_BOT_TOKEN` so operator lead alerts push — the dashboard records leads either way.

### What changed on 2026-07-29

- **Outbound file delivery locked down on the buyer instance (PR #67).** Outbound media is triggered by the model emitting `MEDIA:<abs path>` in its reply **text** — not a tool, so the 3-tool lockdown and `agent.disabled_toolsets` never touched it. Measured before the fix: the operator profile's `.env` (API key, bot token, ingestion secret), the operator's `state.db`, and the buyer's own `state.db` (every buyer's messages and captured phone numbers) were all **deliverable**. Fixed with `gateway.strict: true` **and** `gateway.trust_recent_files: false`; the second is load-bearing, because strict alone keeps a 600s recency fallback and `state.db` is rewritten every turn. **Deliberately not changed on the operator instance** — single-tenant, different threat model; settle it at first `terraform apply` alongside slash-command gating.
- **Item 13 (listing photos/videos) scoped, and its store decided: Cloudflare R2 (PR #69).** Two of three legs already exist in Hermes — inbound media is cached per-profile including video, and outbound needs no new tool. R2 chosen on zero egress (every file crosses machines at least twice) and on S3 compatibility serving both runtimes. Rejected: Vercel Blob, S3, Backblaze B2, with reasons recorded in TODO and CLAUDE.md.
- **Cloud API migration sequenced into the ordered path (PR #66)**, where it had been missing entirely despite carrying a full checklist inside item 12b.
- **Contract-signing idea (TODO 14) corrected (PR #70)** — it described the media lockdown as an uncommitted branch; it had merged. Items 13 and 14 are now cross-linked, since both rest on `MEDIA:` delivery and the same cache-root constraint.

### Open questions for the owner

**None blocking.** One cosmetic observation, recorded rather than acted on: the two Telegram bots' display names are inconsistent — operator reads "AutoEstate", buyer reads "autoestate Buyer" (lowercase). Both are changeable in BotFather without touching a token. Not worth a session on its own.

Everything else is closed. **Anthropic credit exhaustion remains a live failure mode, not a solved one** — auto-reload was reported enabled, yet the key was found dry on 2026-07-28 and needed a manual top-up. It is live with credit as of 2026-07-29, verified by asking the provider. All three profiles share **one** key, so one empty balance takes everything down.

### Working conventions

- **Git:** `main` → feature branch → PR. Never commit to `main`. **Never merge without asking** — the owner asks explicitly each time.
- **No hooks exist in this repo.** Doc-sync is a convention: record real changes as part of finishing a task. Do not reintroduce automation.
- **Verify by running something.** CLAUDE.md §5 carries the exact recipes — a profile's real tool list, its visible skills, slash-command policy, **what files it would hand out**, repo↔live parity, Terraform-template↔dev-profile parity, what the model was actually sent on a turn, and whether a "revoked" credential is really dead. Every one has caught something real.
- **Merging deploys nothing.** Plugins are physical copies inside each profile. A plugin PR is not finished until the parity recipe passes and the gateway has been restarted — by the **owner, from their own shell**. Restarting from an agent session has caused a full outage before.

### Environment gotchas

- **Outbound file delivery is triggered by reply TEXT, not a tool.** `MEDIA:<abs path>` makes the gateway deliver that file, so no tool lockdown constrains it. The buyer profile now sets `gateway.strict: true` **and** `gateway.trust_recent_files: false`; media must be written into the profile cache roots to stay deliverable. The operator profile is deliberately still on the default.
- **`sender_id` *is* available to plugin hooks** (`pre_llm_call` and `post_llm_call` both). It does **not** let you gate by role — a plugin can only inject text, and text doesn't reliably stop the model acting. Sender identity still never reaches a *skill*, which is what forces role-by-channel isolation.
- **A skill edit never reaches a conversation already in progress.** A running session answers from the copy it loaded at session start. Use `/new` to pick a change up, or test with a fresh sender.
- **Never let the buyer gateway run with the default WhatsApp `bridge_port`.** The adapter defaults to 3000 and kills whatever holds that port on start — 3000 is the **live operator bridge**. The buyer config pins `3001`; do not "tidy" it. Pairing is unaffected (`--pair-only` starts no HTTP server).
- **`gateway run` is foreground, `gateway start` is the detached service.**
- Use **`127.0.0.1`**, never `localhost` (IPv6 collision). A page-route 500 on 4127 is usually a transient Turbopack recompile; an API route returning 401 proves the agent-facing path is fine.
- **Never edit a profile's `config.yaml` while its gateway is running** — the gateway rewrites the file, strips comments, and clobbers concurrent edits. The commented copies under `agent/profiles/` are the source of truth; compare as parsed YAML, not text.
- Per-profile logs: `%LOCALAPPDATA%\hermes\profiles\<profile>\logs\gateway.log` — not the shared path, which has misled a session.
- **After ANY schema change, restart the `next dev` server on 4127.** The Prisma client loads at server *start*. Symptom: machine routes 500 where they used to 401 — and while it lasts, the live gateway's sync POSTs fail, so a real turn is lost.
- **Don't run `npm run build` while the dev server is up** — shared `.next/`. Use `lint` + `tsc`, but remember `next build` catches `"use server"` export errors neither does.
- **When resolving anything profile-scoped, set `HERMES_HOME` explicitly.** Measuring the wrong profile is this environment's most repeated mistake.

### How to resume

> Read session-handoff-2026-07-29.md and continue. Everything is built, merged and live-tested. Verify with `git log origin/main..` and `gh pr list --state all` rather than trusting any branch/PR claim here, and re-run CLAUDE.md §5's parity recipes rather than trusting the parity lines. **What's left is productionization**, and all three next steps are account-level: Hetzner + `terraform apply` (TODO 3), the Vercel deploy (TODO 4, and land the partial unique index on `Listing` first), and the Cloudflare + R2 bucket (TODO 13, the smallest and independent of the other two). **Don't start any of them without me** — they cost money and none of the accounts exist. If you want unblocked work instead, the honest gap is the **four skills never tested over Telegram**. Four things to know before planning. **The buyer bot is paired on both channels but its gateway is stopped** — it is public whenever it runs, so start it only to test and stop it after; its WhatsApp `bridge_port` must stay **3001**, because the adapter kills whatever holds its port on startup and its default is 3000, the live operator bridge. **A skill edit does not reach a conversation already in progress** — use `/new` or a fresh sender. **Credit exhaustion is a live failure mode** — all three profiles share one Anthropic key, so ask the provider before any live test rather than trusting the console balance. And **outbound file delivery is text-triggered, not tool-gated** — the buyer profile is now locked to its cache roots, which any listing-media work must write into. If a dev server is running from an older checkout, restart it: the Prisma client loads at start.
