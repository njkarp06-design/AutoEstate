## Session Handoff - 2026-07-21

### Task Overview

Building **AutoEstate**: a productized marketing-automation service for independent real estate agents in Tel Aviv. Core is a self-hosted **Hermes agent** (nousresearch/hermes-agent) running one marketing workflow end-to-end. Following a strict bottom-up phase plan defined in [CLAUDE.md](CLAUDE.md) (source of truth — read it first on resume). This session covered Phase 0 through the start of Phase 2b.

GitHub repo: https://github.com/njkarp06-design/AutoEstate (private). PR #1 (Phase 1) and PR #2 (Phase 2a) are both merged to `main`.

### Files Modified

**In the git repo** (`c:\dev\Portfolio\AI-Marketing`):
- `CLAUDE.md` — updated the top decisions note as project name/target industry/first workflow got decided; updated the phase-status line as each phase completed. Currently says "Phase 2a — complete."
- `README.md` — status line kept in sync with CLAUDE.md's phase tracker.
- `.gitignore` — created in Phase 0 (secrets, node_modules, `.hermes/`, OS files); later added `.claude/` (local Claude Code tooling state, e.g. scheduler lock files — not project content).
- `agent/README.md` — documents the agent folder; corrected once (see Errors Hit) to accurately say credentials never live in this repo.
- `agent/.env.example` — created in Phase 0 as a placeholder, **deleted** during a later tidy-up pass once we confirmed Hermes never reads a repo-local `.env` at all (it only reads `~/.hermes/.env`). This file was dead/misleading and is gone — don't recreate it.
- `agent/skills/real-estate/listing-to-social/SKILL.md` — **the actual Phase 2a deliverable.** A Hermes skill that takes raw listing facts (rooms, size, price, floor, features) and produces ready-to-post Hebrew + English content for Instagram, a Facebook group, and Yad2. Tested directly (not yet via WhatsApp): correctly produces all 3 platforms × 2 languages from complete input, and correctly asks one batched follow-up question instead of inventing missing facts. Explicitly does NOT auto-post or handle photos yet — text generation only.
- `reporting-app/README.md` — placeholder only, Phase 4, untouched since Phase 0.

**Outside the repo** (local machine state, NOT version-controlled — matters if this is ever reproduced on another machine, e.g. a client install in a later phase):
- `C:\Users\njkar\AppData\Local\hermes\config.yaml` — Hermes's own config (`HERMES_HOME`). Key settings: `model.provider: anthropic` (was `auto`, caused a bug — see Errors Hit), `model.default: anthropic/claude-opus-4.6`, and `skills.external_dirs: [C:/dev/Portfolio/AI-Marketing/agent/skills]` (this is *why* Hermes can see the project's skill at all — without this line, Hermes only looks in its own global `~/.hermes/skills/`).
- `C:\Users\njkar\AppData\Local\hermes\.env` — holds `ANTHROPIC_API_KEY` (user set this themselves, never seen by me/this session, by design — self-hosted, direct Anthropic API, not the Nous Portal).

### Decisions Made

- **Project name: AutoEstate.**
- **Target industry: independent real estate agents in Tel Aviv** (not franchises). Why: sharp recurring pain (constant listing content, no time to write it), WhatsApp/Facebook-group-native distribution fits the local market, ~450-570 agents in Tel Aviv is a big-enough market, and the user has warm local network access for a pilot.
- **Self-hosted Hermes, not Nous Portal.** Why: full control, no third-party auth dependency in the loop for what's meant to be a security-differentiated product.
- **Phase 2 first workflow: listing-to-social pipeline**, specifically split into two sub-phases:
  - **2a (done this session):** the skill itself — facts in, formatted bilingual captions out. No WhatsApp, no auto-posting. Deliberately built and tested this way first so we could validate content quality before taking on messaging-integration risk.
  - **2b (in progress):** wire up WhatsApp as the actual trigger.
- **WhatsApp integration: Baileys/QR bridge, not the official Business Cloud API — for now.** Baileys emulates a linked WhatsApp Web device (no Meta Business verification, no public server needed, works from a laptop). Tradeoff knowingly accepted: this violates WhatsApp's ToS for automated use and carries a real, unpredictable ban risk (researched: WhatsApp's own detection can flag an account anywhere from immediately to months in — no reliable pattern). Business Cloud API is the correct production path later (Phase 5 territory) once this is validated enough to matter — it requires a Meta Business account and a publicly-reachable server, neither of which we have yet.
- **Use a dedicated number for the WhatsApp bot, not the user's personal number** — specifically to contain the ban risk above. Decided approach: an **eSIM** with a new number, registered on the **WhatsApp Business app** (a separate app from regular WhatsApp, so it runs alongside the user's personal WhatsApp on the same phone with no conflict — confirmed this works fine technically since Baileys treats Business and regular WhatsApp identically).
- **Keep at least a minimal active plan on that eSIM rather than fully disabling it.** Why: the phone only needs *internet* (wifi is fine) every 14 days to keep WhatsApp's linked-device session alive, but if WhatsApp ever demands SMS/call re-verification (plausible specifically *because* this is automated bot activity), a fully dead SIM would cause an unrecoverable lockout. Cheap insurance against an uncertain but real failure mode.

### Errors Hit

1. **Hermes installer's setup wizard silently defaulted to "Nous Portal"** when run non-interactively (no one there to answer the prompt). Didn't actually complete OAuth (verified no real credentials were written), but wasted that step — had to configure the API key manually afterward instead.
2. **Playwright Chromium install failed** (`'playwright' is not recognized...`) because the installer's own suggested fix command runs from the wrong directory. Fixed by running `npx playwright install chromium` from `hermes-agent/node_modules/agent-browser/` instead of the repo root.
3. **PATH didn't refresh in already-open terminals** after install (matches the installer's own advice to restart the terminal) — worked around by using the full exe path (`.../hermes-agent/venv/Scripts/hermes.exe`) for the rest of the session.
4. **Real root cause of "it won't respond" bug:** `config.yaml` shipped with `model.provider: auto` *and* a stray `model.base_url: https://openrouter.ai/api/v1` (leftover template default). This combination caused Hermes to auto-detect and try routing through **AWS Bedrock** using the user's unrelated, invalid local AWS/Terraform credentials, instead of the intended direct Anthropic API. Fixed by editing `config.yaml` directly: set `model.provider: anthropic`, deleted the `base_url` line.
5. **`hermes config set provider anthropic` doesn't work** — warned "not a recognized config key" but saved it anyway as a stray unused top-level key. The real key is nested (`model.provider`). Found and deleted the dead top-level key during a later tidy-up pass.
6. **Anthropic billing confusion:** the $100 shown in Claude Code's own settings is a *Claude subscription* usage-credit pool, completely separate from the *Anthropic Console* API credit balance that a raw `ANTHROPIC_API_KEY` actually draws from. First test call failed with "credit balance too low" despite the $100 showing elsewhere. User bought Console credits directly (minimum enforced was $20, not the $5 some docs mention — unconfirmed why, possibly region/processor-specific) and confirmed working.
7. **Stale docs found during a tidy-up audit** (not a bug, but worth knowing the audit caught real issues, not just cosmetics): `agent/.env.example` was never actually read by anything and directly contradicted a correct line in `agent/README.md` about where credentials really live. Removed.

### Current State

- **Works, verified:** Hermes installed and responding via direct Anthropic API (Phase 1). The listing-to-social skill produces correct, good-quality bilingual output for all 3 target platforms when tested directly via `hermes -z`, and correctly asks rather than invents when facts are missing (Phase 2a).
- **Does not work yet / not started:** Nothing is connected to WhatsApp. No message has ever actually triggered the skill — every test so far has been me typing a prompt directly into the terminal, simulating what a real WhatsApp message would contain. The gateway process has never been run. No allowlist is configured.
- **Blocked on the user**, external to this session: getting the eSIM provisioned and WhatsApp Business registered on it. This was the last thing discussed before ending the session — user confirmed they're getting the eSIM but had not yet done it as of session end.
- Repo is clean: nothing uncommitted, no stale branches, `main` is up to date with both merged PRs.

### Next Step

Once the user confirms the eSIM is active and WhatsApp Business is registered on the new number, the single next action is: **run `hermes whatsapp` together to launch the pairing wizard, and have the user scan the displayed QR code from that WhatsApp Business account's Settings → Linked Devices → Link a Device.** (This requires the user to physically do the scanning — cannot be done from this session alone.)

After pairing succeeds, the remaining Phase 2b todo list (already tracked in-session, recreate if needed):
1. Set `WHATSAPP_ALLOWED_USERS` in `~/.hermes/.env` to the user's personal number (the allowed *sender* — separate from the bot's own paired number) so only they can trigger it during testing.
2. Start the gateway in the foreground (`hermes gateway`) for initial visibility/testing — not the persistent background service yet.
3. Send a real WhatsApp message with sample listing facts from the user's personal number to the new bot number, confirm the skill fires and replies correctly end-to-end.
4. Once confirmed, commit/document Phase 2b on a new branch (`feat/phase-2b-whatsapp-trigger` or similar, per the user's git workflow in CLAUDE.md Section 3), open a PR.

### How to Resume

Paste this at the start of a new session:

> Read session-handoff-2026-07-21.md and continue from where we left off

