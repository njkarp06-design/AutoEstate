# AutoEstate

Marketing automation for independent real estate agents in Tel Aviv.

An agent sends listing facts to a WhatsApp number and gets back ready-to-post,
bilingual (Hebrew + English) content for Instagram, Facebook and Yad2 — written
only from the facts they actually gave, never invented. Prospective buyers
message a separate public number and get honest answers about a property 24/7,
captured as leads. Both sides show up in a web dashboard the agent logs into.

Built on [Hermes](https://github.com/NousResearch/hermes), an open-source CLI
agent, with one dedicated instance per customer.

## What it does

**Outbound — for the agent.** Message the bot in plain language and it drafts:

- a new listing announcement, in the three-platform format
- a price drop or under-contract update
- a "just sold" social-proof post
- a re-promotion of a listing that's still available
- a weekly digest of everything currently active

It remembers the agent's listings, so a follow-up can name one ("the Dizengoff
place") instead of restating every fact. Posting stays manual — the agent
reviews and publishes.

**Inbound — for buyers.** A separate, locked-down instance answers strangers'
questions about a property from real listing data, is honest when something is
already sold, defers anything human (a viewing, an offer, a fact it wasn't
given) to the agent, and captures the buyer's contact details as a lead.

**The dashboard.** A Next.js app where the agent reviews generated content
per platform, edits it, marks it posted, sees their live listings, and works
through buyer leads.

## Current state

**All planned features are built, live-tested against real WhatsApp and
Telegram traffic, and merged.** The last of them, the buyer-inquiry
receptionist, shipped in PR #34 on 2026-07-26.

**Not yet deployed.** Everything runs locally today: the reporting app via
`npm run dev`, the agent instances on a development machine. The Terraform
module for per-customer infrastructure is written and validated but has never
been applied, and the reporting app has never been deployed. Those two steps,
plus hardening the public buyer instance, are what stand between here and a
pilot customer.

See [CLAUDE.md](CLAUDE.md) for the full brief, architecture decisions and
engineering history, and [TODO.md](TODO.md) for what is outstanding.

## Security posture

The buyer-facing instance is the only surface untrusted people can reach, and
it is locked down by construction rather than by prompt:

- It loads **only** the buyer skill. The outbound skills that can modify listing
  data are not present on it at all — necessary, because the Hermes sender
  allowlist is enforced upstream of every skill and sender identity never
  reaches one, so a skill cannot tell an operator from a stranger.
- Its agent is configured down to **three tools**: listing skills, reading a
  skill, and a skill-*write* tool that cannot be dropped (the toolset is
  all-or-nothing and Hermes has no per-tool denylist) and is instead neutered —
  every write stages for an approval nobody grants. No shell, file access, code
  execution, browser, web, vision, or memory.
- Slash commands are restricted to non-privileged ones.
- It holds **its own machine credential**, not the operator's. The reporting API
  scopes each credential to its own routes, so the buyer instance can read listing
  data and record inquiries but cannot write to the ingestion endpoint — extracting
  its secret does not grant the ability to alter a customer's listings.

Secrets never live in this repo. Per-customer credentials are generated at
provisioning time and stored only as hashes.

## Structure

- `agent/skills/` — the five outbound skills, loaded by an operator instance.
- `agent/skills-buyer/` — the single inbound skill, loaded by a buyer instance.
  Separate roots so the two can never be loaded together.
- `agent/plugins/` — Hermes plugins that sync activity to the dashboard and
  inject the customer's real listing data into a turn.
- `agent/profiles/` — committed, commented configuration for an agent instance.
- `infra/` — Terraform module provisioning one Hetzner instance per customer.
- `reporting-app/` — the Next.js dashboard, multi-tenant and Postgres-backed.
