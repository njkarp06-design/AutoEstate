## Session Handoff — 2026-07-27

### What this project is

**AutoEstate** — marketing automation for independent real estate agents in Tel Aviv. An agent messages a WhatsApp bot with listing facts and gets back bilingual (Hebrew + English) content for Instagram, Facebook and Yad2. Prospective buyers message a *separate, public* bot and get honest answers about a property 24/7, captured as leads. Both show up in a Next.js dashboard the agent logs into. Built on Hermes, one dedicated instance per customer.

Read [CLAUDE.md](CLAUDE.md) for the brief, architecture and engineering history; [TODO.md](TODO.md) for what's outstanding. Repo: https://github.com/njkarp06-design/AutoEstate (private).

### Where things stand

- **All planned features are built, live-tested and merged.** The last, buyer-inquiry, shipped in PR #34 on 2026-07-26. **Nothing is blocked on more building** — everything remaining is productionization.
- **On `main`, clean, nothing in flight.** Every PR opened to date is merged and no PR is open — deliberately not enumerated, since a PR range goes stale the moment the next one merges (including the one that updates this line). Check with `gh pr list`. Exactly two branches exist: `main`, and `chore/doc-consistency-checker`, which is **intentionally unmerged** and holds the only copy of the closed PR #33 doc-checker script (`.claude/doc-consistency-check.sh`). Do not delete it as stale — its commits exist nowhere else — and never merge it: it sits far behind `main` by design. Cherry-pick the script if you want it.
- **Nothing is deployed.** The reporting app runs only via `npm run dev` (port 4127). The Terraform module is written and `validate`-clean but has **never been applied** — there is no Hetzner account.
- **The buyer instance cannot currently be started.** Its Telegram token was revoked by the owner after testing (correct — it was a public bot). Verified, not assumed: `getMe` with the token still in its `.env` returns 401. The profile, its lockdown and both plugins are intact and version-controlled; only the credential is gone. TODO item 10.
- **Nothing is half-deployed.** Repo↔live plugin parity is 5/5 and the running operator gateway demonstrably loaded the current code. Re-run CLAUDE.md §5's parity recipe rather than trusting this line — the next plugin change invalidates it.

### Live systems — verified 2026-07-27 by listing processes, hashing files and calling the routes

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
4. **Settle the buyer-channel transport** (open decision in TODO) — a second eSIM per customer, the official Cloud API, or staying non-WhatsApp. No code depends on it, **but it carries a security gate**: the buyer profile's tool and slash-command lockdowns are keyed by platform and cover Telegram only, and slash gating switches on *only* when an admin list exists. Moving to WhatsApp without adding the matching block returns every stranger to admin tier on ~68 commands including `/profile`, which hands them the operator's `Listing`-mutating skills. Add the gating in the same change as the transport, never after.
5. **Re-confirm open-channel behaviour on WhatsApp.** Everything about strangers reaching a public bot was proven on **Telegram only**. Needs a runnable buyer instance either way, so it sits behind a fresh bot token or the transport decision.

**Non-blocking:** create the Telegram notifier bot and set `OPERATOR_TELEGRAM_BOT_TOKEN` so operator lead alerts actually push. The dashboard records leads either way, and no customer has a chat id set yet.

### Open questions for the owner

**None.** Both long-standing questions were answered on 2026-07-27 — the buyer bot token is revoked, and Anthropic auto-reload billing is confirmed **off**, which makes the recurring credit-exhaustion outage a matter of when, not if (TODO item 9). Asked again the same day whether anything had changed outside the repo — Hetzner, Vercel, auto-reload, a new bot token, the transport decision — and the answer was **nothing has changed**.

### Working conventions

- **Git:** `main` → feature branch → PR. Never commit to `main`. **Never merge without asking.** The owner once explicitly asked for a merge in-turn (PR #37); that was a one-off instruction, not a policy change — keep asking.
- **No hooks exist in this repo.** `.claude/settings.json` was deleted 2026-07-26 at the owner's request, and PR #33 (a `Stop`-hook doc checker) was closed for the same reason. Keeping these three docs current is a convention: record real changes as part of finishing a task and say which files were touched. Do not reintroduce automation.
- **Verify by running something.** CLAUDE.md §5 ends with the exact recipes — resolving a profile's real tool list, its visible skills, slash-command policy, repo↔live parity, what the model was actually sent on a turn, and whether a credential someone says they revoked is actually dead. Every one has caught something real.
- **Merging deploys nothing.** Plugins are physical copies inside each profile's `plugins/` dir. A plugin PR is not finished until the parity recipe passes and the gateway has been restarted — by the **owner, from their own shell**. Restarting it from an agent session has caused a full outage before.

### Environment gotchas

- Use **`127.0.0.1`**, never `localhost` (IPv6 collision on this machine). A page-route **500 on 4127 is usually a transient Turbopack recompile** — re-check before restarting; an API route returning 401 proves the agent-facing path is fine.
- **Never edit a profile's `config.yaml` while its gateway is running.** The gateway rewrites the file, strips every comment, and silently clobbers concurrent edits. The commented copies under `agent/profiles/` are the source of truth — compare them as parsed YAML, not as text.
- Per-profile logs: `%LOCALAPPDATA%\hermes\profiles\<profile>\logs\gateway.log`. Not the shared path (which has misled a session), and not `session-run.log` (stdout is unflushed and it stays near-empty).
- **After ANY schema change, restart the `next dev` server on 4127.** The generated Prisma client loads at server *start*, never by hot-reload. Symptom: machine routes return **500 where they used to return 401** — and while it lasts, the live gateway's sync POSTs fail, so a real WhatsApp turn is lost outright.
- **Don't run `npm run build` while the dev server is up** — they share `.next/`. Use `lint` + `tsc` for a routine check, and remember `next build` catches things neither does (it alone caught a `"use server"` export error).
- **Anthropic credits on this key have run dry repeatedly and caused live outages, and auto-reload is confirmed OFF.** Expect it again. If the live bot starts returning credit-balance errors, that is this, not a code fault — top up at console.anthropic.com.

### How to resume

> Read session-handoff-2026-07-27.md and continue. Everything is built and merged; verify with `git log origin/main..` and `gh pr list --state all` rather than trusting any branch/PR claim in these docs, and re-run CLAUDE.md §5's parity recipe rather than trusting the plugin-parity line. What's left is productionization, starting with whichever account-level step I authorize — Hetzner + `terraform apply` (TODO item 3) or the Vercel deploy (item 4). **Don't start either without me:** both cost money and neither account exists. Two things to know before you plan: the buyer-channel transport decision now carries a security gate, because the buyer profile's lockdowns are Telegram-only; and the buyer instance can't be started at all until a fresh BotFather token exists, since the old one is revoked (verified — `getMe` returns 401). If a dev server is running from an older checkout, restart it — the Prisma client loads at start, so it will 500 on every machine route until you do.
