## Session Handoff - 2026-07-22

### Task Overview
Building **AutoEstate**, a productized marketing-automation service for independent real estate agents in Tel Aviv, built on a self-hosted Hermes AI agent. Following the strict CLAUDE.md bottom-up phase plan (Phase 0-5).

This session's goal was a major pivot from the Phase 4 single-tenant reporting dashboard into a **multi-tenant SaaS product**: the operator (user) installs a dedicated Hermes instance on each new customer's own cloud infrastructure (one instance per independent real estate agent), all instances sync into one shared reporting webapp where each customer logs in and sees only their own activity. This was explicitly planned properly (Plan Mode + a design subagent) before any code was written, then built in three sequential, independently-testable phases: **Phase A** (data layer + Clerk auth), **Phase B** (the real Hermes → webapp sync mechanism), **Phase C** (Terraform to provision fresh customer instances on Hetzner).

**All three phases are now complete, verified, and merged to `main`.**

### Files Modified

**Phase A — data layer, ingestion API, Clerk auth (PR #10, merged):**
- `reporting-app/prisma/schema.prisma` — new models: `Customer` (email unique, clerkUserId unique nullable, displayName, ingestionSecretHash unique), `Run` (customerId, hermesSessionId, hermesTurnId, source, displayName, startedAt, title, status enum, estimatedCostUsd, `@@unique([customerId, hermesTurnId])`), `RunMessage` (runId, role, content, timestamp, sortIndex). Generator uses `provider = "prisma-client"` with `output = "./generated/prisma"`. No `url`/`directUrl` in datasource (Prisma 7 requirement).
- `reporting-app/prisma.config.ts` — new Prisma 7 requirement; connection config moved out of schema.prisma into here, with explicit `dotenv.config({ path: ".env.local" })`.
- `reporting-app/lib/prisma.ts` — Prisma client singleton using `@prisma/adapter-pg` driver adapter.
- `reporting-app/lib/customer.ts` — resolves a Clerk session to a `Customer` row via email-claim on first login (operator pre-provisions `Customer.email` before the customer ever logs in).
- `reporting-app/lib/db.ts` — rewritten against Prisma, async, scoped to the logged-in customer; `getRuns()` includes a 3-minute staleness filter to hide orphaned "in progress" ghost entries from interrupted turns.
- `reporting-app/app/api/ingest/route.ts` — bearer-secret-hash-authenticated ingestion endpoint; zod-discriminated-union schema for `turn_started`/`turn_completed` events (both require `turnId`); upserts `Run` by `customerId_hermesTurnId`.
- `reporting-app/proxy.ts` — Clerk-generated middleware, manually fixed to exclude `/api/ingest` from `auth.protect()` (external Hermes instances call it with their own bearer secret, not a Clerk session) and to add the `/__clerk/:path*` matcher.
- `reporting-app/app/layout.tsx` — wrapped in `ClerkProvider`, added `SignInButton`/`SignUpButton`/`UserButton` to the header.

**Phase B — Hermes sync plugin (PR #11, merged):**
- `agent/plugins/sync-to-webapp/plugin.yaml` and `__init__.py` (new) — plugin hook handlers (`pre_llm_call` → `on_turn_started`, `post_llm_call` → `on_turn_completed`), **must be synchronous functions** (Hermes's plugin dispatcher does `ret = cb(**kwargs)` with no `await` — `async def` handlers silently never execute). The actual HTTP POST to the ingestion API runs on a background thread so it never blocks the agent turn.

**Phase C — Terraform module (PR #12, merged, this continued session):**
- `infra/modules/hermes-instance/` (new) — `versions.tf`, `variables.tf`, `main.tf` (server, firewall, SSH key, and a `null_resource.inject_secret` doing SSH `remote-exec` to write the ingestion secret post-boot), `outputs.tf`, `cloud-init.yaml.tftpl` (Docker install, `nousresearch/hermes-agent` container, writes SKILL.md/plugin files via `templatefile()` reading real repo paths, `docker-compose.yml` with no published ports), `README.md` (full onboarding runbook).
- `infra/customers/example/main.tf` and `terraform.tfvars.example` (new) — template customer directory; real secrets go in a gitignored `terraform.tfvars`.
- `infra/.gitignore` (new) — excludes `.terraform/`, `*.tfstate*`, real `*.tfvars`; does **not** exclude `.terraform.lock.hcl` (that should be committed, like any lockfile — caught and fixed a mistaken initial exclusion before committing).
- `reporting-app/scripts/provision-customer.ts` (new) — reads the Terraform-generated ingestion secret from stdin, hashes it, upserts a `Customer` row by email.

**Memory files updated (this continued session, after PR #12 merged):**
- `C:\Users\njkar\.claude\projects\c--dev-Portfolio-AI-Marketing\memory\project_multi_tenant_saas.md` — added the full Phase C section (design points, status: written/validated/never applied).
- `C:\Users\njkar\.claude\projects\c--dev-Portfolio-AI-Marketing\memory\MEMORY.md` — updated the index line to reflect all of Phases A+B+C complete.

### Decisions Made

- **Compute: Hetzner Cloud**, not AWS. Real cost comparison: ~$5/customer/month on Hetzner vs. ~$19/customer/month on AWS for equivalent specs (AWS has no meaningful free tier past year one, plus IPv4 charges) — a 4x gap that compounds per customer per month indefinitely.
- **Database: Neon** (serverless Postgres), not Supabase. Don't need Supabase's bundled auth (using Clerk), and Neon avoids Supabase's free-tier "pauses after a week idle" behavior — a real risk for a sporadically-hit ingestion endpoint.
- **Auth: Clerk**, not self-hosted Auth.js/NextAuth. Speed — hosted auth handles login UI/sessions/security; free tier covers an early handful of customers.
- **Reporting webapp hosting: Vercel Pro** (~$20/month), not self-hosted on Hetzner. Vercel's free Hobby tier is non-commercial-use only. Self-hosting saves $20/month but costs real ongoing ops work not worth it at this stage. **Not yet deployed.**
- **No Kafka/message queue.** Direct HTTP POST from each customer's Hermes plugin straight to the ingestion API, which writes to Postgres. A queue solves problems (high-throughput, multiple consumers) that don't exist at "a handful of customers" scale.
- **No separate BFF service.** The Next.js app's own API routes + Server Components play that role.
- **Clerk Organizations: explicitly not used.** Organizations model "one account, multiple team members" — the target customer is a solo independent agent, not a multi-staff agency. Plain Clerk Users + a custom `Customer` table fits the real market. Revisit only if a multi-staff agency becomes a real customer.
- **Sync mechanism: Plugin Hooks, not Gateway Hooks** — reversed from the original plan after live testing found Gateway Hooks (`agent:end`) truncate responses to 500 chars in `gateway/run.py`, silently cutting real content (routinely 1000+ chars). Plugin Hooks' `post_llm_call` carries the full response.
- **Run-grouping key: `hermesTurnId`, not `hermesSessionId`** — Hermes never resets sessions between messages on a messaging platform, so session-based grouping merged unrelated listings into one dashboard entry. Turn ID is unique per exchange.
- **"In progress" status via a second lightweight "turn started" sync event**, shown as an indeterminate pulsing-dot indicator rather than a fake percentage progress bar — no real signal exists for granular progress, and a fake one would violate the project's own "never overstate beyond what's true" principle.
- **Ingestion secret rotation without server rebuild** — the secret is injected via a separate `null_resource` SSH step, not baked into `user_data`, because changing `user_data` on an existing `hcloud_server` forces Terraform to recreate the whole instance (losing the paired WhatsApp session).
- **WhatsApp pairing stays a manual, undocumented-as-automatable step** — `hermes whatsapp` refuses to run through any piped/non-interactive process (confirmed directly), so the QR scan can't be scripted into cloud-init.
- **Phase C stops at `terraform validate`/`plan`, not `apply`** — no real Hetzner account exists yet; writing/validating Terraform costs nothing, only `apply` against a real account would incur charges. User explicitly asked "do I need to pay for this part?" before proceeding and wanted to stay at zero cost until ready.
- **Git workflow discipline reconfirmed:** always create the PR and then **stop and wait for explicit separate confirmation** before merging — never chain `gh pr merge` after `gh pr create`. (This was already saved as a standing feedback memory from earlier in this project; reconfirmed by explicit "merge" messages given separately from "yes please" for PR creation in this session.)

### Errors Hit

- **Prisma 7 forbids `url`/`directUrl` in `schema.prisma` entirely** — moved to `prisma.config.ts` with a driver adapter (`@prisma/adapter-pg`). Discovered via live error messages, not docs.
- **`dotenv/config` only loads `.env`, not `.env.local`** — fixed with explicit `dotenv.config({ path: ".env.local" })` everywhere needed.
- **Generated Prisma client ships as `.ts`, not `.js`** — needed `tsx` to run standalone scripts.
- **`127.0.0.1` + Clerk dev cookie handshake caused an infinite redirect loop** — root-caused via Playwright network tracing (`__clerk_hs_reason=dev-browser-missing` repeating); fixed by using real `localhost` on a genuinely free port (4127 — ports 3000/3001 were permanently squatted by unrelated background services on this machine, IPv6-loopback-only).
- **Clerk's generated `proxy.ts` didn't exclude `/api/ingest`** from `auth.protect()` — would have broken external Hermes instances calling the endpoint; fixed manually.
- **Headless Playwright couldn't complete Clerk sign-up** (bot-protection, "No available adapters") — worked around by having the user complete sign-up manually in their own browser.
- **Gateway Hook `agent:end` truncates responses to 500 chars** (`gateway/run.py`, undocumented) — root-caused after a real WhatsApp test produced visibly truncated content; fixed by switching to Plugin Hooks.
- **Plugin Hook `async def` handlers never execute** (`RuntimeWarning: coroutine never awaited`) — root-caused via stderr log + source read of `hermes_cli/plugins.py` (`ret = cb(**kwargs)`, no `await`); fixed by making handlers synchronous with the HTTP call on a background thread.
- **Grouping by `hermesSessionId` merged unrelated listings into one dashboard entry** — fixed by switching to `hermesTurnId`; required a manual SQL migration since `prisma migrate dev` refused non-interactive execution.
- **Orphaned "In progress" ghost entries** from Hermes's known `busy_input_mode: interrupt` quirk — not a new bug; fixed with a self-correcting 3-minute staleness filter in `getRuns()`.
- **Hebrew text corrupted to `?????`** when passed as an inline Windows shell argument to `curl` — confirmed as a testing-methodology artifact, not a pipeline bug, by re-testing with `curl --data-binary @file.json` (preserved Hebrew perfectly).
- **Accidentally excluded `.terraform.lock.hcl` in `infra/.gitignore`** — self-caught after `terraform init`'s standard "include this file in version control" notice; corrected before committing.
- **Commit message backticks caused a bash syntax error** (parens inside a backticked snippet triggered command substitution) — commit still landed with a minor cosmetic gap; not amended since already pushed (per user's own convention against amending pushed commits).

### Current State

- **Git:** `main` branch, clean working tree, fully up to date with `origin/main`. No open PRs. Latest commits: `530b64b` (merge PR #12), `78ed1f4` (Phase C), `9245119` (merge PR #11), `78c89e1` (Phase B), `45fe228` (merge PR #10, Phase A).
- **What works, verified end-to-end with real data:** Phase A (real Clerk sign-up/login, real Postgres writes including Hebrew, dashboard scoped correctly to logged-in account) and Phase B (real paired WhatsApp instance, multiple real listings, full untruncated bilingual content, correct turn-based grouping, staleness filter working) are both live-tested and confirmed correct.
- **What's written but not yet live:** Phase C's Terraform module passed `terraform init`/`validate`/`fmt` cleanly but has **never been applied** — no real Hetzner server exists, no cost has been incurred.
- **Not yet done:** the reporting webapp has never been deployed anywhere public (Vercel Pro decided, not executed) — this matters because Phase C's `cloud-init.yaml.tftpl` needs a real `ingestion_api_url` to point customer instances at, which doesn't exist until the webapp is deployed.

### Next Step

Deploy the reporting webapp to Vercel Pro (the decided-but-unexecuted piece), since Phase C's `terraform apply` for a real customer needs a live `ingestion_api_url` to point at. This is the natural next concrete step toward actually onboarding a real customer; the alternative order (apply Terraform first) would produce a customer instance with nowhere real to send data.

### How to Resume

Paste this prompt at the start of the new session:

> Read session-handoff-2026-07-22.md and continue from where we left off. Next up: deploy the reporting webapp (reporting-app/) to Vercel Pro so Phase C's Terraform module has a real ingestion_api_url to provision customer instances against. Flag the Vercel Pro sign-up/billing step to me before doing anything account-level or paid, per my usual "confirm before anything billable" preference.
