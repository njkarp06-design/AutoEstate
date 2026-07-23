# agent/

Hermes agent configuration and skills for AutoEstate. Self-hosted (own API keys, not the Nous Portal) — see [CLAUDE.md](../CLAUDE.md) for why.

- Installed locally (Phase 1 complete): Hermes CLI, self-hosted with a direct Anthropic API key, provider pinned to `anthropic`. Config lives outside this repo at `%LOCALAPPDATA%\hermes` (`HERMES_HOME`), never committed.
- `skills/real-estate/listing-to-social/` — the listing-to-social pipeline skill (Phase 2a, built and tested; hardened to v0.3.0 for sale/rental price phrasing, real photo handling (typed descriptions and real attached WhatsApp/Telegram images, treated the same way), a structured hashtag strategy, a guard against blending facts from two different properties into one response, and not upgrading stated facts into unstated condition/availability or neighborhood claims).
- `skills/real-estate/listing-status-update/` — announces a status change (price drop / sold / under contract) on a listing already advertised via `listing-to-social`, in the same three-platform Hebrew+English format (v0.1.0).
- Both skills live under `skills/real-estate/`, and Hermes finds them via `skills.external_dirs` in this machine's local `config.yaml` (outside the repo, machine-specific, points at the parent `skills/` folder so new skill directories are auto-discovered — set that up again on any new machine/client install).
- Real credentials never live in this repo at all — set them by editing `.env` directly at the path `hermes config env-path` prints (`%LOCALAPPDATA%\hermes\.env` on Windows), or via `hermes secrets` for an external secret manager (Bitwarden/1Password). `hermes config set` is for `config.yaml` settings only (e.g. `model`, `terminal.backend`) — it does not touch `.env`.
