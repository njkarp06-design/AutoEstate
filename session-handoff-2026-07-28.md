## Session Handoff — 2026-07-28

### What this project is

**AutoEstate** — marketing automation for independent real estate agents in Tel Aviv. An agent messages a WhatsApp bot with listing facts and gets back bilingual (Hebrew + English) content for Instagram, Facebook and Yad2. Prospective buyers message a *separate, public* bot — on **either WhatsApp or Telegram** — and get honest answers about a property 24/7, captured as leads. Both show up in a Next.js dashboard the agent logs into. Built on Hermes, one dedicated instance per customer.

Read [CLAUDE.md](CLAUDE.md) for the brief, architecture and engineering history; [TODO.md](TODO.md) for what's outstanding. Repo: https://github.com/njkarp06-design/AutoEstate (private).

### Where things stand

- **Every roadmap feature is built, live-tested and merged**, and so is the channel-consolidation work started on 2026-07-28. **Everything remaining is productionization**, and the two things that gate a pilot are account-level and belong to the owner.
- **Per-listing ref codes are live (TODO 12d).** Every listing carries a short code (`REF-V42TS`); the dashboard gives the agent a copy-ready `wa.me` ad link that prefills it, so a buyer's first message identifies the exact property. **Live-tested on real WhatsApp by a genuine third party** — the code resolved with no disambiguation, the lead linked to the right listing, and their phone number was captured.
- **The buyer bot runs on both Telegram and WhatsApp**, and answers amenity questions from the footer's `Features:` line — deferring on an unlisted feature rather than inferring absence. Both verified live.
- **The agent-facing channel now ships Telegram too (TODO 12a).** Decision: **both channels, drop WhatsApp later** — it buys optionality on the one unknown (will Tel Aviv agents work in Telegram?) while deletion stays cheap. The Terraform module had shipped **no** Telegram at all; it now does. `listing-to-social` is proven end-to-end over Telegram; **the other four skills are not**.
- **The target is one number per customer**, not two: operator → Telegram, buyer → Cloud API. Cloud API alone does *not* reduce the count — number count is roles × customers, and the roles are forced by Hermes's gating. A single shared buyer number was **rejected as the destination** (an unbound buyer is a lost lead) but kept as an onboarding bridge and a cheap tier. TODO item 12 owns the checklist; CLAUDE.md owns the reasoning.
- **Nothing is hosted.** The reporting app runs only via `npm run dev` (port 4127). The Terraform module is `validate`-clean but has **never been applied** — there is no Hetzner account.
- **Whether a PR is open is deliberately not stated here** — it changes the moment anything merges, which is how this sentence has already gone stale once. Run `gh pr list`. Merged branches are deleted on merge, so `git branch -a` corroborates it.

### Live systems

Verified **2026-07-28** by listing processes, hashing files, calling the routes and resolving config through Hermes's own resolvers. PIDs are a dated observation — re-derive rather than trust them.

| | State |
|---|---|
| `default` Hermes gateway | running, PID 1976 (unrelated personal profile) |
| `autoestate` gateway (operator) | running **detached** (`pythonw`, PID 43308) via the `Hermes_Gateway_autoestate.vbs` startup item. Use `gateway start` (service), **not** `gateway run` (foreground) — `run` ties the live bot to a terminal window |
| `autoestate-buyer` gateway | **stopped**, deliberately — it is public whenever it runs, so start it only to test and stop it after (done three times on 07-28). Both channels credentialled: Telegram `@autoestate_buyer_bot` + a paired dedicated WhatsApp number `972555194380` |
| WhatsApp bridges | port **3000** = operator (PID 2996, unchanged since 07-24 — **never kill this**); port **3001** = buyer (PID 34008, survives its gateway stopping, which also keeps the linked device alive) |
| Reporting app, 127.0.0.1:4127 | running. Machine routes healthy — `401` on the two GETs, `405` on the two POST-only ones — which also proves the Prisma client is current with the `refCode` migration |
| Repo↔live plugin parity | **5/5**, re-checked after the last merge. Split by role — operator has `sync-to-webapp` / `listing-footer-reminder` / `active-listings-context`, buyer has `buyer-listings-context` (1.2) / `sync-inquiries-to-webapp` |
| Repo↔live buyer `config.yaml` | no drift (parsed YAML, excluding the `MACHINE-SPECIFIC` keys) |
| Terraform template ↔ dev operator profile | **0 drift**, on a recipe widened 2026-07-28 to compare the *set* of `display.platforms` as well as the keys inside each — the old version compared `whatsapp` only and so could not see that the template shipped no Telegram at all |
| Dev database | 1 customer; **24 runs (1 of them the first-ever Telegram run)**; **5 listings, all carrying ref codes** — 3 ACTIVE (Rothschild *with features*, Neve Tzedek, Shenkin `REF-QTPT4`), 2 SOLD (Ben Gurion, Dizengoff); **6 inquiries**, two linked to Rothschild by ref code, one of them a genuine third party **with a captured contact** |
| Reporting-app schema | migration `20260728193000_add_listing_ref_code_and_buyer_number` applied 2026-07-28, 4 pre-existing listings backfilled; dev server restarted after (required — the Prisma client loads at start) |
| `tsc` / `eslint` / `next build` / `terraform fmt` / `validate` | all clean. `next build` was run for real (dev server stopped first) — it catches `"use server"` export errors neither `tsc` nor eslint sees |

### What to do next

Two account-level steps remain the real gate for a pilot — both need the owner, both cost money — plus the unblocked halves of item 12 below, which need neither:

1. **Create a Hetzner account, then `terraform apply`** (TODO item 3). Three things there have **never run**: the operator SSH key must be uploaded to the project once beforehand (Hetzner rejects a duplicate public key, so the module looks it up); skills and plugins arrive via post-boot SSH upload rather than cloud-init, so confirm they landed; and operator slash-command access is ungated by default on that box — a deliberate accepted grant to settle with a real instance in front of you.
2. **Deploy the reporting app to Vercel Pro** (item 4). **Land the partial unique index on `Listing` first** — the current `Serializable` transaction removes the ingest dedupe race on that code path, but the durable guarantee needs `UNIQUE (customerId, lower(area), rooms, sqm) WHERE status <> 'SOLD'`, and the obvious plain `@@unique` is wrong because it would block a legitimate relist of a sold property.

**Then, before any real customer:**

3. **Harden the public buyer instance** (items 5–6): OS-level isolation, and re-running `hermes security audit` once anything is exposed. *(The "global `.env` puts a Gmail credential on that box" item was **disproved 2026-07-28** by running Hermes's own env loader — profiles do not inherit it, and the buyer profile resolves no `email` platform and no `EMAIL_PASSWORD`. Nothing to do; see TODO.)*
4. **Add `WHATSAPP_ALLOW_ALL_USERS=true`** to any buyer instance Terraform provisions — with `dm_policy: open` Hermes refuses to boot without it. It blocked the dev instance and will block the first real one identically.

**Then the target state, and it is not a pilot blocker:**

5. **Migrate the buyer channel to the official WhatsApp Cloud API** — TODO item 12b, and **step 4 of TODO's ordered path**. The first thing step 1 unlocks: blocked *only* on the public HTTPS webhook the module's no-inbound-but-SSH firewall forbids. Deliberately last here because Baileys is live and tested, so a pilot does not wait on it. **Close the `whatsapp_cloud` lockdown gate in the same change, never after** — it is a distinct platform name, so neither `platform_toolsets` nor slash gating covers it, and an ungated block puts every stranger back at admin tier on ~68 commands, `/profile` included. Hermes ships the adapter; the data plane has accepted `whatsapp_cloud` since 2026-07-28. Per-customer **Meta business verification** is the real onboarding friction it introduces.

**Non-blocking:** create the Telegram notifier bot and set `OPERATOR_TELEGRAM_BOT_TOKEN` so operator lead alerts push. The dashboard records leads either way.

**Listing photos/videos (TODO item 13) — scoped 2026-07-29, not started.** Two of three legs already exist in Hermes: inbound media is cached per-profile (video included), and outbound delivery needs **no new tool** (`MEDIA:<path>` in reply text). The blob store is **decided — Cloudflare R2**, chosen on zero egress and on S3 compatibility serving both the Next.js and Python runtimes; **no Cloudflare account, bucket or credential exists yet**, which is the first step and is the owner's. Scoping it also found and closed a live security gap — see the outbound-file-delivery gotcha below.

**Channel consolidation (TODO item 12) — decided, built and live-tested 2026-07-28.** Both unblocked halves are done:

- **12a — agent-facing Telegram. Decision: both channels, drop WhatsApp later.** The dev profile already ran Telegram on a **live** token (verified via `getMe`, now renamed to "AutoEstate"); the real gap was that the **Terraform template shipped no Telegram at all**, so every customer would have been WhatsApp-only. Now wired alongside WhatsApp — an empty token starts no adapter, and `variables.tf` names exactly what to delete when WhatsApp goes. Rendered in `terraform console`, `fmt`/`validate` clean, **never applied**. `listing-to-social` is proven end-to-end over Telegram (`REF-QTPT4`, Shenkin — the first real listing that channel ever carried), with the footer-reminder plugin confirmed firing there via `api_content`. **The other four skills remain unverified on Telegram.**
- **12d — per-listing ref codes. Built, merged, deployed and live-tested on both channels.** A real ad link resolved `REF-V42TS` straight to Rothschild with no disambiguation, deferred on an unlisted feature and answered a listed one; `api_content` confirmed the injected rule reached the model. **The live test found a defect the feature itself introduced** — a buyer arriving by ad link never types an area name, so the lead failed to link to its listing. Fixed (codes checked first in `/api/inquiries`) and proven by replaying the real turn.

12b (buyer → Cloud API) is the one half still blocked, on Hetzner. It is now **step 5 of the ordered list above** (TODO's step 4) rather than a loose aspiration: until 2026-07-29 it carried a full checklist inside item 12b but appeared in neither file's ordered path, so the one migration `terraform apply` unlocks was invisible to anyone reading the list they actually follow.

### Open questions for the owner

**None.** The operator bot's *display name* is now "AutoEstate", though its **username is still `@autoestate_test_bot`** — and that is settled rather than open: **a Telegram bot's username is permanent.** There is no `/setusername`; BotFather changes the name, about text, picture, commands and privacy, not the username. Changing it means `/newbot`, which mints a **new token** that would then have to be written into the profile `.env` and the Terraform variable. Deliberately left alone: only the owner messages that bot, the display name already reads correctly, and a real customer gets their own bot created fresh — at which point the username is chosen once, permanently.

Everything else is closed. The buyer bot has a fresh token and a paired WhatsApp number, both verified live; group-joining is now disabled on both bots (`can_join_groups: False`, confirmed via `getMe`). **Anthropic auto-reload billing: the owner reported it enabled, but on 2026-07-28 the shared key was found genuinely out of credit and the owner topped up manually — so whatever the setting says, it did not prevent an exhaustion that day.** All three `.env` files hold the *same* key, so this is one balance for the whole project. The only things still outside the repo's control are **Hetzner and Vercel**; neither account exists.

### Working conventions

- **Git:** `main` → feature branch → PR. Never commit to `main`. **Never merge without asking** — the owner asks explicitly each time.
- **No hooks exist in this repo.** Doc-sync is a convention: record real changes as part of finishing a task. Do not reintroduce automation.
- **Verify by running something.** CLAUDE.md §5 carries the exact recipes — a profile's real tool list, its visible skills, slash-command policy, repo↔live parity, Terraform-template↔dev-profile parity, what the model was actually sent on a turn, and whether a "revoked" credential is really dead. Every one has caught something real.
- **Merging deploys nothing.** Plugins are physical copies inside each profile. A plugin PR is not finished until the parity recipe passes and the gateway has been restarted — by the **owner, from their own shell**. Restarting from an agent session has caused a full outage before.

### Environment gotchas

- **`sender_id` *is* available to plugin hooks** (`pre_llm_call` and `post_llm_call` both — `agent/turn_context.py:740`). Docs said otherwise until 2026-07-28; two sites corrected. It does **not** let you gate by role — a plugin can only inject text, and text doesn't reliably stop the model acting. Sender identity still never reaches a *skill*, which is what forces role-by-channel isolation.
- **A skill edit never reaches a conversation already in progress.** A running session answers from the copy it loaded at session start — proven again 2026-07-28 (one `skill_view` call in a session's whole life). Use `/new` to pick a change up, or test with a fresh sender. New buyers get changes automatically; existing threads don't.
- **Outbound file delivery is triggered by reply TEXT, not a tool.** The model emitting `MEDIA:<abs path>` makes the gateway deliver that file, so no tool lockdown constrains it. The buyer profile now sets `gateway.strict: true` **and** `gateway.trust_recent_files: false` (2026-07-29) — the second is load-bearing, because strict alone keeps a 600s recency fallback and `state.db` is rewritten every turn. Media must be written into the profile cache roots to stay deliverable. The operator profile is deliberately still on the default.
- **Never let the buyer gateway run with the default WhatsApp `bridge_port`.** The adapter defaults to 3000 and kills whatever holds that port on start — 3000 is the **live operator bridge**. The buyer config pins `3001`; do not "tidy" it. Pairing is unaffected (`--pair-only` starts no HTTP server).
- **`gateway run` is foreground, `gateway start` is the detached service.** Using `run` on the operator briefly made a production bot depend on a PowerShell window staying open.
- Use **`127.0.0.1`**, never `localhost` (IPv6 collision). A page-route 500 on 4127 is usually a transient Turbopack recompile; an API route returning 401 proves the agent-facing path is fine.
- **Never edit a profile's `config.yaml` while its gateway is running** — the gateway rewrites the file, strips comments, and clobbers concurrent edits. The commented copies under `agent/profiles/` are the source of truth; compare as parsed YAML, not text.
- Per-profile logs: `%LOCALAPPDATA%\hermes\profiles\<profile>\logs\gateway.log` — not the shared path (which has misled a session).
- **After ANY schema change, restart the `next dev` server on 4127.** The Prisma client loads at server *start*. Symptom: machine routes 500 where they used to 401 — and while it lasts, the live gateway's sync POSTs fail, so a real turn is lost.
- **Don't run `npm run build` while the dev server is up** — shared `.next/`. Use `lint` + `tsc`, but remember `next build` catches things neither does.
- **Credit exhaustion is still a live failure mode.** Auto-reload was reported enabled, yet on 2026-07-28 the key was found out of credit and needed a manual top-up. All three profiles share **one** key, so one empty balance takes down everything. Before any live test, ask the provider: a one-token `POST /v1/messages` returns `400` with *"credit balance is too low"* when it is dry. That is a real check; the dashboard balance lags and briefly showed nothing after a successful purchase.

### How to resume

> Read session-handoff-2026-07-28.md and continue. Everything is built, merged and live-tested — including the channel-consolidation work (TODO item 12: ref codes, and agent-facing Telegram in Terraform). Verify with `git log origin/main..` and `gh pr list --state all` rather than trusting any branch/PR claim here, and re-run CLAUDE.md §5's parity recipes rather than trusting the parity lines. **What's left is productionization**, starting with whichever account-level step I authorize — Hetzner + `terraform apply` (TODO item 3) or the Vercel deploy (item 4, and land the partial unique index on `Listing` first). **Don't start either without me:** both cost money and neither account exists. If you want unblocked work instead, the honest gap is the **four skills never tested over Telegram** (only `listing-to-social` has been); **12b**, the Cloud API migration, is now step 5 of the ordered list but is Hetzner-gated, so it is not available as unblocked work. Four things to know before planning. **The buyer bot is paired on both channels but its gateway is stopped** — it is public whenever it runs, so start it only to test and stop it after. **Its WhatsApp `bridge_port` must stay 3001**, because the adapter kills whatever holds its port on startup and its default is 3000, the live operator bridge. **A skill edit does not reach a conversation already in progress** — use `/new` or a fresh sender. And **credit exhaustion is a live failure mode, not a solved one** — all three profiles share one Anthropic key, so ask the provider before any live test rather than trusting the console balance. If a dev server is running from an older checkout, restart it: the Prisma client loads at start, so it will 500 on every machine route until you do.
