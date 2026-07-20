# agent/

Hermes agent configuration and skills for AutoEstate. Self-hosted (own API keys, not the Nous Portal) — see [CLAUDE.md](../CLAUDE.md) for why.

- Installed locally (Phase 1 complete): Hermes CLI, self-hosted with a direct Anthropic API key, provider pinned to `anthropic`. Config lives outside this repo at `%LOCALAPPDATA%\hermes` (`HERMES_HOME`), never committed.
- `skills/` (added in Phase 2) will hold the listing-to-social-pipeline skill.
- Real credentials go in a local `.env` (see `.env.example`), never committed.
