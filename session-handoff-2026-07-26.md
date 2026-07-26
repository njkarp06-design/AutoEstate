## Session Handoff — 2026-07-26

### What this project is

**AutoEstate** — marketing automation for independent real estate agents in Tel Aviv. An agent messages a WhatsApp bot with listing facts and gets back bilingual (Hebrew + English) content for Instagram, Facebook and Yad2. Prospective buyers message a *separate, public* bot and get honest answers about a property 24/7, captured as leads. Both show up in a Next.js dashboard the agent logs into. Built on Hermes, one dedicated instance per customer.

Read [CLAUDE.md](CLAUDE.md) for the brief, architecture and engineering history; [TODO.md](TODO.md) for what's outstanding. Repo: https://github.com/njkarp06-design/AutoEstate (private).

### Where things stand

- **All planned features are built, live-tested and merged.** The last, buyer-inquiry, shipped in **PR #34** on 2026-07-26.
- **Nothing is blocked on more building.** Everything remaining is productionization.
- **On `main`, clean, nothing in flight.** PRs #34–#37 are all merged; **no PR is open**. The last, **#37** (the `/inspect` sweep), merged 2026-07-26 23:11 UTC and its branch is deleted. Three merged branches still exist locally and on origin and are safe to delete: `feat/buyer-inquiry`, `docs/buyer-inquiry-merged`, `docs/post-merge-sync`. `chore/doc-consistency-checker` is deliberately kept — it holds the closed doc-checker script in case it is ever wanted as a manual pre-PR check.
- **Nothing is deployed.** The reporting app runs only via `npm run dev` (port 4127). The Terraform module is written and validated but has **never been applied** — there is no Hetzner account yet.
- **⚠️ PR #37's plugin fixes are merged but NOT live.** Plugins are physical copies inside each profile, so merging deploys nothing. 4 of 5 have drifted and the running operator gateway is still executing pre-fix code. See TODO item 0 — it is the first thing to do.

### Live systems, verified 2026-07-27

| | State |
|---|---|
| `default` Hermes gateway | running, PID 1976 (unrelated personal profile) |
| `autoestate` gateway (operator) | running, PID 8340 — the live WhatsApp bot |
| `autoestate-buyer` gateway | **stopped deliberately** after testing |
| WhatsApp bridge, port 3000 | running, PID 2996 — **never kill this** |
| Reporting app, 127.0.0.1:4127 | running (API returns 401 = healthy) |
| Repo↔live plugin parity (5 plugins) | **4 of 5 DRIFTED** — PR #37's fixes are not deployed, see TODO item 0 |
| Repo↔live buyer config parity | no drift (as parsed YAML) |

The buyer bot (`@autoestate_buyerdev_bot`) accepts messages from anyone by design, which is why it was stopped rather than left idling. **Its Telegram token was then revoked by the owner on 2026-07-27**, so `hermes -p autoestate-buyer gateway run` will now fail to authenticate — the profile, its lockdown and both plugins are intact and version-controlled, but the credential is gone deliberately. A fresh BotFather token is needed before any further buyer testing (TODO item 10).

### What to do next

**First, and it takes five minutes:** deploy PR #37's plugin fixes to the live profiles (**TODO item 0**). They are merged but not running — copy four `__init__.py` files into each profile's `plugins/` dir and restart both gateways, **from a normal interactive shell, not an agent session**. Until then the live operator bot runs code with a known crash path and no sync retry.

**Then the two account-level steps, which are the real gate and both need the owner** — I cannot create accounts:

1. **Create a Hetzner account, then `terraform apply`** (TODO item 3). Verify boot, cloud-init and secret injection end to end. Note two things are new and have never run: the operator SSH key must be uploaded to the project once beforehand, and skills/plugins now arrive via a post-boot SSH upload rather than cloud-init. Everything else about per-customer provisioning is written and waiting on this.
2. **Deploy the reporting app to Vercel Pro** (item 4) — set up the project, wire production Neon + Clerk env vars, verify authenticated multi-tenant access.

**Then, before any real customer touches it:**

3. **Harden the public buyer instance** (items 5–6). It currently runs with no OS-level isolation (`terminal.backend: local`) and shares the operator's ingestion secret, which also grants write access to `/api/ingest`. It needs container isolation and a scoped, read-limited second secret. Re-run `hermes security audit` once anything is publicly exposed — ~50 known CVEs are currently unreachable only because nothing is exposed.
4. **Re-confirm open-channel behaviour on WhatsApp.** Everything about strangers reaching a public bot was proven on **Telegram only**.
5. **Settle the buyer-channel transport** (open decision in TODO) — a second eSIM per customer, the official Cloud API, or staying non-WhatsApp. No code depends on it.

**Non-blocking:** create the Telegram notifier bot and set `OPERATOR_TELEGRAM_BOT_TOKEN` so operator lead alerts actually push. The dashboard records leads either way.

### Open questions for the owner

**None outstanding.** Both long-standing questions were answered on 2026-07-27:

- **Dev buyer bot token — REVOKED** by the owner. Right call; it was a public bot and testing was done. Consequence: the buyer instance can no longer start, so a fresh token (or a transport decision) gates any further buyer work — TODO item 10.
- **Anthropic auto-reload billing — NOT enabled**, confirmed. No longer "unverified": the recurring credit-exhaustion outage is a matter of when, not if, and it is an account-level fix only the owner can make — TODO item 9.

### Working conventions

- **Git:** `main` → feature branch → PR. Never commit to `main`. **Never merge without asking.**
- **No hooks exist in this repo** — `.claude/settings.json` was deleted 2026-07-26 at the owner's request, and PR #33 (a `Stop`-hook doc checker) was closed for the same reason. Keeping CLAUDE.md / TODO.md / this file current is a convention: record real changes as part of finishing a task and say which files were touched. Do not reintroduce automation.
- **Verify by running something.** CLAUDE.md section 5 ends with the exact recipes — resolving a profile's real tool list, its visible skills, slash-command policy, and repo↔live parity. Every one caught a real defect on 2026-07-26.

### Environment gotchas

- Use **`127.0.0.1`**, never `localhost` (IPv6 collision on this machine). A page-route **500 on 4127 is usually a transient Turbopack recompile** — re-check before restarting; check an API route (401 = healthy) to confirm the agent-facing path is fine.
- **Never edit a profile's `config.yaml` while its gateway is running.** The gateway rewrites the file, strips every comment, and silently clobbers concurrent edits. The commented copies under `agent/profiles/` are the source of truth — compare them as parsed YAML, not as text.
- Per-profile logs: `%LOCALAPPDATA%\hermes\profiles\<profile>\logs\gateway.log`. Not the shared path (which has misled a session), and not `session-run.log` (stdout is unflushed and it stays near-empty).
- Dev DB: one customer, four listings — 2 `ACTIVE` (Rothschild Boulevard, Neve Tzedek, seeded for testing) and 2 `SOLD` (Ben Gurion, Dizengoff).
- **Anthropic credits on this key have run dry repeatedly and caused live outages, and auto-reload is confirmed OFF (2026-07-27).** Expect it to happen again. If the live bot starts returning credit-balance errors, that is this, not a code fault — top up at console.anthropic.com.

### Later on 2026-07-26 — `/inspect` sweep, shipped as PR #37 (MERGED)

A full forensic read of all 88 in-scope tracked files on `main`. **41 findings; all fixed except the scoped ingestion secret**, which is a feature and is now a tracked deploy gate. Five commits (infra, plugins, reporting-app, comment corrections, doc sync), 40 files, +807/−257. Merged 2026-07-26 23:11 UTC at the owner's explicit instruction; branch deleted.

**What it caught that mattered:**

1. **The Terraform module had drifted to a 2026-07-22 snapshot** — 1 of 5 skills, 1 of 3 plugins. A customer provisioned from it would have tracked **zero** listings (no `listing-footer-reminder`). Skills/plugins now upload post-boot over SSH; they cannot go in cloud-init (Hetzner's 32KB `user_data` cap vs. ~63KB of skills). Also: `hermes_image_tag` was never referenced in the template so pinning did nothing, and the per-customer `hcloud_ssh_key` would have failed every apply after the first.
2. **Both context plugins could raise `KeyError` out of `pre_llm_call`** — public buyer instance, every turn, contradicting their own documented degrade-to-`None` contract.
3. **Every dashboard timestamp would render in UTC on Vercel**, 2-3h off for Tel Aviv.
4. A `Price: ₪3.2M` footer silently left the listing untracked (float into an `Int?` column, swallowed by the ingest `catch`).

**Two things changed by measurement, worth knowing:** the planned inquiry→listing fix would have produced **zero** links on real data (verified against the dev DB before shipping — the shipped version produces identical decisions to the old code), and `next build` caught a `"use server"` export error that **`tsc` and `eslint` both passed**.

**Not fixed, deliberately:** the scoped second ingestion secret (needs a schema column + per-route authorization — its own PR), and durable sync delivery across a gateway restart (needs an on-disk spool; a 3-attempt retry now covers the blip case).

**Three new deploy gates** are in TODO.md under "Deploy gates opened by the `/inspect` sweep" — the buyer profile's absolute Windows skills path and hardcoded operator Telegram id (both left at real values on purpose and marked `MACHINE-SPECIFIC`, so exclude them from the config parity check), plus the ingestion secret.

Verification: `terraform fmt`/`validate`; 27 Python checks running the real hook functions; `lint`/`tsc`/`build` clean; 24 checks running the real parsers and formatter against the real dev Neon database. **No browser verification** — the Clerk headless-cookie limitation still applies. **The Terraform module still has never been applied**, so its changes — the largest in the PR — are the least proven.

**One process note:** the owner explicitly asked for the merge in that turn, overriding the standing "never merge without asking" rule. That was a one-off instruction for #37, **not** a change of policy — keep asking.

### Reconciliation, 2026-07-27 (`/fastpassdocs`)

Run after #37 merged. Found four stale claims, all caused by the merge landing after the handoff was written, plus one real operational gap:

- **The plugin deployment gap** (now TODO item 0) — the only finding that isn't bookkeeping. Merging a plugin fix deploys nothing; 4 of 5 live copies are pre-fix.
- This file described `fix/inspect-sweep` as an open, unmerged branch in two places.
- The live-systems table asserted plugin parity that no longer held.
- The branch list omitted `docs/post-merge-sync`, and `reporting-app/README.md` still said "everything through PR #34".

Two new verification recipes were added to CLAUDE.md §5 as a result: resolving Terraform path/`fileset` arithmetic in `terraform console` (validate passes on a glob matching nothing, and `fileset` walks the filesystem rather than git), and re-running the plugin-parity check **after** any plugin PR merges.

### How to resume

> Read session-handoff-2026-07-26.md and continue. Everything is built and merged; no PR is open. **Start with TODO item 0** — PR #37's plugin fixes are merged but not deployed to the live profiles, which is a five-minute copy-and-restart (do the restart from a real shell, not an agent session). After that it's productionization, starting with whichever account-level step I want to authorize: Hetzner + `terraform apply`, or the Vercel deploy.
