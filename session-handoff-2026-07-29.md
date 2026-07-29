## Session Handoff — 2026-07-29 (evening; supersedes the morning version of this file)

### What this project is

**AutoEstate** — marketing automation for independent real estate agents in Tel Aviv. An agent messages a bot with listing facts and gets back bilingual (Hebrew + English) content for Instagram, Facebook and Yad2. Prospective buyers message a *separate, public* bot — on **either WhatsApp or Telegram** — and get honest answers about a property 24/7, captured as leads. Both show up in a Next.js dashboard the agent logs into. Built on Hermes, one dedicated instance per customer.

Read [CLAUDE.md](CLAUDE.md) for the brief, architecture and engineering history; [TODO.md](TODO.md) for what's outstanding. Repo: https://github.com/njkarp06-design/AutoEstate (private).

### Where things stand

- **Every roadmap feature is built, live-tested and merged.** **Everything remaining is productionization**, and every step that gates a pilot is account-level and belongs to the owner.
- **The WhatsApp outage is over.** Both channels are live again and both were re-verified end to end with real messages this evening. **The cause was never determined and is now unreproducible** — recorded as unexplained rather than closed with an invented cause. See the incident record in TODO.md.
- **Nothing is hosted.** The reporting app runs only via `npm run dev` (port 4127, and the port is not optional — see below). The Terraform module is `validate`-clean but has **never been applied**: no Hetzner account, no Vercel project, no Cloudflare account.
- **Both bots verified end to end this evening**, at three layers each (gateway log, `state.db`, dev database) — not just the phone screen. Telegram: **REF-RZJ5D** (Frishman). WhatsApp: **REF-H5DHA** (Bugrashov). Database now holds 7 listings / 29 runs, 7 distinct ref codes.
- **One new defect, not yet fixed:** Hermes memory-consolidation turns are ingested as customer-visible `Run` rows. Details in TODO's known-issues list.
- **Whether a PR is open is deliberately not stated here** — run `gh pr list`. Merged branches are deleted on merge, so `git branch -a` corroborates it.

### Live systems

Verified **2026-07-29 evening** by listing processes, checking ports, calling the routes, and querying the database. PIDs are a dated observation — re-derive rather than trust them.

| | State |
|---|---|
| `autoestate` gateway (operator) | **running, PID 1032, `Gateway running with 2 platform(s)`** — Telegram + WhatsApp both connected |
| `autoestate-buyer` gateway | **stopped**, deliberately — it is public whenever it runs. Both its channels are credentialled and paired |
| WhatsApp bridges | operator bridge **up on port 3000** (PID 31116), zero `405`s since recovery. Port **3001** free (buyer gateway stopped) |
| `default` Hermes gateway | **not running** (unrelated personal profile; it was running this morning) |
| Reporting app, 127.0.0.1:4127 | **running** (PID 23668). All four machine routes healthy — `401` on the two GETs, `405` on the two POST-only ones |
| Anthropic API key | **live with credit** — proven by four real completed turns across both channels, which beats a probe. All three profiles share this one key |
| Telegram bots | operator `@Auto_Estate_Operator_bot` (id 8902059217), buyer `@Auto_Estate_Buyer_bot` (id 8838769580). **Both `/start`ed from the owner's account this evening**, so home-channel pushes now work |
| WhatsApp numbers | operator **+972 55-988-5104** ("Auto-Estate-Bot"), buyer **+972 55-519-4380** ("Autoestate"). Read from each profile's `creds.json` |
| Repo↔live plugin parity | **5/5** |
| Repo↔live buyer `config.yaml` | **0 drift** (41 keys compared, 3 `MACHINE-SPECIFIC` markers honoured) |
| Skill / plugin versions | read off disk, all matching the docs |

### What to do next

Three account-level steps, all needing the owner, none of which I can do:

1. **Create a Hetzner account, then `terraform apply`** (TODO item 3). Three things there have **never run**: the operator SSH key must be uploaded to the project once beforehand (Hetzner rejects a duplicate public key, so the module looks it up); skills and plugins arrive via post-boot SSH upload rather than cloud-init, so confirm they landed; and operator slash-command access is ungated by default on that box.
2. **Deploy the reporting app to Vercel Pro** (item 4). **Land the partial unique index on `Listing` first** — the current `Serializable` transaction removes the ingest dedupe race on that code path, but the durable guarantee needs `UNIQUE (customerId, lower(area), rooms, sqm) WHERE status <> 'SOLD'`, and the obvious plain `@@unique` is wrong because it would block a legitimate relist of a sold property.
3. **Create the Cloudflare account + R2 bucket** (item 13). Smallest of the three and independent of them: it unblocks all of listing media. Expected cost at pilot scale is zero, but re-check R2's pricing at signup.

**Then, before any real customer:** harden the public buyer instance (items 5–6: OS-level isolation, re-run `hermes security audit`), and add `WHATSAPP_ALLOW_ALL_USERS=true` to any buyer instance Terraform provisions — with `dm_policy: open` Hermes refuses to boot without it.

**Then the target state, not a pilot blocker:** migrate the buyer channel to the official WhatsApp Cloud API (item 12b). **Close the `whatsapp_cloud` lockdown gate in the same change, never after.**

**Unblocked work needing no account, in recommended order** (decided 2026-07-29 evening — follow it or overrule it deliberately, don't re-derive it):

1. **Fix the memory-consolidation-turn ingest defect.** *Do this first.* It is the only thing currently making the dashboard **wrong** rather than merely incomplete — Hermes's internal prompt and the agent's private notes about the operator are on the customer-facing Activity page right now. **First action is a single query: count the affected historical rows.** That is what decides whether this is a ten-minute filter in `/api/ingest` or something needing a backfill decision, and it has deliberately not been measured. Details in TODO's known-issues list.
2. **The four skills never tested over Telegram** (status-update, just-sold, re-engagement, digest). `listing-to-social` is proven there twice. Cheap, and genuinely unverified — but nothing is broken, so it ranks below a live defect.
3. **Create the Telegram notifier bot** and set `OPERATOR_TELEGRAM_BOT_TOKEN` so operator lead alerts push. The dashboard records leads either way.

**What NOT to do next, and why** — recorded so it isn't re-proposed:

- **Do not run another `/docs` sweep.** Two ran on 2026-07-29 already. More to the point, the morning one records reading *"every satellite README"* and still missed **both** satellite-doc claims corrected that evening — because neither was an internal contradiction. Both were statements about the world that were true when written, and reading cannot catch those; only operating the system can. A third doc pass would mostly re-derive what is already correct, and is weakest at exactly the failure class that keeps biting.
- **`/inspect` is worth running — but before the Vercel/Hetzner deploy, not now.** The last *code* sweep was **2026-07-27**, and both passes since have explicitly rested on it, so that is the real coverage gap. Its value is highest just before real infrastructure and a real customer exist: the last one found 27 defects including one that would have killed a first onboarding.

**Nothing needs doing to the live systems.** They are in a good state and the buyer gateway is correctly stopped.

### What changed on 2026-07-29

**Morning (merged, PRs #66–#71):** outbound file delivery locked down on the buyer instance (`gateway.strict: true` **and** `gateway.trust_recent_files: false` — the second is load-bearing); item 13 scoped with Cloudflare R2 chosen as the blob store; the Cloud API migration sequenced into the ordered path; the contract-signing idea cross-linked.

**Evening (this session — live operations, no repo artefact deployed):**

- **Recovered the operator's WhatsApp with no re-pairing** by restoring its preserved session. Its device link had never been logged out; the incident only moved the files aside, so the gateway saw no `creds.json` and reported "enabled but not paired" — which looks identical to a dead link. The morning handoff had written that backup off as "unlikely to be useful"; that was a judgement, never tested, and wrong.
- **Re-paired the buyer number**, which genuinely had logged itself out.
- **Caught and reverted an allowlist overwrite.** `hermes whatsapp` re-runs *first-time setup* when it cannot see existing `WHATSAPP_*` values, and wrote `WHATSAPP_ALLOWED_USERS=*` onto the **operator** profile. Never live — the running gateway had WhatsApp disconnected and was not restarted before the fix. Restored from `.env.bak.20260729-wa-off`; a further backup sits at `.env.bak.20260729-allowlist-fix`.
- **Measured that neither commenting out `WHATSAPP_*` nor `WHATSAPP_ENABLED=false` disables WhatsApp** — corrected in five places, including two code comments that implied commenting out was a kill switch.
- **Lost a real turn to the reconnect race**, and recovered it by re-sending.
- **Fixed two stale satellite-doc claims** no docs-vs-docs check could have caught: the buyer profile's "transport is undecided" (settled a day earlier) and `reporting-app/README.md`'s claim that port 3000 is permanently occupied and Next auto-falls-back to 4127 (both false — that is what sent the dev server to 3000 tonight).

### Open questions for the owner

**None blocking.** Two recorded rather than acted on:

- **The `405` cause is unexplained.** If it recurs, the diagnostic that was never completed is comparing a failing home-network attempt against a hotspot one *in the same window*; this evening both eventually worked, so the discriminator was lost.
- Cosmetic: the two Telegram bots' display names differ in casing. Changeable in BotFather without touching a token.

**Anthropic credit exhaustion remains a live failure mode** — auto-reload was reported enabled, yet the key was found dry on 2026-07-28. It is live with credit as of this evening, proven by four completed turns. All three profiles share **one** key, so one empty balance takes everything down.

### Working conventions

- **Git:** `main` → feature branch → PR. Never commit to `main`. **Never merge without asking** — the owner asks explicitly each time.
- **No hooks exist in this repo.** Doc-sync is a convention: record real changes as part of finishing a task. Do not reintroduce automation.
- **Verify by running something.** CLAUDE.md §5 carries the exact recipes, now including *whether a platform is really enabled*, *which number a profile is paired to*, and *where its session actually lives*. Every one has caught something real.
- **Merging deploys nothing.** Plugins are physical copies inside each profile. A plugin PR is not finished until the parity recipe passes and the gateway has been restarted — by the **owner, from their own shell**. Restarting from an agent session has caused a full outage before.

### Environment gotchas

- **Start the reporting app BEFORE the gateway.** WhatsApp delivers queued messages within seconds of a bridge reconnecting (6s, measured this evening), and `sync-to-webapp` has no spool — a turn completed while the app is down is lost permanently, with a perfect-looking reply and a silently missing dashboard entry.
- **`npm run dev -- -p 4127` — the flag is not optional.** The script is a bare `next dev`, so without it Next takes **3000**, which is the WhatsApp bridge's port. Both profiles hardcode the ingestion URL to 4127, so an app on any other port is up but unreachable.
- **Neither commenting out `WHATSAPP_*` nor `WHATSAPP_ENABLED=false` disables WhatsApp.** Only the absence of a pairing (`creds.json`) keeps the adapter off the network. Mechanism unconfirmed; do not assert one.
- **Re-pairing rewrites `.env`.** If the wizard asks the *open* "who should be allowed to message the bot?" question rather than "keep what you have?", it has lost your allowlist — retype the real value, never `*`. `*` is correct only on the buyer profile.
- **An empty `whatsapp/session/` makes the adapter report the *other* session path** in its "not paired" warning (`get_hermes_dir` prefers the legacy path only if it has content). Looks like a path bug; isn't.
- **A gateway restart replaces the WhatsApp bridge whenever that bridge is unhealthy or stale.** Reuse requires `/health` = `connected` **and** a `scriptHash` matching the on-disk `bridge.js`. Pairing survives regardless; the *connection* does not.
- **Never let the buyer gateway run with the default WhatsApp `bridge_port`.** The adapter defaults to 3000 and kills whatever holds that port on start — 3000 is the live operator bridge. The buyer config pins `3001`; do not "tidy" it. Pairing is unaffected (`--pair-only` starts no HTTP server).
- **`/start` is a no-op by design** — Hermes acknowledges the platform ping without replying. Silence there is correct, not a fault. But a fresh bot cannot DM someone who has never messaged it, so `/start` is still required before home-channel pushes work.
- **`gateway run` is foreground, `gateway start` is the detached service.**
- Use **`127.0.0.1`**, never `localhost` (IPv6 collision). Check health on an **API** route (401 = healthy), not a page route.
- **Never edit a profile's `config.yaml` while its gateway is running** — the gateway rewrites the file and strips comments. Compare as parsed YAML, not text.
- Per-profile logs: `%LOCALAPPDATA%\hermes\profiles\<profile>\logs\gateway.log` — not the shared path, which has misled a session.
- **After ANY schema change, restart the `next dev` server on 4127.** The Prisma client loads at server *start*.
- **Don't run `npm run build` while the dev server is up** — shared `.next/`. But remember `next build` catches `"use server"` export errors that `tsc` and `eslint` both miss.
- **When resolving anything profile-scoped, set `HERMES_HOME` explicitly.** Measuring the wrong profile is this environment's most repeated mistake.

### How to resume

> Read session-handoff-2026-07-29.md and continue. Everything is built, merged and live-tested, and the WhatsApp outage that was open this morning is **resolved** — both channels are live and were re-verified end to end. Verify with `git log origin/main..` and `gh pr list --state all` rather than trusting any branch/PR claim here, and re-run CLAUDE.md §5's parity recipes rather than trusting the parity lines. **What's left is productionization**, and all three next steps are account-level: Hetzner + `terraform apply` (TODO 3), the Vercel deploy (TODO 4, land the partial unique index on `Listing` first), and the Cloudflare + R2 bucket (TODO 13, smallest and independent). **Don't start any of them without me** — they cost money and none of the accounts exist. For unblocked work, **start with the memory-consolidation-turn ingest defect** — it is the only thing currently making the dashboard *wrong* rather than incomplete, and its first action is one query: count the affected rows. The four Telegram-untested skills come after it. **Do not run another `/docs` sweep** (two ran on 2026-07-29, and reading is the wrong instrument for the claims that keep going stale); `/inspect` is worth running, but before the Vercel/Hetzner deploy rather than now. The reasoning for all of this is in "What to do next" — overrule it deliberately if you disagree, don't re-derive it. Four things to know before touching anything. **Start the reporting app before the gateway** — WhatsApp delivers queued messages seconds after a bridge reconnects and there is no sync spool, which cost a real turn on 2026-07-29. **`npm run dev -- -p 4127`** — without the flag Next takes port 3000, the WhatsApp bridge's port, and every sync silently fails. **The buyer gateway is stopped and should stay stopped** unless you are testing — it is public whenever it runs, and its `bridge_port` must stay 3001. **Credit exhaustion is a live failure mode** — all three profiles share one Anthropic key. If a dev server is running from an older checkout, restart it: the Prisma client loads at start.
