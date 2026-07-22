# CLAUDE.md — Project Brief

> **Decided — project name:** AutoEstate.
>
> **Decided — target industry:** independent real estate agents in Tel Aviv (not big franchises/agencies). Rationale: sharp recurring pain (constant listing content, no time to produce it), WhatsApp/Facebook-group-native distribution fits the local market, ~450-570 agents in Tel Aviv is a large enough market with warm local network access for a pilot.
>
> **Decided — Phase 2 first workflow:** listing-to-social pipeline. Agent sends listing facts via WhatsApp → Hermes drafts Hebrew+English captions formatted for Instagram/Facebook/Yad2 → agent reviews and posts manually (no auto-posting in v1).

## 1. What we're building
I'm building a **productized marketing-automation service**. At its core is a **Hermes agent** — an open-source, CLI-based AI agent — that runs one end-to-end marketing process for a client automatically. Around that core sit two things: **secure configuration** (the client's data and credentials handled properly) and a **small reporting web app** so a non-technical person can see what the agent is doing and trust it.

The end goal: package this cleanly enough to demo and pitch to companies — starting with industries slow to adopt tech — as a finished product that delivers real, visible value.

## 2. Who it's for (so your decisions make sense)
The buyer and end-user is a **non-technical marketing lead** at a small or mid-size company. That drives every decision:
- It must be **simple to observe and trust** — clear outputs, visible results.
- It must be **secure by default** — their data, their credentials, never exposed.
- The value must be **visible** — that's the job of the reporting screens.

Optimise for legibility and trust over cleverness.

## 3. How to work with me
I'm a full-stack engineer: JS/TS, Node/Express, Next.js, Python, PostgreSQL, AWS/Terraform, git. Don't over-explain fundamentals — but **do** surface non-obvious tradeoffs, and **flag before any significant architecture, dependency, or security decision**. I want to understand and sign off on every real choice. Keep it simple: no premature abstraction, no over-engineering. Small, reviewable commits.

**My git workflow (follow it exactly):**
`git checkout main` → `git pull` → `git checkout -b feat/<task>` (existing branch: drop the `-b`) → work → `git add .` → `git commit -m "..."` → `git push -u origin feat/<task>` → open a PR into main. One feature branch per task.

## 4. Verify the ground truth before building
I'm working partly from second-hand sources about Hermes, so **before writing any code**, find and read the **official Hermes documentation** and confirm:
- what Hermes actually is and who maintains it,
- how it's installed and run (CLI / local machine / VPS),
- how skills, scheduled jobs, MCP connectors, and messaging channels really work,
- its security model — where secrets live, how auth works, how it's sandboxed.

Report back in plain English, and **flag anything that contradicts the assumptions in this brief**. Don't build on guesses.

## 5. Build order — bottom-up, one layer at a time
Do **not** skip ahead. Finish and confirm each phase with me before starting the next.

- **Phase 0 — Foundation:** clean repo, README, `.gitignore`, environment/secret scaffolding (secrets never committed). Nothing functional yet.
- **Phase 1 — Hermes running bare:** install Hermes, get the simplest possible agent responding. Prove the core works before adding anything.
- **Phase 2 — One real workflow:** automate **one** concrete marketing process fully, as a Hermes skill — input → action → output. Just one, done properly. (We choose which one together.)
- **Phase 3 — Security hardening:** lock down secrets, credentials, network, and access. This is a **first-class phase, not an afterthought** — it's the actual product differentiator.
- **Phase 4 — Reporting screens:** a small Next.js app that surfaces what the agent did — runs, outputs, status — for a non-technical viewer. Read-only, simple, clear.
- **Phase 5 — Packaging:** make it demoable and repeatably deployable — clean setup, docs — so I can stand it up in front of a prospect.

**Phase 2a and 2b — complete.** Hermes installed (Phase 1). Listing-to-social skill built at `agent/skills/real-estate/listing-to-social/`, tested directly via `hermes -z`, and hardened to v0.2.1 (sale vs. rental price phrasing, photo-description handling, and no longer upgrading stated facts into unstated condition/availability or neighborhood claims) — correct, facts-only output across Instagram/Facebook/Yad2 in Hebrew+English, correctly asks a batched follow-up rather than inventing facts when input is incomplete (Phase 2a).

Phase 2b approach: WhatsApp via the **Baileys/QR bridge** (not the official Business Cloud API — that's a Phase 5 production concern once this needs a real public server and Meta verification), paired to a **dedicated eSIM number registered on the WhatsApp Business app** (never the personal number), knowingly accepting Baileys' unofficial-use ban risk at this prototype stage — mitigated by using a throwaway number rather than avoided entirely. Considered and ruled out WhatsApp's "self-chat mode" as a way to test on the personal number in the meantime — official docs describe it as carrying the *same* ban risk as bot mode, just on the number we're specifically trying to protect, so it's not a shortcut worth taking.

**Phase 3 — done for now, two items deliberately parked for Phase 5.** Audited the current setup against Hermes's own official trust-model doc (`SECURITY.md`) rather than assumptions: its stated position is that **the only real security boundary against the agent is OS-level isolation** — the approval gate, output redaction, and allowlists are heuristics, not containment. Three findings came out of the audit, each handled differently:

1. **Isolation posture (`terminal.backend: local` — no OS-level sandboxing).** Hermes's own docs call this "outside the supported security posture" for an agent ingesting messages from surfaces the operator doesn't fully control (exactly what the WhatsApp/Telegram gateway does). Decided to **defer to Phase 5**: containerizing now, on this Windows prototype machine, would likely need redoing anyway once Phase 5 picks a real deployment target (e.g. a Linux VPS) — not worth doing twice. Current exposure is judged low in the meantime (single-tenant personal machine, allowlist-gated senders, no real client traffic yet).
2. **Shared vs. dedicated Hermes instance — done.** The Hermes install was previously a shared, general-purpose personal instance (kanban, Notion/GitHub/Google-Workspace skills, custom personalities, etc.), not something presentable to a client. Created a dedicated **`autoestate` Hermes profile** (`hermes profile create autoestate --clone-all`) — a full separate config/`.env`/skills/session copy, so the paired WhatsApp session and Telegram bot carried over with no re-pairing needed (verified live). Stripped all 19 bundled personal-use skill categories from it, leaving only the real-estate `listing-to-social` skill, and opted the profile out of future bundled-skill reseeding. Disabled WhatsApp/Telegram entirely in the `default` (personal) profile's `.env` (commented out, not set to `false` — a `false` value doesn't actually stop it from trying to connect, see the WhatsApp integration memory) so the two profiles can never collide over the same linked WhatsApp device, and deleted the now-inert duplicate WhatsApp session credential left behind in `default`. Going forward, **AutoEstate's gateway runs from the `autoestate` profile** (`hermes -p autoestate gateway`, or the generated `autoestate` wrapper command), and the personal `default` profile is untouched for unrelated use.
3. **Supply-chain dependency vulnerabilities (`hermes security audit`: 48-50 known CVEs in installed packages, several HIGH).** Attempted the obvious fix (`hermes update`) — it updated Hermes itself cleanly (with a pre-update backup) but did **not** touch the vulnerable pinned versions, since those are locked by Hermes's own upstream lockfile, not something the updater refreshes. Considered forcing a manual `pip` upgrade, but decided **not to**: walking through what each flagged bug actually requires to be exploited (an exposed Starlette HTTP surface for the SSRF/UNC bug, a configured MCP server for the auth-bypass bugs, processing of untrusted image files for the Pillow bugs) showed none of them have a real path in our current setup — no dashboard/API exposed, no MCP servers configured, no actual photo processing (the skill only uses text photo *descriptions*), and messaging is allowlist-gated to the operator's own number. Forcing the upgrade now would risk breaking something that works today (Hermes was tested against the old pinned versions) for bugs with no current exploit path, and might silently get reverted by a future `hermes update` regardless. **Deferred to Phase 5**, when public exposure and/or MCP servers would actually make these bugs reachable — revisit the audit then.

Explicitly decided: deferring items ① and ③ to Phase 5 counts as "finished and confirmed" for Phase 3's purposes, not skipping ahead — neither blocks Phase 4, and both are tracked with reasoning above (and in the `project-phase3-security-hardening` memory) so they aren't forgotten.

**We are at Phase 4 — starting.** Reporting screens: a small Next.js app surfacing what the agent did (runs, outputs, status) for a non-technical viewer. Not yet started — `reporting-app/` is still just a placeholder README.

Before the eSIM arrived, the full gateway pipeline (message in → allowlist → skill fires → reply delivered) was de-risked and validated end-to-end using a disposable Telegram bot as a zero-risk stand-in for WhatsApp, including edge-case testing (2026-07-21): unauthorized senders correctly blocked at the adapter before reaching the agent; the gateway reconnects cleanly (~2s) after a hard restart; non-listing messages ("Hi") get a natural reply instead of hallucinated real estate content. One real finding surfaced and was knowingly accepted rather than fixed: an agent firing off listing facts as several rapid WhatsApp-style messages can trigger a couple of extra follow-up rounds instead of one clean batched question, because each turn takes 10-20s of real LLM latency and `busy_input_mode: interrupt` treats a message arriving mid-turn as an interruption rather than something to wait for — it isn't a batching-window problem (the adapter hardcodes a 0.18s fast-path for short messages that no operator config can override) and fixing it properly would mean patching vendored adapter code or changing interrupt-handling semantics, neither of which is worth doing before this matters in real use. Full detail on the pre-eSIM validation work: `session-handoff-2026-07-21.md`.

**Pairing completed 2026-07-22.** With the eSIM provisioned and WhatsApp Business registered on it, ran `hermes whatsapp` (separate-bot-number mode) and scanned the QR from the WhatsApp Business app's Settings → Linked Devices. A `stream:error code 515` immediately after scanning and an automatic reconnect is expected Baileys/WhatsApp Web restart behavior, not a fault — pairing completed cleanly right after (`✅ WhatsApp connected!`). `WHATSAPP_ALLOWED_USERS` set to the user's personal number (the allowed *sender*, distinct from the bot's own paired number) so only they can trigger it during testing. Started the gateway with both Telegram and WhatsApp connected (`Gateway running with 2 platform(s)`), then ran the real end-to-end test: a listing (Florentin, Tel Aviv, 3 rooms, 75 sqm, for sale, ₪3,200,000, 4th floor, renovated kitchen, balcony) sent via WhatsApp from the user's personal number produced a correct, full bilingual Instagram/Facebook/Yad2 reply — the same pipeline previously proven only via the Telegram stand-in is now confirmed working on real WhatsApp, user-verified as correct. **Phase 2b is done. Next up: Phase 3 — security hardening (not started).**

## 6. Guardrails
- Simplicity over cleverness — smallest thing that works, then iterate.
- Security is never optional and never last.
- Never silently choose an architecture, dependency, or service — explain, then let me decide.
- **Never** take irreversible or account-level actions (deploys, purchases, deleting data, adding credentials to third-party services) without asking me first.
- Prefer boring, well-supported tools over shiny ones.

## 7. Your first task
1. Set up **Phase 0**: propose a repo structure and initial scaffold, keeping the **agent** and the **reporting app** as clearly separated concerns.
2. Do the **Section 4 doc-check**: read the official Hermes docs and report what's real vs. what this brief assumed.
3. Recommend the **single best marketing process to automate first** for a Phase-2 MVP, with your reasoning.

Don't write feature code yet — lay the foundation and align with me first.
