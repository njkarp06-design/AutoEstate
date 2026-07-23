# AutoEstate

A productized marketing-automation service. A Hermes agent runs one end-to-end marketing workflow for a client automatically, backed by secure configuration and a small reporting app so a non-technical client can see what the agent is doing.

See [CLAUDE.md](CLAUDE.md) for the full project brief, target industry, and build phases.

**Status:** Phase 2a and 2b complete. Listing-to-social skill built, tested, and hardened (v0.2.1) for sale/rental pricing and fact-only output. WhatsApp is live via a Baileys/QR bridge paired to a dedicated eSIM number on the WhatsApp Business app — a real listing sent from a personal WhatsApp number was confirmed to produce a correct bilingual Instagram/Facebook/Yad2 reply end-to-end. Phase 3 (security hardening) done for now — audited against Hermes's own trust model; AutoEstate runs on its own dedicated Hermes profile, separate from the operator's personal instance, with only the real-estate skill enabled. Containerized isolation and a supply-chain dependency audit are deliberately deferred to Phase 5. Reporting app has since moved to a multi-tenant design — a per-customer Hermes instance (provisioned via the Terraform module in `infra/`) pushes activity over HTTP to a shared Postgres-backed Next.js dashboard, with Clerk-authenticated per-customer login. A full `/inspect` pass (2026-07-22) fixed a critical secret-handling bug in the provisioning module plus several correctness issues in the reporting app's ingestion path.

Reporting app is now mid-redesign (PR #13, open against `main`, not yet merged): a per-platform review workflow (edit, copy, mark-posted, a stored Instagram auto-post preference) plus a distinct "Listing Ledger" visual identity — real Hebrew/English mirrored columns, not a generic template. Real bugs surfaced and fixed by testing against real synced data, not just code review — see [CLAUDE.md](CLAUDE.md) for detail. Neither `terraform apply` (no real Hetzner account yet) nor a Vercel Pro deployment (still local-only) has happened — the app only runs via `npm run dev` today. Next up: more reporting-app polish and/or Hermes work (a second skill, real photo handling) — see [CLAUDE.md](CLAUDE.md) for the exact state to pick up from.

## Structure

- `agent/` — Hermes agent configuration and skills.
- `infra/` — Terraform module for provisioning a per-customer Hermes instance (Hetzner), plus per-customer configs.
- `reporting-app/` — Next.js reporting app — multi-tenant, Postgres-backed dashboard of agent activity across customers.
