## Session Handoff - 2026-07-24 (updated, end of day)

### Task Overview

Building **AutoEstate**: a productized marketing-automation service for independent real estate agents in Tel Aviv, per [CLAUDE.md](CLAUDE.md) (source of truth — read it first on resume, especially the last ~10 paragraphs of Section 5). This continues from the previous version of this handoff (gateway footer-omission bug, PR #23). Two more feature PRs shipped and merged this same day:

1. **PR #25** — new `just-sold` and `listing-reengagement` skills (the "re-engagement / just-sold posts" roadmap item).
2. **PR #26** — locator-based listing lookup, a same-day follow-up: real live-testing of PR #25 surfaced a typo caused by manually retyping facts, so the agent can now name a listing (e.g. "the Dizengoff place") instead, matched against the reporting system's own data.

GitHub repo: https://github.com/njkarp06-design/AutoEstate (private). **Repo is on `main`, clean, up to date with origin. PR #25 and PR #26 are both MERGED.** Nothing is pending review.

### Files Modified

**In the git repo, merged to `main`:**

*PR #25 (`feat/reengagement-just-sold-skills`, branch not deleted — see Current State):*
- `agent/skills/real-estate/just-sold/SKILL.md` — new. Celebratory social-proof "sold" post; the only skill that emits `Status: Sold`.
- `agent/skills/real-estate/listing-reengagement/SKILL.md` — new. Re-promotes a still-active, unchanged listing; no Listing Record footer.
- `agent/skills/real-estate/listing-status-update/SKILL.md` — narrowed (v0.2.0 → v0.3.0): no longer handles a completed sale, price-drop/under-contract only.
- `agent/skills/real-estate/listing-to-social/SKILL.md`, `agent/plugins/listing-footer-reminder/__init__.py` — cross-reference/reminder-text updates for the two new skills.
- `agent/README.md`, `README.md`, `CLAUDE.md` — docs.

*PR #26 (`feat/listing-lookup-by-locator`, branch not deleted — see Current State):*
- `agent/plugins/active-listings-context/__init__.py` + `plugin.yaml` — keyword gate widened from digest-only to also cover reengagement/status-change/sale phrasing; injected context line now includes `floor`.
- `agent/skills/real-estate/listing-reengagement/SKILL.md`, `listing-status-update/SKILL.md`, `just-sold/SKILL.md` — added the locator-lookup path. The latter two defer their Listing Record footer to a confirmed follow-up turn when no locator is given (see Decisions Made — this was a redesign after testing, not the original plan).
- `README.md`, `CLAUDE.md` — docs (plus two stale "not yet merged" corrections caught and fixed during this handoff refresh — see below).

**Outside the git repo (local machine / live profile state — matters for reproducing or continuing on this machine):**
- `~/hermes/profiles/autoestate/plugins/active-listings-context/` — **newly deployed this session** (was built in PR #19 but never actually copied to the live profile until now — a known, already-documented deferral). Manually copied in, same as `listing-footer-reminder`/`sync-to-webapp` (plugins aren't loaded via `external_dirs` the way skills are).
- `~/hermes/profiles/autoestate/config.yaml` — `plugins.enabled` now includes `active-listings-context` (alongside `sync-to-webapp`, `listing-footer-reminder`).
- **New Windows Startup-folder login item:** `Hermes_Gateway_autoestate.vbs`, installed by a `gateway restart` command that hit interactive prompts in a non-interactive shell and auto-defaulted through them. Not something explicitly requested — flagged immediately, user confirmed keeping it. The `autoestate` gateway now auto-starts on every Windows login (same as the pre-existing `default`-profile item from earlier the same day).
- The gateway was restarted **three times** this session: once for the PR #25 plugin redeploy, twice for PR #26 (the second restart fixed a real bug — see Errors Hit #3). Currently running (PID 29908 as of last check), process healthy.
- **`~/hermes/profiles/autoestate/.env`'s `ANTHROPIC_API_KEY` is dead again** (credit balance too low) — same recurring issue as the previous handoff. **Not yet topped up as of this writing.** This blocks one outstanding live-verification test (see Next Step #1) and means the live gateway will currently fail every real reply until topped up.
- The reporting-app dev server (port 4127) **is still running** from earlier verification work — confirmed reachable (`curl http://127.0.0.1:4127/api/listings/active` → 401, meaning it's up). Check `Get-NetTCPConnection -LocalPort 4127` before starting another one — don't create a duplicate/orphaned instance (documented gotcha from PR #17).

### Decisions Made

- **`just-sold` replaces `listing-status-update`'s old Sold case, not additive** — avoids two skills both plausibly matching "it sold, make a post" (a real skill-routing ambiguity risk).
- **`listing-reengagement` is agent-initiated, no new data plumbing** — matches the roadmap's "cheap, proven-shape addition" framing; a data-driven staleness check was considered and explicitly deferred.
- **Locator lookup reuses `weekly-digest`'s existing plugin/endpoint mechanism rather than building anything new** — a live backend lookup is categorically different from the model's own memory, so it doesn't weaken the "never trust memory" principle these skills are built on.
- **Key asymmetry, caught by an adversarial plan self-review before writing code:** `listing-status-update`/`just-sold`'s Listing Record footer automatically mutates the database the instant a WhatsApp reply is sent, with no undo UI — so those two require a stated locator or an explicit confirmation before that footer fires. `listing-reengagement` has no such footer and can safely auto-pick a lone active listing.
- **Redesigned mid-session after testing disproved the original plan:** "ask a confirmation question, generate nothing else this turn" was the first design for the no-locator case — tested via `hermes -z`, and the model ignored it, completing full content anyway (same class of gap as the PR #23 gateway footer-omission bug: no in-context instruction reliably makes a model withhold an action it judges helpful). Redesigned around the gap instead of fighting it: produce content immediately, withhold only the footer, ask confirmation in its place, add the footer once confirmed in a later turn.

### Errors Hit

1. **A real regex bug caught before shipping, not after.** The first draft of the widened keyword gate had a leading `|` on each continuation line, silently creating empty-string alternations that would have matched every message unconditionally. Caught by testing the compiled pattern directly in Python against real and non-matching sample messages before deploying it.
2. **The planned "confirmation-only, no content" safety mechanism didn't survive contact with the model** (see Decisions Made) — redesigned to defer only the footer instead.
3. **A real live-WhatsApp bug `hermes -z` could never have caught:** the newly-enabled `active-listings-context` plugin silently didn't fire on its first gateway restart, despite passing every isolated check (platform, keyword match, env vars, endpoint reachability, and a direct call to the deployed function all worked). Root-caused via direct evidence — exported the real session and inspected each turn's raw `api_content` field (the literal text sent to the model), not the persisted `content` field, which doesn't reliably reflect ephemeral `pre_llm_call`-injected context. A second clean gateway restart fixed it; re-verified the same way. Root cause of the stale first-enable registration not pinned down further (resolved on retry, not worth chasing).
4. **A minor, pre-existing, unrelated issue also surfaced live:** when the plugin wasn't yet firing (before fix #3 above), the model correctly fell back to asking for missing facts, but asked for rooms and then sqm as two separate single-field questions instead of one batched question — violates an already-existing "batch everything missing into one question" rule. Not fixed in PR #26; flagged for awareness only.
5. **The Windows Startup-folder side effect** (see Files Modified) — not a bug exactly, but an unintended/unrequested system change caught and flagged before assuming it was fine.
6. **This handoff refresh itself caught two stale-documentation bugs while verifying state before writing it:** a dangling sentence in `CLAUDE.md` that stated "next roadmap item is buyer-inquiry auto-reply" in the middle of the PR #25 writeup — written before PR #26's work even started, left stranded mid-document by how content was inserted — and multiple "PR pending" / "not yet merged" references in `README.md` and memory files that were never updated after PR #21, #25, and #26 actually merged. All fixed as part of this handoff (see `git diff` on this commit, or just trust the current file contents — they're correct as of this writing).

### Current State

- **PR #25 and PR #26 both merged to `main`.** Local repo on `main`, clean, up to date with origin.
- **Two merged feature branches still exist, locally and on the remote, not deleted:** `feat/reengagement-just-sold-skills`, `feat/listing-lookup-by-locator`. Harmless (fully merged, no unique commits), but worth cleaning up (`git branch -d` / `git push origin --delete`) next time it's convenient — not done automatically since it wasn't asked for.
- **Live verification:** the locator-match path is confirmed working end-to-end on real WhatsApp (verified via raw `api_content` inspection, not just the reply text). The no-locator confirmation-deferral path was verified only via `hermes -z` simulation — **not yet confirmed live** (see Next Step #1-2).
- **`autoestate`'s Anthropic API credit balance is dry right now.** The live gateway process is running but will fail every real reply until topped up.
- **CLAUDE.md and README.md are both now accurate and internally consistent** — re-verified and fixed as part of writing this handoff (see Errors Hit #6).
- **Memory updated:** `project_reengagement_just_sold_skills.md`, `project_locator_listing_lookup.md` (new), `project_marketing_automation_roadmap.md`, `project_listing_memory_digest.md`, `project_reporting_app_redesign.md`, and `MEMORY.md`'s index all corrected/updated to reflect actual merge state.

### Next Step — ordered punch list

1. **Top up `autoestate`'s Anthropic Console credit balance** at console.anthropic.com. Blocking — the live gateway can't reply to anything until this happens. (Recurring issue across multiple sessions now — seriously consider enabling Anthropic Console's auto-reload billing setting while there, so this stops silently recurring. Recommended at least twice before, never confirmed done.)
2. **Once credits are restored, finish the one open live-verification gap from PR #26:** send a real WhatsApp message that triggers the no-locator confirmation-deferral path (e.g. "it sold!" with no street name, for a status-mutating skill) and confirm the agent produces content immediately but withholds the Listing Record footer, asking for confirmation instead — then confirm the footer gets added correctly once you reply to confirm. This is the one thing standing between "done" and "fully verified" for PR #26. No code changes expected either way — this is a verification step, not new work — but if it fails, that's a real bug to fix before considering the feature closed.
3. **Optional housekeeping, whenever convenient (not blocking):** delete the two merged local/remote branches (`feat/reengagement-just-sold-skills`, `feat/listing-lookup-by-locator`); consider stopping the reporting-app dev server on port 4127 if it's not being actively used, or just remember it's there so a future session doesn't spawn a duplicate.
4. **Next roadmap item: buyer-inquiry auto-reply** (see `project_marketing_automation_roadmap` memory). Deliberately last on the roadmap — different product shape from everything built so far (inbound, not outbound marketing content), which means a new sender/allowlist model and a materially different trust surface than the existing operator-only allowlist. Biggest lift, most differentiated pitch value. Nothing blocks starting this once #1-2 above are settled — it doesn't depend on them, they're just cleaner to close out first.
5. **Longer-standing, lower-priority deferred items** (unchanged from before this session, still outstanding): `terraform apply` to a real Hetzner account (infra module written and validated, never applied — no real Hetzner account exists yet) and a Vercel Pro deployment of the reporting app (still `npm run dev`-only). Not blocking anything; revisit when there's a real customer to onboard.

### How to Resume

Paste this at the start of a new session:

> Read session-handoff-2026-07-24.md and continue from where we left off
