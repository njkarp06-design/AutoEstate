# AutoEstate

A productized marketing-automation service. A Hermes agent runs one end-to-end marketing workflow for a client automatically, backed by secure configuration and a small reporting app so a non-technical client can see what the agent is doing.

See [CLAUDE.md](CLAUDE.md) for the full project brief, target industry, and build phases.

**Status:** Phase 2a and 2b complete. Listing-to-social skill built, tested, and hardened (v0.2.1) for sale/rental pricing and fact-only output. WhatsApp is live via a Baileys/QR bridge paired to a dedicated eSIM number on the WhatsApp Business app — a real listing sent from a personal WhatsApp number was confirmed to produce a correct bilingual Instagram/Facebook/Yad2 reply end-to-end. Phase 3 (security hardening) done for now — audited against Hermes's own trust model; AutoEstate runs on its own dedicated Hermes profile, separate from the operator's personal instance, with only the real-estate skill enabled. Containerized isolation and a supply-chain dependency audit are deliberately deferred to Phase 5. Now starting Phase 4 — reporting screens.

## Structure

- `agent/` — Hermes agent configuration and skills.
- `reporting-app/` — Next.js reporting app (Phase 4, not yet started).
