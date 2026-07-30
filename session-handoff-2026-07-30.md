## Session Handoff — 2026-07-30

*One handoff file, always — "the most recent `session-handoff-*.md`" must resolve to exactly one thing. Renamed from `-2026-07-29` on 2026-07-30, when the bulk of its content became 07-30 work and the old date had stopped being honest. Sections below are dated individually; the state summaries are rewritten each pass rather than stacked.*

### What this project is

**AutoEstate** — marketing automation for independent real estate agents in Tel Aviv. An agent messages a bot with listing facts and gets back bilingual (Hebrew + English) content for Instagram, Facebook and Yad2. Prospective buyers message a *separate, public* bot — on **either WhatsApp or Telegram** — and get honest answers about a property 24/7, captured as leads. Both show up in a Next.js dashboard the agent logs into. Built on Hermes, one dedicated instance per customer.

Read [CLAUDE.md](CLAUDE.md) for the brief, architecture and engineering history; [TODO.md](TODO.md) for what's outstanding. Repo: https://github.com/njkarp06-design/AutoEstate (private).

### Where things stand

- **Every roadmap feature is built, live-tested and merged.** Every step that **gates a pilot** is account-level and belongs to the owner. Two things qualify the old "everything remaining is productionization" line: the two sweeps of 2026-07-30 left **two engineering items** needing your decision (below). Their other fixes are PR #79 and the docs branch — check state with `gh pr list --state all`, don't read it off a sentence.
- **The WhatsApp outage is over.** Both channels are live again and both were re-verified end to end with real messages on 2026-07-29. **The cause was never determined and is now unreproducible** — recorded as unexplained rather than closed with an invented cause. See the incident record in TODO.md.
- **Nothing is hosted.** The reporting app runs only via `npm run dev` (port 4127, and the port is not optional — see below). The Terraform module is `validate`-clean but has **never been applied**: no Hetzner account, no Vercel project, no Cloudflare account.
- **Both bots verified end to end this evening**, at three layers each (gateway log, `state.db`, dev database) — not just the phone screen. Telegram: **REF-RZJ5D** (Frishman). WhatsApp: **REF-H5DHA** (Bugrashov). **Later that night** all four remaining skills were verified on Telegram too, which moved real data: Frishman's price is now 4,150,000 and **Shenkin `REF-QTPT4` is SOLD** (so 4 ACTIVE, 3 SOLD). Re-derive any count with a query rather than trusting one written here.
- **TWO defects were fixed later the same day, and both are fully deployed.** (1) Hermes background-review turns are no longer ingested — filtered at `/api/ingest` and `/api/inquiries`, 3 historical rows deleted; reporting-app source only, so nothing needed redeploying. (2) The listings-context fetch **timed out** on a cold `/api/listings/active` (3s budget, 3.0-3.2s cold), silently costing injected context three times over five days — raised to 10s in **both** context plugins, copied into the profiles, gateway restarted, parity **5/5**, then proven on live cold traffic. Details in TODO's known-issues list and CLAUDE.md.
- **Operator lead notifications are LIVE**, reusing the operator bot rather than a new one. The deferred multi-tenant question is written up in TODO — settle it at the Vercel deploy.
- **Whether a PR is open is deliberately not stated here** — run `gh pr list`. Merged branches are deleted on merge, so `git branch -a` corroborates it.
- **A third `/inspect` sweep ran on 2026-07-30** — the pre-deploy code pass this file recommended, and it was worth it: **8 findings, 1 critical.** Seven fixed in **PR #79**, one deferred with its options costed. Its state is deliberately not asserted here: `gh pr list --state all` and `git log origin/main..` are the answer, because a sentence about whether something is merged is false the moment it is. The critical finding is that the Terraform secret-injection guard against wiping a customer's `.env` had never worked. **No plugin, skill or live profile config changed, so nothing needed redeploying and the parity lines below still hold.** See the section at the end of this file.
- **A `/docs` pass then ran later on 2026-07-30 — against this file's own advice not to, and it found four things.** Two corrections to facts already on record (one of them a *previous correction that was itself half wrong*), one new known issue, two stale code comments. **None of the four came from re-reading prose**; three came from re-*running* checks, one from cross-referencing two files written a week apart. The advice has been rewritten rather than quietly dropped — see "What to do next". Nothing it changed requires a redeploy.
- **TWO engineering items are unblocked and both need your decision**, not more building: the `UNDER_CONTRACT` locator gap and a footer-length self-contradiction in two `SKILL.md` files. **They touch the same files and cost the same single deploy — settle them together.**

### Live systems

**Re-verified 2026-07-30** by listing processes, checking ports, calling a route, and re-running the parity recipes. PIDs are a dated observation — re-derive rather than trust them. Every PID below was still the same process on 07-30 as on 07-29, which is itself the useful signal: nothing restarted, so nothing reloaded.

| | State |
|---|---|
| `autoestate` gateway (operator) | **running, PID 31076** (was 1032; restarted late that night to load the timeout fix), `Gateway running with 2 platform(s)` — Telegram + WhatsApp both connected |
| `autoestate-buyer` gateway | **stopped**, deliberately — it is public whenever it runs. Both its channels are credentialled and paired |
| WhatsApp bridges | operator bridge **up on port 3000, PID 31116** — *unchanged across the late-night gateway restart*, which is the documented "reuse the bridge if it is healthy AND its `scriptHash` matches" branch actually firing rather than the kill-and-replace path. Zero `405`s since recovery. Port **3001** free (buyer gateway stopped) |
| `default` Hermes gateway | **running, PID 5020** (unrelated personal profile). It was down mid-evening and back up by the late session — it comes and goes, so treat any claim here as a dated observation and re-derive it |
| Reporting app, 127.0.0.1:4127 | **running, PID 12192** as of 2026-07-30 (it was 29720; deliberately stopped and restarted that day to run `next build`, which shares `.next/`). It has died and been restarted several times across these sessions — **do not assume it is up, check.** All four machine routes verified healthy after the restart (`401`/`401`/`405`/`405`). **It must be running before the gateway** — there is no sync spool, and see the login gotcha below, which makes the wrong order the default |
| Anthropic API key | **live with credit** — proven by four real completed turns across both channels, which beats a probe. All three profiles share this one key |
| Telegram bots | operator `@Auto_Estate_Operator_bot` (id 8902059217), buyer `@Auto_Estate_Buyer_bot` (id 8838769580). **Both `/start`ed from the owner's account this evening**, so home-channel pushes now work |
| WhatsApp numbers | operator **+972 55-988-5104** ("Auto-Estate-Bot"), buyer **+972 55-519-4380** ("Autoestate"). Read from each profile's `creds.json` |
| Repo↔live plugin parity | **0 drift, 10/10 files** across all five plugins (`__init__.py` + `plugin.yaml` each), re-measured 2026-07-30. Live `TIMEOUT_SECONDS = 10` confirmed in both context plugins. Re-run the recipe rather than trusting this — it has flipped twice in one day before |
| Repo↔live buyer `config.yaml` | **0 drift, 47 keys compared**, 3 `MACHINE-SPECIFIC` markers read from the file itself (2026-07-30) |
| Buyer `.env.example` ↔ live `.env` | **key names identical, 11 each** (2026-07-30). This is the check that closed the "instance refuses to boot" gate on 07-30; re-run it after any `.env` change, since reading either file alone cannot see an *absent* key |
| Skill / plugin versions | read off disk 2026-07-30, all matching the docs — skills `listing-to-social` 0.5.0, `listing-status-update` 0.5.0, `just-sold` 0.3.0, `listing-reengagement` 0.2.0, `weekly-digest` 0.1.0, `buyer-inquiry` 0.4.0; plugins `listing-footer-reminder` 1.5, `buyer-listings-context` 1.3, `active-listings-context` 1.1, both sync plugins 1.0 |
| Email platform | resolves `enabled: True` on **every** profile, including a bare one — and always has. **Uncredentialled**: `EMAIL_ADDRESS`/`EMAIL_PASSWORD`/hosts all absent, `allowed_users` `None`, so no adapter can start. Measured 2026-07-30. Not a finding, listed only because a previous doc pass wrongly recorded it as absent |

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

~~**There is now NO unblocked work left.**~~ **True on 2026-07-29, no longer true after the two 07-30 sweeps.** Everything that gates a *pilot* is still account-level — Hetzner + `terraform apply`, the Vercel deploy, the Cloudflare + R2 bucket — but there are now **two** unblocked engineering items, both needing your decision rather than more building, and **both editing the same two `SKILL.md` files**:

  1. **An `UNDER_CONTRACT` listing cannot be found by name** (`/inspect`, 07-30). Two options, costed in TODO's known issues: widen the machine route, or fix the wording only.
  2. **`just-sold` and `listing-status-update` say "the exact 7-line format" while their own format block shows eight lines** including `Features` (`/docs`, 07-30). Wording-only fix, four sites.

  **Do them in one change.** Each alone forces a copy + operator gateway restart; together that is one deploy instead of two. Recommended to fold both into item 12b's redeploy rather than firing a gateway restart for a wording fix.

**What NOT to do next, and why** — recorded so it isn't re-proposed:

- ~~**Do not run another `/docs` sweep.**~~ **Overruled by running one, 2026-07-30 — and the correction is more useful than the original advice.** The reasoning was sound: reading cannot catch a sentence that was true when written, and the 07-29 morning pass proved it by recording *"every satellite README"* read and still missing both satellite-doc claims corrected that evening. **But "don't read again" and "don't check again" are different instructions, and that bullet conflated them.** The 07-30 pass found four real defects and **not one came from reading prose** — three came from re-*running* things earlier passes had only read about (resolving platform config on a clean rig, the parity recipes, an `.env` key-name diff) and the fourth from holding two files written a week apart side by side. **Revised rule: a pass that re-runs the live checks earns its place; a pass that only re-reads the prose does not.** Judge the next one on which kind it is.
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

### What changed on 2026-07-30 (later) — the `/docs` reconciliation

Run against this file's own advice not to. **Four findings, none from reading.** No plugin, skill or live profile config changed, so **nothing needs redeploying**.

**① The 2026-07-28 email correction was itself half wrong.** It had recorded that the buyer profile "carries exactly `['telegram', 'whatsapp']` — no `email` platform", and guessed that an earlier three-platform observation "could not be reproduced… presumably the wrong profile was measured." Measured with `HERMES_HOME` set explicitly per profile: **every** profile resolves an enabled `email` platform, including a bare one with no platform config at all. The original observation reproduces exactly; it was never a mis-measurement. **The half that matters still stands** — no `EMAIL_*` variable resolves on either profile, so the Gmail credential genuinely is not on the buyer box; the platform is enabled and uncredentialled. Nothing to do; recorded because a false sentence sat in two documents and a deploy-gate list for two days.

**② The WhatsApp-enablement mechanism, open since 07-29, is closed — and closing it de-risks `terraform apply`.** A **top-level `platforms.<name>` block in `config.yaml` registers a platform by itself**, and an explicit `WHATSAPP_ENABLED=false` cannot override it; with no such block the env var *is* the lever. Both live profiles have that block, which is the entire explanation for the 07-29 measurement. `display.platforms.*` is a different key and enables nothing. **Consequence:** the Terraform template has only a `display.platforms` block, so a freshly provisioned box does **not** enable WhatsApp until the pairing wizard writes the var — a Telegram-only customer cannot trip the "starts enabled with no paired session ⇒ hard-fails startup" trap the template's own comment warns about. Verified by building a profile matching the template's rendered output and resolving it.

**③ New known issue — two skills contradict themselves about the footer's length.** See "What to do next"; bundle with the `UNDER_CONTRACT` item.

**④ Two stale in-repo code comments, both fixed.** `lib/inquiries.ts`'s header said disposition keys off the bot's *latest* reply, while `computeDisposition` sixty lines below says the opposite and explains that keying on the latest reply was the original bug. And `lib/ref-code.ts` pointed at `generateUniqueRefCode`, **a symbol that exists nowhere** — the real function is `allocateRefCode`, and it is not even in that file.

**Method note worth keeping.** Three subagents swept `reporting-app/` in parallel and **every flag was re-verified by hand before it reached a document.** That caught a false positive (a "28 vs 25" discrepancy that is arithmetically consistent) and surfaced one agent correctly reporting a claim it *could not* verify rather than guessing. **A delegated audit that says "could not find X" is working; one that says "X does not exist" is the failure mode this repo has already been burned by.**

### Open questions for the owner

**One genuinely open, asked 2026-07-30 and not yet answered:** whether anything changed outside what the repo and the live systems can be read for — an account created, a credential rotated, a decision taken, something someone told you. Everything checkable *was* checked this pass (see TODO's verification record); this covers only the part that cannot be. **If the answer is "nothing", say so and it gets recorded as asked-and-answered** — an unanswered question here is indistinguishable from an unasked one a week later.

Then two recorded rather than acted on, neither blocking:

- **The `405` cause is unexplained.** If it recurs, the diagnostic that was never completed is comparing a failing home-network attempt against a hotspot one *in the same window*; this evening both eventually worked, so the discriminator was lost.
- Cosmetic: the two Telegram bots' display names differ in casing. Changeable in BotFather without touching a token.

**Anthropic credit exhaustion remains a live failure mode** — auto-reload was reported enabled, yet the key was found dry on 2026-07-28. It is live with credit as of this evening, proven by four completed turns. All three profiles share **one** key, so one empty balance takes everything down.

### Shutting down for the day, and picking it back up

Asked and answered 2026-07-30, and written here rather than said once, because the answer is non-obvious in both directions.

**Nothing needs shutting down.** The only surface with a real safety argument is the **public buyer gateway, and it is already stopped** — and it has **no Startup-folder entry**, so it stays stopped across reboots without anyone remembering to check. Everything else is preference:

| Running | Leave or stop? |
|---|---|
| `autoestate` gateway + its WhatsApp bridge on **:3000** | Either. An idle gateway makes no LLM calls, so it costs nothing to leave. **Never kill port 3000** to free a port — it is the live bridge, and the adapter also kills whatever holds its own bridge port on start, so the collision goes both ways. |
| `default` gateway | Unrelated personal profile. |
| Reporting app **:4127** | Harmless either way. |

**Powering the machine off overnight does not risk the WhatsApp pairing.** The 14-day linked-device logout is driven by the **phone account** not opening WhatsApp, not by the bridge being down — so a PC shutdown is free, while a phone left untouched for two weeks is not.

**Stopping the gateway the night before does not help anything**, because login restarts it (see the gotcha below). The only thing that actually matters is the *first* action after logging back in:

> **Start `npm run dev -- -p 4127` BEFORE messaging the bot.** Login brings the gateway up and leaves the ingestion endpoint down. Nothing is lost while nobody messages it — but the first message sent before the app is up has its sync dropped permanently, with a flawless reply and a silently missing dashboard entry.

### Working conventions

- **Git:** `main` → feature branch → PR. Never commit to `main`. **Never merge without asking** — the owner asks explicitly each time.
- **If something is worth telling the owner, it is worth writing down.** Established 2026-07-30, by getting it wrong: the overnight-shutdown answer and the login-ordering trap above were both delivered as chat and would have evaporated with the session. Anything that matters for tomorrow, or in general, goes into these three files as part of the same turn — not into a reply.
- **No hooks exist in this repo.** Doc-sync is a convention: record real changes as part of finishing a task. Do not reintroduce automation.
- **Verify by running something.** CLAUDE.md §5 carries the exact recipes, now including *whether a platform is really enabled*, *which number a profile is paired to*, and *where its session actually lives*. Every one has caught something real.
- **Merging deploys nothing.** Plugins are physical copies inside each profile. A plugin PR is not finished until the parity recipe passes and the gateway has been restarted — by the **owner, from their own shell**. Restarting from an agent session has caused a full outage before.
- **Subagents: available on request, and every flag gets re-verified by hand.** Established 2026-07-30, when three swept `reporting-app/` in parallel. They are genuinely faster for mechanical breadth and they preserve the main session's context for the work that needs judgement — but they are **worst at this repo's dominant defect**, which is a claim that only looks wrong when two files written a week apart are held side by side, and no subagent holds both. Treat their output as leads, never as findings: on 07-30 that caught one false positive and one honest "could not verify". **A delegated audit that says "could not find X" is working; one that says "X does not exist" is the failure mode** — this repo has already had an automated audit confidently report three real files as missing.

### Environment gotchas

- **Start the reporting app BEFORE the gateway.** WhatsApp delivers queued messages within seconds of a bridge reconnecting (6s, measured this evening), and `sync-to-webapp` has no spool — a turn completed while the app is down is lost permanently, with a perfect-looking reply and a silently missing dashboard entry.
- **⚠ AND THE MACHINE VIOLATES THAT RULE FOR YOU ON EVERY LOGIN.** Verified 2026-07-30 by listing the Startup folder: `Hermes_Gateway.vbs` and `Hermes_Gateway_autoestate.vbs` both auto-start on login, and **the reporting app does not**. So after any reboot or logout the operator gateway is up and the ingestion endpoint is dead, which is exactly the ordering the rule above forbids — arrived at by default rather than by mistake. Nothing is lost while nobody messages the bot, so the practical rule is: **first thing after a login, start the app (`npm run dev -- -p 4127`) before sending the bot anything.** Stopping the gateway the night before does *not* help — it comes back on the next login regardless. (The **buyer** profile deliberately has no Startup entry, which is why the public bot stays stopped across reboots; keep it that way.)
- **`npm run dev -- -p 4127` — the flag is not optional.** The script is a bare `next dev`, so without it Next takes **3000**, which is the WhatsApp bridge's port. Both profiles hardcode the ingestion URL to 4127, so an app on any other port is up but unreachable.
- **Neither commenting out `WHATSAPP_*` nor `WHATSAPP_ENABLED=false` disables WhatsApp** on either live profile. **Why (settled 2026-07-30):** a top-level `platforms.<name>` block in `config.yaml` registers the platform by itself, and an explicit `false` cannot override it; both profiles have one. With no such block the env var *is* the lever. `display.platforms.*` is a different key and enables nothing. **To actually stop an adapter connecting, remove `creds.json` or the `platforms:` block — never the env var.**
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

> Read session-handoff-2026-07-30.md and continue.
>
> **Do this first, before anything else: start the reporting app.** `cd reporting-app && npm run dev -- -p 4127`. Both Hermes gateways auto-start from the Windows Startup folder and the app does **not**, so every login hands you the exact wrong order by default. WhatsApp delivers messages queued during an outage within ~6s of a bridge reconnecting, and there is no sync spool — so the first message sent to the bot before the app is up is lost permanently, with a flawless-looking reply and a silently missing dashboard entry. It cost a real turn on 07-29. **The `-- -p 4127` flag is not optional**: the script is a bare `next dev`, so without it Next takes port 3000, which is the live WhatsApp bridge's port, and every sync silently fails.
>
> **State:** everything on the roadmap is built, merged and live-tested. The WhatsApp outage of 07-29 is resolved, both channels live and re-verified end to end. Two sweeps ran on 07-30 (a third `/inspect`, then a `/docs`); **neither touched a plugin, skill or live profile config, so nothing needs redeploying** — but re-run CLAUDE.md §5's parity recipes rather than trusting that sentence. **Don't take any PR's merge state from this file** — `gh pr list --state all` and `git log origin/main..` are the only honest answers.
>
> **What's left splits in two.** Everything that gates a pilot is **account-level and yours**: Hetzner + `terraform apply` (TODO 3), the Vercel deploy (TODO 4 — land the partial unique index on `Listing` first), and the Cloudflare + R2 bucket (TODO 13, smallest and independent). **Don't start any of them without me** — they cost money and none of the accounts exist. Separately, **two engineering items are unblocked and need my decision, not more building**: an `UNDER_CONTRACT` listing can't be found by name, and two `SKILL.md` files say "the exact 7-line format" while their own format block shows eight lines. **Both edit the same two files — settle them in one change, ideally folded into item 12b's redeploy**, since either alone forces a gateway restart. Options and costs are in TODO's known issues.
>
> **One thing to carry into that first `terraform apply`:** the Terraform `.env` secret-injection guard had never worked until 07-30 (`remote-exec` joins `inline` with no errexit, so a failing sentinel couldn't stop the destructive `mv`, and the apply reported success anyway). The fix has never run against a real server. So read `/root/.hermes/.env` afterwards — and if the apply *fails* at that step, that is the new guard working, not a regression.
>
> **On sweeps:** don't run a fourth `/inspect` — the next belongs after Hetzner/Vercel, when real infrastructure exists to inspect against. On `/docs`, the rule was revised on 07-30 by overruling it: **a pass that re-runs the live checks earns its place; a pass that only re-reads the prose does not.** All four of that pass's findings came from running things, none from reading. The reasoning is in "What to do next" — overrule it deliberately if you disagree, don't re-derive it.
>
> **Three more things before touching anything.** **The buyer gateway is stopped and should stay stopped** unless you're testing — it is public whenever it runs, and its `bridge_port` must stay 3001. **Credit exhaustion is a live failure mode** — all three profiles share one Anthropic key, and auto-reload was reported on and still didn't prevent one. **If a dev server is already running from an older checkout, restart it** — the Prisma client loads at server start, so any schema change leaves it stale.
