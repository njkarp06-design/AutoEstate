## Session Handoff — 2026-07-28

### What this project is

**AutoEstate** — marketing automation for independent real estate agents in Tel Aviv. An agent messages a WhatsApp bot with listing facts and gets back bilingual (Hebrew + English) content for Instagram, Facebook and Yad2. Prospective buyers message a *separate, public* bot and get honest answers about a property 24/7, captured as leads. Both show up in a Next.js dashboard the agent logs into. Built on Hermes, one dedicated instance per customer.

Read [CLAUDE.md](CLAUDE.md) for the brief, architecture and engineering history; [TODO.md](TODO.md) for what's outstanding. Repo: https://github.com/njkarp06-design/AutoEstate (private).

### Where things stand

- **All planned features are built, live-tested and merged.** The last, buyer-inquiry, shipped in PR #34 on 2026-07-26. **Nothing is blocked on more building** — everything remaining is productionization.
- **Whether anything is in flight is deliberately not stated here** — it changes the moment anything merges, including the PR that would update this line, which is how this sentence has already gone stale once. Run `gh pr list`. Beyond `main` and whatever is genuinely in flight there are **no other branches** — the long-lived `chore/doc-consistency-checker` was retired on 2026-07-28 after its one real run produced nothing actionable, and its commits live on as the tag `archive/doc-consistency-checker`. Nothing needs cherry-picking or protecting from deletion any more.
- **Nothing is deployed.** The reporting app runs only via `npm run dev` (port 4127). The Terraform module is written and `validate`-clean but has **never been applied** — there is no Hetzner account.
- **The buyer bot now speaks Telegram AND WhatsApp** (2026-07-28) — Facebook-sourced buyers reply on Telegram, Yad2/Instagram-sourced buyers on WhatsApp. Built, gated and verified by resolution; **ready to pair, not paired**. This settled TODO's long-open buyer-channel-transport decision.
- **The buyer instance still cannot be started.** Its Telegram token was revoked by the owner after testing (correct — it was a public bot). Verified, not assumed: `getMe` with the token still in its `.env` returns 401. It now also needs a dedicated second WhatsApp number. The profile, both lockdowns and both plugins are intact and version-controlled; only the credentials are missing. TODO item 10.
- **Nothing is half-deployed, with one named exception.** PR #52's five plugins and the buyer `config.yaml` are deployed to the live profiles and verified (parity 5/5, buyer config clean, live-profile resolution confirms the WhatsApp lockdown). **The operator gateway has not been restarted**, so PID 36868 still runs pre-#52 plugin code until the owner runs `hermes -p autoestate gateway restart` from their own shell. Re-run CLAUDE.md §5's parity recipe rather than trusting this line.

### Live systems

Verified 2026-07-27 by listing processes, hashing files and calling the routes. The gateway rows and plugin parity were **re-confirmed 2026-07-28** after a merge; the route, database and toolchain rows still stand from the 27th and have not been re-run since.

| | State |
|---|---|
| `default` Hermes gateway | running, PID 1976 (unrelated personal profile) |
| `autoestate` gateway (operator) | running, PID 36868 — the live WhatsApp bot. Started 19:58:34, five minutes *after* the newest plugin file was written at 19:53, which is what proves loaded code rather than a cache |
| `autoestate-buyer` gateway | **stopped deliberately**, and its token is revoked |
| WhatsApp bridge, port 3000 | running, PID 2996 — **never kill this** |
| Reporting app, 127.0.0.1:4127 | running, PID 10312. All four machine routes return 401, which also proves the Prisma client is current with the latest migration |
| Repo↔live plugin parity | 5/5, correctly split by role — operator has `sync-to-webapp` / `listing-footer-reminder` / `active-listings-context`, buyer has `buyer-listings-context` / `sync-inquiries-to-webapp` |
| Repo↔live buyer `config.yaml` + `SOUL.md` | no drift (config compared as parsed YAML, excluding the keys marked `MACHINE-SPECIFIC`) |
| Dev database | 1 customer with **both** machine credentials set; 4 listings (2 ACTIVE — Rothschild Boulevard, Neve Tzedek; 2 SOLD — Ben Gurion, Dizengoff); 2 inquiries, one with a captured contact |
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

**None.** Both long-standing questions were answered on 2026-07-27 — the buyer bot token is revoked, and Anthropic auto-reload billing is confirmed **off**, which makes the recurring credit-exhaustion outage a matter of when, not if (TODO item 9). Asked again the same day whether anything had changed outside the repo — Hetzner, Vercel, auto-reload, a new bot token, the transport decision — and the answer was **nothing has changed**.

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
- **Anthropic credits on this key have run dry repeatedly and caused live outages, and auto-reload is confirmed OFF.** Expect it again. If the live bot starts returning credit-balance errors, that is this, not a code fault — top up at console.anthropic.com.

### How to resume

> Read session-handoff-2026-07-28.md and continue. Everything is built and merged; verify with `git log origin/main..` and `gh pr list --state all` rather than trusting any branch/PR claim in these docs, and re-run CLAUDE.md §5's parity recipe rather than trusting the plugin-parity line. What's left is productionization, starting with whichever account-level step I authorize — Hetzner + `terraform apply` (TODO item 3) or the Vercel deploy (item 4). **Don't start either without me:** both cost money and neither account exists. Three things to know before you plan: the buyer bot is now built for **both Telegram and WhatsApp** and **deployed** to the live profiles, but **not paired**, and the operator gateway still needs a restart **by me, from my own shell** to pick up its three changed plugins; the buyer instance still can't start until a fresh BotFather token and a dedicated WhatsApp number exist; and if the buyer gateway is ever started, its WhatsApp `bridge_port` must stay **3001**, because the adapter's default of 3000 would kill the live operator bridge. If a dev server is running from an older checkout, restart it — the Prisma client loads at start, so it will 500 on every machine route until you do.
