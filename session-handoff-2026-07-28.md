## Session Handoff — 2026-07-28

### What this project is

**AutoEstate** — marketing automation for independent real estate agents in Tel Aviv. An agent messages a WhatsApp bot with listing facts and gets back bilingual (Hebrew + English) content for Instagram, Facebook and Yad2. Prospective buyers message a *separate, public* bot and get honest answers about a property 24/7, captured as leads. Both show up in a Next.js dashboard the agent logs into. Built on Hermes, one dedicated instance per customer.

Read [CLAUDE.md](CLAUDE.md) for the brief, architecture and engineering history; [TODO.md](TODO.md) for what's outstanding. Repo: https://github.com/njkarp06-design/AutoEstate (private).

### Where things stand

- **All planned features are built, live-tested and merged.** The last, buyer-inquiry, shipped in PR #34 on 2026-07-26. **Nothing is blocked on more building** — everything remaining is productionization.
- **Whether anything is in flight is deliberately not stated here** — it changes the moment anything merges, including the PR that would update this line, which is how this sentence has already gone stale once. Run `gh pr list`. Beyond `main` and whatever is genuinely in flight there are **no other branches** — the long-lived `chore/doc-consistency-checker` was retired on 2026-07-28 after its one real run produced nothing actionable, and its commits live on as the tag `archive/doc-consistency-checker`. Nothing needs cherry-picking or protecting from deletion any more.
- **Nothing is deployed.** The reporting app runs only via `npm run dev` (port 4127). The Terraform module is written and `validate`-clean but has **never been applied** — there is no Hetzner account.
- **The buyer bot now speaks Telegram AND WhatsApp, and both are PAIRED AND LIVE-TESTED** (2026-07-28). Facebook-sourced buyers reply on Telegram, Yad2/Instagram-sourced on WhatsApp. This settled TODO's long-open buyer-channel-transport decision. A real WhatsApp buyer conversation ran end to end: honest SOLD status, no invented facts, Hebrew mirroring, contact captured (`0524419087`), lead synced and linked to Rothschild. **That was the first WhatsApp buyer lead ever** — it closes the open-channel item that had only ever been proven on Telegram.
- **Four customer-facing presentation defects found by that test and fixed** (PR #54): the `/sethome` prompt that fired on every new buyer's first message, the `📚 Reading skill` breadcrumb, no holding message while thinking, and replies reciting the whole listing row. Plus a fifth the test surfaced: the bot claimed *"I've passed your details along to the agent"* while asking for the number for the first time. All verified fixed on a live re-test.
- **The buyer instance is running.** Its Telegram token was replaced (verified live as `@autoestate_buyer_bot`) and a dedicated WhatsApp number is paired. **It is public while running** — stop it when not testing.
- **Nothing is half-deployed.** PR #52's five plugins and the buyer `config.yaml` are deployed and verified (parity 5/5, buyer config clean, live-profile resolution confirms the WhatsApp lockdown), and the owner restarted the operator gateway onto the new code at 15:53 on 2026-07-28. Re-run CLAUDE.md §5's parity recipe rather than trusting this line — the next plugin change invalidates it.

### Live systems

Gateway, bridge and config rows verified **2026-07-28** by listing processes and resolving config through Hermes's own resolvers. Route/database/toolchain rows were last exercised the same day via the live buyer test. PIDs are a dated observation — re-derive rather than trust them.

| | State |
|---|---|
| `default` Hermes gateway | running, PID 1976 (unrelated personal profile) |
| `autoestate` gateway (operator) | running **detached** (`pythonw`, PID 34156 as of 2026-07-28 17:22) via the `Hermes_Gateway_autoestate.vbs` startup item. Use `gateway start` (service), not `gateway run` (foreground) — `run` ties the live bot to a terminal window |
| `autoestate-buyer` gateway | running in the **foreground** (deliberately: it is a public bot, so Ctrl+C stops it when testing ends). Telegram `@autoestate_buyer_bot` + a dedicated paired WhatsApp number |
| WhatsApp bridges | port **3000** = operator (PID 2996, unchanged since 07-24 — **never kill this**); port **3001** = buyer. The buyer's `bridge_port: 3001` is load-bearing: the adapter kills whatever holds its port on start, and its default is 3000 |
| Reporting app, 127.0.0.1:4127 | running, PID 10312. All four machine routes return 401, which also proves the Prisma client is current with the latest migration |
| Repo↔live plugin parity | 5/5, correctly split by role — operator has `sync-to-webapp` / `listing-footer-reminder` / `active-listings-context`, buyer has `buyer-listings-context` / `sync-inquiries-to-webapp` |
| Repo↔live buyer `config.yaml` + `SOUL.md` | no drift (config compared as parsed YAML, excluding the keys marked `MACHINE-SPECIFIC`) |
| Dev database | 1 customer with **both** machine credentials set; 4 listings (2 ACTIVE — Rothschild Boulevard, Neve Tzedek; 2 SOLD — Ben Gurion, Dizengoff); **3** inquiries as of 2026-07-28 (2 Telegram + the first-ever WhatsApp one), two with a captured contact |
| `lint` / `tsc` / `terraform fmt` / `terraform validate` | all clean |

PIDs are a dated observation, not a standing fact — re-derive rather than trust them.

### What to do next

**Everything that can be done without an account is done.** The two account-level steps are the real gate and both need the owner — I cannot create accounts, and both cost money:

1. **Create a Hetzner account, then `terraform apply`** (TODO item 3). Verify boot, cloud-init and secret injection end to end. Three things there have **never run**: the operator SSH key must be uploaded to the project once beforehand (Hetzner rejects a duplicate public key, so the module looks it up rather than creating one per customer); skills and plugins arrive via a post-boot SSH upload rather than cloud-init, so confirm they actually landed; and operator slash-command access is ungated by default on that instance, which is a deliberate accepted grant to settle with a real box in front of you.
2. **Deploy the reporting app to Vercel Pro** (item 4) — set up the project, wire production Neon + Clerk env vars, verify authenticated multi-tenant access. **Land the partial unique index on `Listing` before this** (a deploy gate in TODO): the current `Serializable` transaction removes the ingest dedupe race on that code path, but the durable guarantee needs `UNIQUE (customerId, lower(area), rooms, sqm) WHERE status <> 'SOLD'` — and the obvious plain `@@unique` is wrong, because it would block a legitimate relist of a sold property.

**Then, before any real customer touches it:**

3. **Harden the public buyer instance** (items 5–6). It no longer shares the operator's ingestion secret — fixed 2026-07-27, and its own credential is rejected by `/api/ingest`. What remains is OS-level isolation (`terminal.backend: local`, no sandboxing) and re-running `hermes security audit` once anything is publicly exposed; ~50 known CVEs are currently unreachable only because nothing is exposed.
4. ~~Settle the buyer-channel transport.~~ **Done 2026-07-28** — both Telegram and WhatsApp, with the tool and slash-command gating landed in the *same change* as the transport, as the gate demanded. **The equivalent gate is still open for `whatsapp_cloud`**, which registers as a distinct platform name that neither lockdown covers; its admin id is unknowable until a real Cloud sender exists, so it was deliberately not pre-written.
5. **Pair the two buyer channels** — a fresh BotFather token, and an SMS-capable number on a **dedicated** line for WhatsApp (never the operator's, never personal: a Baileys ban takes that number's WhatsApp with it). Pairing is safe at any time and will not disturb the live operator bridge — `--pair-only` starts no HTTP server. Then uncomment the three `WHATSAPP_*` vars.
6. **Re-confirm open-channel behaviour on WhatsApp.** Everything about strangers reaching a public bot was proven on **Telegram only**. Now blocked purely on step 5's credentials, not on any decision.

**Non-blocking:** create the Telegram notifier bot and set `OPERATOR_TELEGRAM_BOT_TOKEN` so operator lead alerts actually push. The dashboard records leads either way, and no customer has a chat id set yet.

### Open questions for the owner

**None.** The buyer bot has a fresh token (verified live as `@autoestate_buyer_bot`) and a paired WhatsApp number, so it is fully operational. Anthropic auto-reload billing, long the outstanding one, was **enabled by the owner on 2026-07-28** — closing the most recurrent live-outage mode this project has had (TODO item 9). Owner-reported; it has no API surface to verify from here. As of 2026-07-28 the only things still outside the repo's control are **Hetzner and Vercel** — neither account exists.

### Working conventions

- **Git:** `main` → feature branch → PR. Never commit to `main`. **Never merge without asking.** The owner once explicitly asked for a merge in-turn (PR #37); that was a one-off instruction, not a policy change — keep asking.
- **No hooks exist in this repo.** `.claude/settings.json` was deleted 2026-07-26 at the owner's request, and PR #33 (a `Stop`-hook doc checker) was closed for the same reason. Keeping these three docs current is a convention: record real changes as part of finishing a task and say which files were touched. Do not reintroduce automation.
- **Verify by running something.** CLAUDE.md §5 ends with the exact recipes — resolving a profile's real tool list, its visible skills, slash-command policy, repo↔live parity, what the model was actually sent on a turn, and whether a credential someone says they revoked is actually dead. Every one has caught something real.
- **Merging deploys nothing.** Plugins are physical copies inside each profile's `plugins/` dir. A plugin PR is not finished until the parity recipe passes and the gateway has been restarted — by the **owner, from their own shell**. Restarting it from an agent session has caused a full outage before.

### Environment gotchas

- **Never let the buyer gateway run with the default WhatsApp `bridge_port`.** The adapter defaults to 3000 and kills whatever holds that port on start — and 3000 is the **live operator bridge**. The buyer config pins `3001`; do not "tidy" it. Pairing is unaffected (`--pair-only` starts no HTTP server).
- Use **`127.0.0.1`**, never `localhost` (IPv6 collision on this machine). A page-route **500 on 4127 is usually a transient Turbopack recompile** — re-check before restarting; an API route returning 401 proves the agent-facing path is fine.
- **Never edit a profile's `config.yaml` while its gateway is running.** The gateway rewrites the file, strips every comment, and silently clobbers concurrent edits. The commented copies under `agent/profiles/` are the source of truth — compare them as parsed YAML, not as text.
- Per-profile logs: `%LOCALAPPDATA%\hermes\profiles\<profile>\logs\gateway.log`. Not the shared path (which has misled a session), and not `session-run.log` (stdout is unflushed and it stays near-empty).
- **After ANY schema change, restart the `next dev` server on 4127.** The generated Prisma client loads at server *start*, never by hot-reload. Symptom: machine routes return **500 where they used to return 401** — and while it lasts, the live gateway's sync POSTs fail, so a real WhatsApp turn is lost outright.
- **Don't run `npm run build` while the dev server is up** — they share `.next/`. Use `lint` + `tsc` for a routine check, and remember `next build` catches things neither does (it alone caught a `"use server"` export error).
- **Anthropic credits on this key have run dry repeatedly and caused live outages. Auto-reload was ENABLED on 2026-07-28**, which should end that. If the live bot ever returns credit-balance errors again, that is still this rather than a code fault — check console.anthropic.com before debugging code.

### How to resume

> Read session-handoff-2026-07-28.md and continue. Everything is built and merged; verify with `git log origin/main..` and `gh pr list --state all` rather than trusting any branch/PR claim in these docs, and re-run CLAUDE.md §5's parity recipe rather than trusting the plugin-parity line. What's left is productionization, starting with whichever account-level step I authorize — Hetzner + `terraform apply` (TODO item 3) or the Vercel deploy (item 4). **Don't start either without me:** both cost money and neither account exists. Three things to know before you plan. **The buyer bot is fully live** on both Telegram and WhatsApp, paired and end-to-end tested against a real buyer conversation — so it is *public whenever its gateway runs*; stop it when not testing. **Its WhatsApp `bridge_port` must stay 3001**, because the adapter kills whatever holds its port on startup and its default is 3000, which is the live operator bridge. And **a skill edit does not reach a conversation already in progress** — a running session answers from the copy it loaded at session start, so use `/new` to pick up a change, or test with a fresh sender. If a dev server is running from an older checkout, restart it — the Prisma client loads at start, so it will 500 on every machine route until you do.
