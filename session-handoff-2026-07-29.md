## Session Handoff — 2026-07-29 (evening), extended 2026-07-30 by the third `/inspect` sweep

*Filename still says 07-29 deliberately — it is the only handoff file, so "the most recent `session-handoff-*.md`" resolves here either way, and splitting it would duplicate most of it. The 07-30 work has its own section near the end.*

### What this project is

**AutoEstate** — marketing automation for independent real estate agents in Tel Aviv. An agent messages a bot with listing facts and gets back bilingual (Hebrew + English) content for Instagram, Facebook and Yad2. Prospective buyers message a *separate, public* bot — on **either WhatsApp or Telegram** — and get honest answers about a property 24/7, captured as leads. Both show up in a Next.js dashboard the agent logs into. Built on Hermes, one dedicated instance per customer.

Read [CLAUDE.md](CLAUDE.md) for the brief, architecture and engineering history; [TODO.md](TODO.md) for what's outstanding. Repo: https://github.com/njkarp06-design/AutoEstate (private).

### Where things stand

- **Every roadmap feature is built, live-tested and merged.** Every step that **gates a pilot** is account-level and belongs to the owner. One thing qualifies the old "everything remaining is productionization" line: the 07-30 sweep left **one engineering item** needing a decision (see below). Its other 7 fixes are PR #79 — check its state with `gh pr list --state all`, don't read it off a sentence.
- **The WhatsApp outage is over.** Both channels are live again and both were re-verified end to end with real messages this evening. **The cause was never determined and is now unreproducible** — recorded as unexplained rather than closed with an invented cause. See the incident record in TODO.md.
- **Nothing is hosted.** The reporting app runs only via `npm run dev` (port 4127, and the port is not optional — see below). The Terraform module is `validate`-clean but has **never been applied**: no Hetzner account, no Vercel project, no Cloudflare account.
- **Both bots verified end to end this evening**, at three layers each (gateway log, `state.db`, dev database) — not just the phone screen. Telegram: **REF-RZJ5D** (Frishman). WhatsApp: **REF-H5DHA** (Bugrashov). **Later that night** all four remaining skills were verified on Telegram too, which moved real data: Frishman's price is now 4,150,000 and **Shenkin `REF-QTPT4` is SOLD** (so 4 ACTIVE, 3 SOLD). Re-derive any count with a query rather than trusting one written here.
- **TWO defects were fixed later the same day, and both are fully deployed.** (1) Hermes background-review turns are no longer ingested — filtered at `/api/ingest` and `/api/inquiries`, 3 historical rows deleted; reporting-app source only, so nothing needed redeploying. (2) The listings-context fetch **timed out** on a cold `/api/listings/active` (3s budget, 3.0-3.2s cold), silently costing injected context three times over five days — raised to 10s in **both** context plugins, copied into the profiles, gateway restarted, parity **5/5**, then proven on live cold traffic. Details in TODO's known-issues list and CLAUDE.md.
- **Operator lead notifications are LIVE**, reusing the operator bot rather than a new one. The deferred multi-tenant question is written up in TODO — settle it at the Vercel deploy.
- **Whether a PR is open is deliberately not stated here** — run `gh pr list`. Merged branches are deleted on merge, so `git branch -a` corroborates it.
- **A third `/inspect` sweep ran on 2026-07-30** — the pre-deploy code pass this file recommended, and it was worth it: **8 findings, 1 critical.** Seven fixed in **PR #79**, one deferred with its options costed. Its state is deliberately not asserted here: `gh pr list --state all` and `git log origin/main..` are the answer, because a sentence about whether something is merged is false the moment it is. The critical finding is that the Terraform secret-injection guard against wiping a customer's `.env` had never worked. **No plugin, skill or live profile config changed, so nothing needed redeploying and the parity lines below still hold.** See the section at the end of this file.

### Live systems

Verified **2026-07-29 evening** by listing processes, checking ports, calling the routes, and querying the database. PIDs are a dated observation — re-derive rather than trust them.

| | State |
|---|---|
| `autoestate` gateway (operator) | **running, PID 31076** (was 1032; restarted late that night to load the timeout fix), `Gateway running with 2 platform(s)` — Telegram + WhatsApp both connected |
| `autoestate-buyer` gateway | **stopped**, deliberately — it is public whenever it runs. Both its channels are credentialled and paired |
| WhatsApp bridges | operator bridge **up on port 3000, PID 31116** — *unchanged across the late-night gateway restart*, which is the documented "reuse the bridge if it is healthy AND its `scriptHash` matches" branch actually firing rather than the kill-and-replace path. Zero `405`s since recovery. Port **3001** free (buyer gateway stopped) |
| `default` Hermes gateway | **running, PID 5020** (unrelated personal profile). It was down mid-evening and back up by the late session — it comes and goes, so treat any claim here as a dated observation and re-derive it |
| Reporting app, 127.0.0.1:4127 | **running** (PID 29720 — it died at some point that night and was restarted twice; do not assume it is up, check). All four machine routes healthy. **It must be running before the gateway** — there is no sync spool |
| Anthropic API key | **live with credit** — proven by four real completed turns across both channels, which beats a probe. All three profiles share this one key |
| Telegram bots | operator `@Auto_Estate_Operator_bot` (id 8902059217), buyer `@Auto_Estate_Buyer_bot` (id 8838769580). **Both `/start`ed from the owner's account this evening**, so home-channel pushes now work |
| WhatsApp numbers | operator **+972 55-988-5104** ("Auto-Estate-Bot"), buyer **+972 55-519-4380** ("Autoestate"). Read from each profile's `creds.json` |
| Repo↔live plugin parity | **5/5** — re-measured after the timeout fix was deployed late that night (it dipped to 3/5 between merge and copy). Live `TIMEOUT_SECONDS = 10`, `plugin.yaml` 1.1 / 1.3. Re-run the recipe rather than trusting this |
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

1. ~~Fix the memory-consolidation-turn ingest defect.~~ **DONE later the same day.** The count was 3 of 29 runs; filtered at both ingest routes, 3 historical rows deleted, 34/34 verified through the real routes. The dashboard is no longer *wrong* about anything known. See TODO's known-issues entry.
2. ~~The four skills never tested over Telegram.~~ **DONE later the same day, with real messages** — digest, re-engagement, status-update and just-sold all passed at three layers. It also **found a real defect** (below). See TODO 12a.
3. ~~Create the Telegram notifier bot.~~ **DONE later the same night, and no new bot was created.** It reuses `@Auto_Estate_Operator_bot`'s token at the owner's push-back — alerts land in the channel they already watch, and there is no poller conflict because Hermes polls `getUpdates` while the app only calls `sendMessage`. Verified end to end through the real `/api/inquiries` route and **received on the owner's phone**. The deferred question (per-customer bot tokens vs one shared notifier bot, and the fact that Baileys WhatsApp cannot do this at all) is written up in TODO — settle it at the Vercel deploy.

4. ~~Deploy the pending plugin fix.~~ **DONE the same night** — copied, operator gateway restarted, parity 5/5, then proven on live cold traffic.

~~**There is now NO unblocked work left.**~~ **True on 2026-07-29, no longer true after the 07-30 sweep.** Everything that gates a *pilot* is still account-level — Hetzner + `terraform apply`, the Vercel deploy, the Cloudflare + R2 bucket — but the sweep left one engineering item: **an `UNDER_CONTRACT` listing cannot be found by name** (see the 07-30 section below). It needs your decision between two options, and either one is a deploy, which is why it was not just done. Recommended to settle it alongside item 12b rather than on its own.

**What NOT to do next, and why** — recorded so it isn't re-proposed:

- **Do not run another `/docs` sweep.** Two ran on 2026-07-29 already. More to the point, the morning one records reading *"every satellite README"* and still missed **both** satellite-doc claims corrected that evening — because neither was an internal contradiction. Both were statements about the world that were true when written, and reading cannot catch those; only operating the system can. A third doc pass would mostly re-derive what is already correct, and is weakest at exactly the failure class that keeps biting.
- ~~**`/inspect` is worth running — but before the Vercel/Hetzner deploy, not now.**~~ **DONE 2026-07-30, and the recommendation was right.** The reasoning stood: the last code sweep had been 2026-07-27 and both doc passes since rested on it. 8 findings, 1 critical — including a Terraform guard that had been believed working for eight days and was not, on the exact resource `terraform apply` runs. See the section at the end of this file. **Do not run a fourth now**; the next one belongs after the Hetzner/Vercel deploys, when real infrastructure exists to inspect against.

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

**Later the same day (two PRs; one carries a plugin change that is NOT yet deployed):**

- **All four remaining skills verified on Telegram** with real messages — digest, re-engagement, status-update, just-sold. Real transitions checked in place on the same row (Frishman price, Shenkin → SOLD), preserving `refCode`/price/features across footers that omitted them.
- **That testing found a real defect: the listings-context fetch timeout was too tight.** `/api/listings/active` takes 3.0-3.2s cold against a 3s budget, so the fetch silently failed and the skill asked for facts it should have had. Raised to 10s in **both** context plugins. **Pending deployment** — copy + operator gateway restart.
- **Method note worth keeping:** the failing test looked exactly like a keyword-gate miss, and running the live hook proved the gate matched and the *fetch* had timed out. Separately, `gateway.log` has zero lines from that plugin — which is not evidence of a silent failure; plugin warnings live in `agent.log`/`errors.log`, where all three prior occurrences were sitting.
- **Hermes background-review turns no longer reach the dashboard.** Counted first (3 of 29 runs), then filtered at `/api/ingest` and `/api/inquiries` via a shared `lib/hermes-harness.ts`, then the 3 historical rows deleted with a committed dry-run-by-default script. 34/34 verified through the real routes with a throwaway customer, cleanup proven by query.
- **Two things only the vendored source revealed:** Hermes builds *three* review prompts and its own denylist covers only two, so the filter matches the stem all three share rather than copying that list; and the review runs on a fork with persistence disabled, which is why these turns exist in our database and nowhere else.

### What changed on 2026-07-30 — the third `/inspect` sweep

All 104 in-scope tracked files re-read. **8 findings: 1 critical, 2 major, 5 minor.** 7 fixed in **PR #79**, 1 deferred deliberately. **Nothing touched a plugin, a `SKILL.md` or a live profile config**, so nothing needs redeploying — that was a constraint on the fix plan, not luck, and it is why the parity lines in "Live systems" above are still valid.

**The critical one — the Terraform secret-injection guard had never worked.** `null_resource.inject_secrets` ends with a sentinel `grep -q '^AUTOESTATE_CUSTOMER_ID='` before a destructive `mv`, added on 2026-07-22 precisely so a corrupted `.env` could not wipe `ANTHROPIC_API_KEY`. Terraform concatenates `remote-exec`'s `inline` into **one newline-joined script with no shebang and no errexit**, and reports the **last** command's exit status — so the failing sentinel did not stop the `mv`, and the provisioner still reported success because `docker compose restart` did. Replayed under plain `sh`: the live `.env` came back holding only the three injected secrets and the script **exited 0**. Fixed with `set -e` as the first `inline` entry of all four blocks. **Read `/root/.hermes/.env` after the first real apply** — the fix has never run against a server, and it makes previously-ignored non-zero exits fatal, so if the apply fails at that step that is the guard working.

**Two majors, each blocking the next real action.** The buyer `.env.example` **omitted `WHATSAPP_ALLOW_ALL_USERS`** — absent, not commented — without which `dm_policy: open` makes Hermes refuse to boot; a buyer instance built by following that profile's own README would never have started. And `infra/customers/example/main.tf` declared and passed **neither Telegram variable** while the module README tells you to set them; Terraform only *warns* on an undeclared root variable, so the operator gets a green apply and a WhatsApp-only box.

**Five minors:** the `Serializable` ingest transaction had no `P2034` retry, so it had traded duplicate listings for a silently-lost one; `getCurrentCustomer` linked a Clerk user to a `Customer` row without checking the email was verified, despite claiming to; `provision-customer.ts` read the `--role` value as the email when the flag came first; the Inquiries strip counted an operator-handled lead as "Auto-answered".

**Deferred on purpose, and it is the one thing left from this sweep:** an `UNDER_CONTRACT` listing is invisible to the locator lookup (`/api/listings/active` is ACTIVE-only), so "the X place went under contract" → "the X place sold" has the agent told its own listing isn't on record. Data is safe; the fix is either a machine-route contract change plus a new `weekly-digest` rule, or a wording-only edit to three `SKILL.md` files — both are deploys, both need your call. Options costed in TODO's known-issues list. **Settle it alongside item 12b.**

**Two durable lessons, now §5 recipes:** *a guard written in a language you are not actually running is not a guard* — a `remote-exec` `inline` list reads like a shell script and is not one until `set -e` is its first entry; and *a per-customer wrapper must declare every variable its README mentions*, since the module declaring it proves nothing.

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
- **⚠ AND THE MACHINE VIOLATES THAT RULE FOR YOU ON EVERY LOGIN.** Verified 2026-07-30 by listing the Startup folder: `Hermes_Gateway.vbs` and `Hermes_Gateway_autoestate.vbs` both auto-start on login, and **the reporting app does not**. So after any reboot or logout the operator gateway is up and the ingestion endpoint is dead, which is exactly the ordering the rule above forbids — arrived at by default rather than by mistake. Nothing is lost while nobody messages the bot, so the practical rule is: **first thing after a login, start the app (`npm run dev -- -p 4127`) before sending the bot anything.** Stopping the gateway the night before does *not* help — it comes back on the next login regardless. (The **buyer** profile deliberately has no Startup entry, which is why the public bot stays stopped across reboots; keep it that way.)
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

> Read session-handoff-2026-07-29.md and continue. **First: a third `/inspect` sweep ran on 2026-07-30 and its 7 fixes are PR #79 — establish its state with `gh pr list --state all` and `git log origin/main..` rather than from any sentence here, since "merged"/"open" is false the moment it changes.** One critical finding in it: the Terraform `.env` secret-injection guard had never worked (`remote-exec` runs `inline` with no errexit), so read `/root/.hermes/.env` after the first real `terraform apply`, and if the apply *fails* at that step, that is the new guard working rather than a regression. Nothing in that sweep touched a plugin, skill or live profile config, so nothing needs redeploying and the parity lines in "Live systems" still hold — re-run CLAUDE.md §5's recipes rather than trusting them. Everything else is built, merged and live-tested, and the WhatsApp outage of 07-29 is **resolved** — both channels live and re-verified end to end. **What's left is productionization**, and all three next steps are account-level: Hetzner + `terraform apply` (TODO 3), the Vercel deploy (TODO 4, land the partial unique index on `Listing` first), and the Cloudflare + R2 bucket (TODO 13, smallest and independent). **Don't start any of them without me** — they cost money and none of the accounts exist. **One engineering item is unblocked**, from that sweep: an `UNDER_CONTRACT` listing cannot be found by name, and the two fixes are both deploys, so it needs my decision — see the 07-30 section and TODO's known issues. Beyond that, everything outstanding is account-level. **Do not run another `/docs` sweep** (two ran on 07-29, and reading is the wrong instrument for the claims that keep going stale) **and do not run a fourth `/inspect`** — the 07-30 one is the pre-deploy pass; the next belongs after Hetzner/Vercel, when real infrastructure exists to inspect against. The reasoning for all of this is in "What to do next" — overrule it deliberately if you disagree, don't re-derive it. Four things to know before touching anything. **Start the reporting app before the gateway** — WhatsApp delivers queued messages seconds after a bridge reconnects and there is no sync spool, which cost a real turn on 07-29. **`npm run dev -- -p 4127`** — without the flag Next takes port 3000, the WhatsApp bridge's port, and every sync silently fails. **The buyer gateway is stopped and should stay stopped** unless you are testing — it is public whenever it runs, and its `bridge_port` must stay 3001. **Credit exhaustion is a live failure mode** — all three profiles share one Anthropic key. If a dev server is running from an older checkout, restart it: the Prisma client loads at start.
