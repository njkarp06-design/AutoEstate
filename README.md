# AutoEstate

A productized marketing-automation service. A Hermes agent runs one end-to-end marketing workflow for a client automatically, backed by secure configuration and a small reporting app so a non-technical client can see what the agent is doing.

See [CLAUDE.md](CLAUDE.md) for the full project brief, target industry, and build phases.

**Status:** Phase 2a and 2b complete. Listing-to-social skill built, tested, and hardened (v0.2.1) for sale/rental pricing and fact-only output. WhatsApp is live via a Baileys/QR bridge paired to a dedicated eSIM number on the WhatsApp Business app — a real listing sent from a personal WhatsApp number was confirmed to produce a correct bilingual Instagram/Facebook/Yad2 reply end-to-end. Next: Phase 3 — security hardening.

## Structure

- `agent/` — Hermes agent configuration and skills.
- `reporting-app/` — Next.js reporting app (Phase 4, not yet started).
