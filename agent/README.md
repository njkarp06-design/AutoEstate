# agent/

Hermes agent configuration and skills for AutoEstate. Self-hosted (own API keys, not the Nous Portal) — see [CLAUDE.md](../CLAUDE.md) for why.

- Installed locally (Phase 1 complete): Hermes CLI, self-hosted with a direct Anthropic API key, provider pinned to `anthropic`. Config lives outside this repo at `%LOCALAPPDATA%\hermes` (`HERMES_HOME`), never committed.
- `skills/real-estate/listing-to-social/` — the listing-to-social pipeline skill (Phase 2a, built and tested; hardened to v0.2.0 for sale/rental price phrasing and photo-description handling). Hermes finds it via `skills.external_dirs` in this machine's local `config.yaml` (outside the repo, machine-specific — set that up again on any new machine/client install).
- Real credentials never live in this repo at all — set them by editing `.env` directly at the path `hermes config env-path` prints (`%LOCALAPPDATA%\hermes\.env` on Windows), or via `hermes secrets` for an external secret manager (Bitwarden/1Password). `hermes config set` is for `config.yaml` settings only (e.g. `model`, `terminal.backend`) — it does not touch `.env`.
