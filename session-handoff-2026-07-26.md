## Session Handoff — 2026-07-26

### What this project is

**AutoEstate** — marketing automation for independent real estate agents in Tel Aviv. An agent messages a WhatsApp bot with listing facts and gets back bilingual (Hebrew + English) content for Instagram, Facebook and Yad2. Prospective buyers message a *separate, public* bot and get honest answers about a property 24/7, captured as leads. Both show up in a Next.js dashboard the agent logs into. Built on Hermes, one dedicated instance per customer.

Read [CLAUDE.md](CLAUDE.md) for the brief, architecture and engineering history; [TODO.md](TODO.md) for what's outstanding. Repo: https://github.com/njkarp06-design/AutoEstate (private).

### Where things stand

- **All planned features are built, live-tested and merged.** The last, buyer-inquiry, shipped in **PR #34** on 2026-07-26. `main` is at `7ba4c21`.
- **Nothing is blocked on more building.** Everything remaining is productionization.
- **Current branch: `docs/buyer-inquiry-merged`, with PR #35 open** — documentation only, no code. It records the merge and this doc-consistency pass. Merge or close it before starting new work; nothing depends on it.
- **Nothing is deployed.** The reporting app runs only via `npm run dev` (port 4127). The Terraform module is written and validated but has **never been applied** — there is no Hetzner account yet.

### Live systems, verified 2026-07-26

| | State |
|---|---|
| `default` Hermes gateway | running (unrelated personal profile) |
| `autoestate` gateway (operator) | running — the live WhatsApp bot |
| `autoestate-buyer` gateway | **stopped deliberately** after testing |
| WhatsApp bridge, port 3000 | running — **never kill this** |
| Reporting app, 127.0.0.1:4127 | running |
| Repo↔live plugin parity (5 plugins) | all match |
| Repo↔live buyer config parity | no drift |

The buyer bot (`@autoestate_buyerdev_bot`) accepts messages from anyone by design, which is why it is stopped rather than idling. Restart with `hermes -p autoestate-buyer gateway run`.

### What to do next

**The two account-level steps are the real gate, and both need the owner** — I cannot create accounts:

1. **Create a Hetzner account, then `terraform apply`** (TODO item 3). Verify boot, cloud-init and secret injection end to end. Everything else about per-customer provisioning is written and waiting on this.
2. **Deploy the reporting app to Vercel Pro** (item 4) — set up the project, wire production Neon + Clerk env vars, verify authenticated multi-tenant access.

**Then, before any real customer touches it:**

3. **Harden the public buyer instance** (items 5–6). It currently runs with no OS-level isolation (`terminal.backend: local`) and shares the operator's ingestion secret, which also grants write access to `/api/ingest`. It needs container isolation and a scoped, read-limited second secret. Re-run `hermes security audit` once anything is publicly exposed — ~50 known CVEs are currently unreachable only because nothing is exposed.
4. **Re-confirm open-channel behaviour on WhatsApp.** Everything about strangers reaching a public bot was proven on **Telegram only**.
5. **Settle the buyer-channel transport** (open decision in TODO) — a second eSIM per customer, the official Cloud API, or staying non-WhatsApp. No code depends on it.

**Non-blocking:** create the Telegram notifier bot and set `OPERATOR_TELEGRAM_BOT_TOKEN` so operator lead alerts actually push. The dashboard records leads either way.

### Open questions for the owner

- **Should the dev buyer bot's token be revoked?** The 2026-07-25 spike bot's token was revoked as hygiene once done. This one is still valid; the bot is merely stopped. Low risk (nothing answers), but it is an outstanding credential.
- **Anthropic auto-reload billing** — recommended after repeated mid-session outages when credits ran dry. **Never confirmed enabled**; unverified as of 2026-07-26.

### Working conventions

- **Git:** `main` → feature branch → PR. Never commit to `main`. **Never merge without asking.**
- **No hooks exist in this repo** — `.claude/settings.json` was deleted 2026-07-26 at the owner's request, and PR #33 (a `Stop`-hook doc checker) was closed for the same reason. Keeping CLAUDE.md / TODO.md / this file current is a convention: record real changes as part of finishing a task and say which files were touched. Do not reintroduce automation.
- **Verify by running something.** CLAUDE.md section 5 ends with the exact recipes — resolving a profile's real tool list, its visible skills, slash-command policy, and repo↔live parity. Every one caught a real defect on 2026-07-26.

### Environment gotchas

- Use **`127.0.0.1`**, never `localhost` (IPv6 collision on this machine). A page-route **500 on 4127 is usually a transient Turbopack recompile** — re-check before restarting; check an API route (401 = healthy) to confirm the agent-facing path is fine.
- **Never edit a profile's `config.yaml` while its gateway is running.** The gateway rewrites the file, strips every comment, and silently clobbers concurrent edits. The commented copies under `agent/profiles/` are the source of truth — compare them as parsed YAML, not as text.
- Per-profile logs: `%LOCALAPPDATA%\hermes\profiles\<profile>\logs\gateway.log`. Not the shared path (which has misled a session), and not `session-run.log` (stdout is unflushed and it stays near-empty).
- Dev DB: one customer, four listings — 2 `ACTIVE` (Rothschild Boulevard, Neve Tzedek, seeded for testing) and 2 `SOLD` (Ben Gurion, Dizengoff).
- Anthropic credits on this key have run dry repeatedly and caused live outages.

### How to resume

> Read session-handoff-2026-07-26.md and continue. Everything is built and merged as of PR #34; nothing is blocked on more building. PR #35 (docs only) is open — merge or close it first. What's left is productionization, starting with whichever account-level step I want to authorize: Hetzner + `terraform apply`, or the Vercel deploy.
