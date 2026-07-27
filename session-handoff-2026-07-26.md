## Session Handoff — 2026-07-26

### What this project is

**AutoEstate** — marketing automation for independent real estate agents in Tel Aviv. An agent messages a WhatsApp bot with listing facts and gets back bilingual (Hebrew + English) content for Instagram, Facebook and Yad2. Prospective buyers message a *separate, public* bot and get honest answers about a property 24/7, captured as leads. Both show up in a Next.js dashboard the agent logs into. Built on Hermes, one dedicated instance per customer.

Read [CLAUDE.md](CLAUDE.md) for the brief, architecture and engineering history; [TODO.md](TODO.md) for what's outstanding. Repo: https://github.com/njkarp06-design/AutoEstate (private).

### Where things stand

- **All planned features are built, live-tested and merged.** The last, buyer-inquiry, shipped in **PR #34** on 2026-07-26.
- **Nothing is blocked on more building.** Everything remaining is productionization.
- **On `main`, clean, nothing in flight.** Every PR opened to date is merged and **no PR is open** — deliberately not enumerated here, since a PR range goes stale the moment the next one merges (including the one that updates this line). Check with `gh pr list`. All merged branches have been deleted locally and on origin. Exactly two branches remain: `main`, and `chore/doc-consistency-checker` — deliberately kept and **intentionally unmerged**, holding the only copy of the closed PR #33 doc-checker script (`.claude/doc-consistency-check.sh`). Do not delete it as "stale"; it has 1 unique commit that exists nowhere else.
- **Nothing is deployed.** The reporting app runs only via `npm run dev` (port 4127). The Terraform module is written and validated but has **never been applied** — there is no Hetzner account yet.
- **PR #37's plugin fixes are deployed and live** (2026-07-27). Merging did not do this — plugins are physical copies inside each profile — so they were copied across and the operator gateway restarted. Parity is 5/5 and the running process demonstrably loaded the new code. Nothing is half-deployed.

### Live systems, verified 2026-07-27

| | State |
|---|---|
| `default` Hermes gateway | running, PID 1976 (unrelated personal profile) |
| `autoestate` gateway (operator) | running, PID 6072 — the live WhatsApp bot, restarted 2026-07-27 02:42 onto PR #37's plugin fixes |
| `autoestate-buyer` gateway | **stopped deliberately** after testing |
| WhatsApp bridge, port 3000 | running, PID 2996 — **never kill this** |
| Reporting app, 127.0.0.1:4127 | running (API returns 401 = healthy) |
| Repo↔live plugin parity (5 plugins) | all 5 match (re-verified after deploying #37's fixes) |
| Repo↔live buyer config parity | no drift (as parsed YAML) |

The buyer bot (`@autoestate_buyerdev_bot`) accepts messages from anyone by design, which is why it was stopped rather than left idling. **Its Telegram token was then revoked by the owner on 2026-07-27**, so `hermes -p autoestate-buyer gateway run` will now fail to authenticate — the profile, its lockdown and both plugins are intact and version-controlled, but the credential is gone deliberately. A fresh BotFather token is needed before any further buyer testing (TODO item 10).

### What to do next

**Everything that can be done without an account is done.** The two account-level steps are the real gate and both need the owner — I cannot create accounts:

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

- **The plugin deployment gap** — the only finding that wasn't bookkeeping. Merging a plugin fix deploys nothing; 4 of 5 live copies were pre-fix. **Closed the same day**: files copied across, operator gateway restarted by the owner, parity re-verified 5/5. The standing rule it produced is in TODO's Done section — a plugin PR is not finished when it merges.
- This file described `fix/inspect-sweep` as an open, unmerged branch in two places.
- The live-systems table asserted plugin parity that no longer held.
- The branch list omitted `docs/post-merge-sync`, and `reporting-app/README.md` still said "everything through PR #34".

Two new verification recipes were added to CLAUDE.md §5 as a result: resolving Terraform path/`fileset` arithmetic in `terraform console` (validate passes on a glob matching nothing, and `fileset` walks the filesystem rather than git), and re-running the plugin-parity check **after** any plugin PR merges.

**Session-boundary fixes (#40, #41).** Resuming had been depending on the owner pasting a prompt by hand: CLAUDE.md is the only auto-loaded file, and it mentioned the handoff just once, at line 30, inside a rule about *maintaining* it — never telling a new session to read it. #40 added a **START HERE** block at the top, so "resume" is now sufficient. #41 added a five-check **BEFORE YOU SAY "DONE"** block beside it, each check traced to a real failure from this session rather than an imagined risk. Deliberately a checklist, not a hook — the hook mechanism was rejected in PR #33 and the block says so, so a future session doesn't helpfully reintroduce one. It caught two stale claims in this very file on its first run.

### Second `/inspect` sweep — 2026-07-27, on branch `fix/inspect-sweep-2026-07-27`

Run one day after the first. All **91** in-scope tracked files on `main` re-read, plus the 4 files genuinely changed by `chore/doc-consistency-checker` — that branch was pulled back into scope at the owner's instruction ("if it's around it should be correct") after being set aside as a rejected experiment. **27 findings (2 critical, 9 major, 10 minor, 6 nitpick), all fixed.**

**Status: committed on the branch, NOT pushed and NOT merged.** Both branches await your push confirmation.

What it caught that mattered:

1. **`provision-customer.ts` could never have worked when invoked as documented.** `dotenv` resolved `.env.local` against `cwd`, and the infra README tells you to run it from `infra/customers/<slug>/`. Verified by running it. This is step 3 of the Hetzner onboarding you're about to do for the first time.
2. **A Terraform `null_resource` does not re-run because its `depends_on` target did.** Editing a `SKILL.md` re-uploaded it to a gateway that was never restarted — "merging deploys nothing", reproduced in infrastructure.
3. **`_extract_phone` had been half-fixed.** The newline splice was closed; the identical single-line one wasn't, so `"4 95 3 3950000"` (rooms/sqm/floor/price) would have been stored as a buyer's phone number.
4. **The buyer profile's tool and slash-command lockdowns are Telegram-only** — and slash gating switches on only when an admin list exists, so moving the buyer channel to WhatsApp without adding the matching block puts every stranger back at admin tier including `/profile`. That is the leading transport option, so it's now a deploy gate rather than a footnote.

**⚠ Four plugins are ahead of their live copies** (`sync-to-webapp`, `sync-inquiries-to-webapp`, `active-listings-context`, `buyer-listings-context`; `listing-footer-reminder` unchanged and still matching). Parity was re-run and confirms it. **Redeploy and restart the operator gateway from your own PowerShell** — doing it from an agent session has caused a full outage before.

Verification: `lint`/`tsc`/`build` clean · `terraform fmt`/`validate` clean and the filtered `fileset` resolved in `terraform console` · all 5 plugins import and register · `_extract_phone` re-run against every real buyer message in the live `state.db` (identical decisions, the one real contact preserved) · the new disposition query dry-run against the real dev Neon DB (0 mismatches) · M6/M5 exercised through the **real** `/api/ingest` and `/api/inquiries` with a throwaway customer, **cleanup proven by query, not asserted**. Dev DB confirmed back to 1 customer / 2 ACTIVE + 2 SOLD / 2 inquiries. No browser verification — the Clerk headless-cookie limitation still applies.

`chore/doc-consistency-checker` now genuinely is what the docs say it is: `settings.json` (which restored **both** hooks, including the rejected `UserPromptSubmit` injector) deleted, stale doc hunks reverted, and the script given a real `--force` on-demand mode plus a lock. It stays 45 commits behind by design — **cherry-pick the script, never merge the branch.**

### How to resume

> Read session-handoff-2026-07-26.md and continue. Everything is built and merged. **One thing is genuinely in flight:** the second `/inspect` sweep (2026-07-27) is committed on `fix/inspect-sweep-2026-07-27` and on `chore/doc-consistency-checker`, **neither pushed nor merged** — check `git log origin/main..` before assuming otherwise, and open the PR if I haven't. Two follow-ups from it are mine to do: four plugins are ahead of their live copies and need redeploying with a gateway restart from my own PowerShell, and the buyer-channel transport decision now carries a security gate (its lockdowns are Telegram-only). Beyond that, what's left is productionization, starting with whichever account-level step I authorize — Hetzner + `terraform apply` (TODO item 3) or the Vercel deploy (item 4). Don't start either without me: both cost money and neither account exists yet. If I haven't picked one, the most useful unprompted work is the scoped second ingestion secret (deploy gates), which blocks public exposure.
