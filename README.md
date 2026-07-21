# AutoEstate

A productized marketing-automation service. A Hermes agent runs one end-to-end marketing workflow for a client automatically, backed by secure configuration and a small reporting app so a non-technical client can see what the agent is doing.

See [CLAUDE.md](CLAUDE.md) for the full project brief, target industry, and build phases.

**Status:** Phase 2a complete (listing-to-social skill built, tested, and hardened for sale/rental pricing). Phase 2b in progress — WhatsApp trigger via a Baileys/QR bridge, approach decided, currently blocked on eSIM provisioning for the dedicated bot number.

## Structure

- `agent/` — Hermes agent configuration and skills.
- `reporting-app/` — Next.js reporting app (Phase 4, not yet started).
