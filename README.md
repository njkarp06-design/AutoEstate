# AutoEstate

Marketing automation for independent real estate agents in Tel Aviv.

An agent messages their bot — WhatsApp or Telegram — with listing facts and gets
back ready-to-post, bilingual (Hebrew + English) content for Instagram, Facebook
and Yad2, written only from the facts they actually gave, never invented.
Prospective buyers message a separate public bot and get honest answers about a
property 24/7, captured as leads. Both sides show up in a web dashboard the
agent logs into.

Built on [Hermes](https://github.com/NousResearch/hermes), an open-source CLI
agent. Every customer gets their own dedicated instances — one agent-facing,
one public-facing — with nothing shared between customers except the dashboard.

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
questions about a property from real listing data — including stated amenities
like parking or a lift — is honest when something is already sold, and defers
anything human (a viewing, an offer, a fact it wasn't given) to the agent.
Every conversation is captured as a lead with the buyer's contact details, and
a deferral pushes a real-time Telegram alert to the agent with that contact
attached — a hot lead never waits for someone to check a dashboard. The bot
runs on WhatsApp and Telegram together, because buyers reply on whichever
platform the ad reached them on.

Every listing carries a short reference code, and the dashboard gives the agent
a ready-to-paste link for their Yad2 or Instagram ad. A buyer who taps it opens
a message with that code already filled in, so the assistant knows exactly which
property they mean from the very first message — no "which one did you mean?",
and the lead is attached to the right listing automatically.

**The dashboard.** A Next.js app where the agent reviews generated content per
platform, edits it, marks it posted, sees their live listings with their ad
links, and works through buyer leads. Multi-tenant — one deployment serves
every customer, each seeing only their own data — with Clerk auth and Postgres
behind Prisma.

## Current state

**As of 2026-08-06: all planned features are built, live-tested against real
WhatsApp and Telegram traffic, and merged.**

**Not yet deployed.** Everything runs locally today: the reporting app via
`npm run dev`, the agent instances on a development machine. The Terraform
module for per-customer infrastructure is written and validated but has never
been applied, and the reporting app has never been deployed. Those two
account-level steps, plus the buyer instance's remaining production hardening
(OS-level container isolation, and re-running the dependency audit once
anything is publicly exposed), are what stand between here and a pilot
customer.

See [CLAUDE.md](CLAUDE.md) for the full brief, architecture decisions and
engineering history, and [TODO.md](TODO.md) for what is outstanding.

## Security posture

The buyer-facing instance answers strangers by design, which makes it the one
surface untrusted people can reach. It is locked down by construction rather
than by prompt:

- **Role-by-channel isolation.** It loads **only** the buyer skill. The
  outbound skills that can modify listing data are not present on it at all —
  necessary, because the Hermes sender allowlist is enforced upstream of every
  skill and sender identity never reaches one, so a skill cannot tell an
  operator from a stranger. This is also why each customer has two instances:
  the two roles cannot safely share a channel.
- Its agent is configured down to **three tools**: listing its skills, reading
  one, and a skill-*write* tool that cannot be dropped (the toolset is
  all-or-nothing and Hermes has no per-tool denylist) and is instead neutered —
  every write stages for an approval nobody grants. No shell, file access, code
  execution, browser, web, vision, or memory.
- Slash commands are restricted to non-privileged ones.
- It holds **its own machine credential**, not the operator's. The reporting API
  scopes each credential to its own routes, so the buyer instance can read listing
  data and record inquiries but cannot write to the ingestion endpoint — extracting
  its secret does not grant the ability to alter a customer's listings.
- **Outbound file delivery is restricted to a small allowlist of directories.**
  The agent can attach a file by naming a path in its own reply text — a channel
  no tool restriction covers, since it is not a tool. Left at the default it
  would deliver almost any file on the host, so it is pinned to the instance's
  own media cache.

Secrets never live in this repo. Per-customer credentials are generated at
provisioning time and stored only as hashes.

## Structure

- `agent/skills/` — the five outbound skills, loaded by operator instances.
- `agent/skills-buyer/` — the single inbound skill, loaded by buyer instances.
  Separate roots so the two can never be loaded together.
- `agent/plugins/` — Hermes plugins: two sync each instance's activity to the
  dashboard, two inject the customer's real listing data into a turn, and one
  pins the exact output format that listing tracking depends on — injected
  every turn, because a long-lived chat session can't be trusted to reload an
  edited skill file.
- `agent/profiles/` — the buyer instance's committed, commented configuration —
  the documented source of truth, since the live copy is machine-managed and
  strips comments.
- `infra/` — Terraform module provisioning one Hetzner server per role:
  `instance_role` selects operator or buyer, so a fully-provisioned customer is
  two stacks with two credentials.
- `reporting-app/` — the Next.js dashboard, multi-tenant and Postgres-backed.
