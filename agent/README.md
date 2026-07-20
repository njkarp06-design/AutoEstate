# agent/

Hermes agent configuration and skills for AutoEstate. Self-hosted (own API keys, not the Nous Portal) — see [CLAUDE.md](../CLAUDE.md) for why.

- Installed locally (Phase 1 complete): Hermes CLI, self-hosted with a direct Anthropic API key, provider pinned to `anthropic`. Config lives outside this repo at `%LOCALAPPDATA%\hermes` (`HERMES_HOME`), never committed.
- `skills/real-estate/listing-to-social/` — the listing-to-social pipeline skill (Phase 2a, built and tested). Hermes finds it via `skills.external_dirs` in this machine's local `config.yaml` (outside the repo, machine-specific — set that up again on any new machine/client install).
- Real credentials go in a local `.env` (see `.env.example`), never committed.
