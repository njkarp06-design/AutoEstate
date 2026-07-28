## Session Handoff — 2026-07-28

### What this project is

**AutoEstate** — marketing automation for independent real estate agents in Tel Aviv. An agent messages a WhatsApp bot with listing facts and gets back bilingual (Hebrew + English) content for Instagram, Facebook and Yad2. Prospective buyers message a *separate, public* bot — on **either WhatsApp or Telegram** — and get honest answers about a property 24/7, captured as leads. Both show up in a Next.js dashboard the agent logs into. Built on Hermes, one dedicated instance per customer.

Read [CLAUDE.md](CLAUDE.md) for the brief, architecture and engineering history; [TODO.md](TODO.md) for what's outstanding. Repo: https://github.com/njkarp06-design/AutoEstate (private).

### Where things stand

- **Every roadmap feature is built, live-tested and merged.** Most of what remains is productionization — the exception is the channel-consolidation decision below, which added new build work, two parts of it unblocked.
- **The buyer bot runs on both Telegram and WhatsApp**, paired and live-tested (2026-07-28). Facebook-sourced buyers reply on Telegram, Yad2/Instagram-sourced on WhatsApp — the owner's own market observation, which settled TODO's long-open transport decision. Its tool and slash-command lockdowns landed in the *same change* as the transport, as the deploy gate demanded.
- **The buyer bot answers amenity questions**, not just the seven structured fields. An optional `Features:` line on the Listing Record footer carries parking/elevator/balcony through to it. Verified live in both directions: it answers a listed feature and **defers** on an unlisted one rather than inferring absence.
- **Nothing is half-deployed.** Plugin parity is 5/5 and both gateways have been restarted onto the current code by the owner. Re-run CLAUDE.md §5's parity recipe rather than trusting this line — the next plugin change invalidates it.
- **Nothing is hosted.** The reporting app runs only via `npm run dev` (port 4127). The Terraform module is `validate`-clean but has **never been applied** — there is no Hetzner account.
- **A target channel architecture was decided (2026-07-28), not built.** Each customer currently costs **two** new phone numbers; the decision is **operator → Telegram, buyer → Cloud API**, giving **one number per customer**. Cloud API alone does *not* reduce the count — number count is roles × customers, and the roles are forced by Hermes's gating. A shared buyer number resolved by deep-link ref codes was **rejected as the destination** (an unbound buyer is a lost lead) but kept as an onboarding bridge and a cheap tier. TODO item 12 owns the checklist; CLAUDE.md owns the reasoning. **Nothing was implemented and nothing account-level was actioned.**
- **Whether a PR is open is deliberately not stated here** — it changes the moment anything merges, which is how this sentence has already gone stale once. Run `gh pr list`. Merged branches are deleted on merge, so `git branch -a` corroborates it.

### Live systems

Verified **2026-07-28** by listing processes, hashing files, calling the routes and resolving config through Hermes's own resolvers. PIDs are a dated observation — re-derive rather than trust them.

| | State |
|---|---|
| `default` Hermes gateway | running, PID 1976 (unrelated personal profile) |
| `autoestate` gateway (operator) | running **detached** (`pythonw`, PID 43308) via the `Hermes_Gateway_autoestate.vbs` startup item. Use `gateway start` (service), **not** `gateway run` (foreground) — `run` ties the live bot to a terminal window |
| `autoestate-buyer` gateway | **stopped**, deliberately. It is public whenever it runs, so it is started only for testing and Ctrl+C'd after. Both channels are credentialled: Telegram `@autoestate_buyer_bot` + a paired dedicated WhatsApp number |
| WhatsApp bridges | port **3000** = operator (PID 2996, unchanged since 07-24 — **never kill this**); port **3001** = buyer (PID 34008, survives its gateway stopping, which also keeps the linked device alive) |
| Reporting app, 127.0.0.1:4127 | running, PID 43848. All four machine routes return 401 — healthy, and proves the Prisma client is current with the `features` migration |
| Repo↔live plugin parity | 5/5 as of PR #59 (re-checked either side of the `buyer-listings-context` 1.2 copy), split by role — operator has `sync-to-webapp` / `listing-footer-reminder` / `active-listings-context`, buyer has `buyer-listings-context` / `sync-inquiries-to-webapp` |
| Repo↔live buyer `config.yaml` | no drift (parsed YAML, excluding the `MACHINE-SPECIFIC` keys) |
| Terraform template ↔ dev operator profile | 0 drift on product-decision keys (new recipe, CLAUDE.md §5) |
| Dev database | 1 customer; 23 runs; 4 listings (2 ACTIVE — Rothschild *with features*, Neve Tzedek; 2 SOLD — Ben Gurion, Dizengoff), **all 4 now carrying ref codes**; **4 inquiries** (2 Telegram, 2 WhatsApp), 2 with a captured contact |
| Reporting-app schema | migration `20260728193000_add_listing_ref_code_and_buyer_number` applied 2026-07-28; `prisma migrate status` clean, dev server restarted after |
| `lint` / `tsc` / `terraform fmt` / `validate` | all clean |

### What to do next

Two account-level steps remain the real gate for a pilot — both need the owner, both cost money — plus the unblocked halves of item 12 below, which need neither:

1. **Create a Hetzner account, then `terraform apply`** (TODO item 3). Three things there have **never run**: the operator SSH key must be uploaded to the project once beforehand (Hetzner rejects a duplicate public key, so the module looks it up); skills and plugins arrive via post-boot SSH upload rather than cloud-init, so confirm they landed; and operator slash-command access is ungated by default on that box — a deliberate accepted grant to settle with a real instance in front of you.
2. **Deploy the reporting app to Vercel Pro** (item 4). **Land the partial unique index on `Listing` first** — the current `Serializable` transaction removes the ingest dedupe race on that code path, but the durable guarantee needs `UNIQUE (customerId, lower(area), rooms, sqm) WHERE status <> 'SOLD'`, and the obvious plain `@@unique` is wrong because it would block a legitimate relist of a sold property.

**Then, before any real customer:**

3. **Harden the public buyer instance** (items 5–6): OS-level isolation, and re-running `hermes security audit` once anything is exposed. Also resolve the **global `.env`** that puts the owner's Gmail credential on that box (known issue in TODO).
4. **Add `WHATSAPP_ALLOW_ALL_USERS=true`** to any buyer instance Terraform provisions — with `dm_policy: open` Hermes refuses to boot without it. It blocked the dev instance and will block the first real one identically.
5. **Have a genuine third party message the buyer's WhatsApp number.** The path ran end to end, but from the owner's own number; the allowlist is `*` so no sender is privileged, and a real stranger did test Telegram — WhatsApp is the one untested combination. Cheap to close.

**Non-blocking:** create the Telegram notifier bot and set `OPERATOR_TELEGRAM_BOT_TOKEN` so operator lead alerts push. The dashboard records leads either way.

**Channel consolidation (TODO item 12), decided 2026-07-28.** Two halves of it need nothing from Hetzner or Meta and are the obvious next build:

- **12a — operator channel to Telegram. DECIDED and BUILT 2026-07-28: both channels, drop WhatsApp later.** The dev profile already ran Telegram on a **live** token (`@autoestate_test_bot`, verified via `getMe`); the real gap was that the **Terraform template shipped no Telegram at all**, so customers would have been WhatsApp-only. Now wired alongside WhatsApp — empty token means no adapter starts, and `variables.tf` names exactly what to delete when WhatsApp goes. Rendered in `terraform console`, `fmt`/`validate` clean, **never applied**. Left to do: rename the bot in BotFather (it is still the "Test Bot"), and live-test the outbound flow over Telegram — the DB has **0** Telegram runs, so that channel has never carried a real listing.
- **12d — per-listing ref codes. BUILT, MERGED (PR #59) and DEPLOYED 2026-07-28.** Migration applied to dev, the 4 existing listings backfilled, `buyer-inquiry` 0.4.0 and `buyer-listings-context` 1.2 live in the buyer profile (parity 5/5, gateway stopped so no restart needed). **One thing left, and it needs a person:** nobody has tapped a real ad link. Everything is verified through real routes against real data; none of it is verified by a live buyer.

12b (buyer → Cloud API) is blocked on Hetzner: it needs a public HTTPS webhook, which the module's no-inbound-but-SSH firewall forbids. When it happens, **close the `whatsapp_cloud` lockdown gate in the same change** — it is a distinct platform name, so neither `platform_toolsets` nor slash gating covers it today.

### Open questions for the owner

**None.** Both former ones closed on 2026-07-28: the buyer bot has a fresh token (verified live) and a paired WhatsApp number, and Anthropic auto-reload billing was **enabled** — owner-reported, with no API surface to verify from here. The only things still outside the repo's control are **Hetzner and Vercel**; neither account exists.

### Working conventions

- **Git:** `main` → feature branch → PR. Never commit to `main`. **Never merge without asking** — the owner asks explicitly each time.
- **No hooks exist in this repo.** Doc-sync is a convention: record real changes as part of finishing a task. Do not reintroduce automation.
- **Verify by running something.** CLAUDE.md §5 carries the exact recipes — a profile's real tool list, its visible skills, slash-command policy, repo↔live parity, Terraform-template↔dev-profile parity, what the model was actually sent on a turn, and whether a "revoked" credential is really dead. Every one has caught something real.
- **Merging deploys nothing.** Plugins are physical copies inside each profile. A plugin PR is not finished until the parity recipe passes and the gateway has been restarted — by the **owner, from their own shell**. Restarting from an agent session has caused a full outage before.

### Environment gotchas

- **`sender_id` *is* available to plugin hooks** (`pre_llm_call` and `post_llm_call` both — `agent/turn_context.py:740`). Docs said otherwise until 2026-07-28; two sites corrected. It does **not** let you gate by role — a plugin can only inject text, and text doesn't reliably stop the model acting. Sender identity still never reaches a *skill*, which is what forces role-by-channel isolation.
- **A skill edit never reaches a conversation already in progress.** A running session answers from the copy it loaded at session start — proven again 2026-07-28 (one `skill_view` call in a session's whole life). Use `/new` to pick a change up, or test with a fresh sender. New buyers get changes automatically; existing threads don't.
- **Never let the buyer gateway run with the default WhatsApp `bridge_port`.** The adapter defaults to 3000 and kills whatever holds that port on start — 3000 is the **live operator bridge**. The buyer config pins `3001`; do not "tidy" it. Pairing is unaffected (`--pair-only` starts no HTTP server).
- **`gateway run` is foreground, `gateway start` is the detached service.** Using `run` on the operator briefly made a production bot depend on a PowerShell window staying open.
- Use **`127.0.0.1`**, never `localhost` (IPv6 collision). A page-route 500 on 4127 is usually a transient Turbopack recompile; an API route returning 401 proves the agent-facing path is fine.
- **Never edit a profile's `config.yaml` while its gateway is running** — the gateway rewrites the file, strips comments, and clobbers concurrent edits. The commented copies under `agent/profiles/` are the source of truth; compare as parsed YAML, not text.
- Per-profile logs: `%LOCALAPPDATA%\hermes\profiles\<profile>\logs\gateway.log` — not the shared path (which has misled a session).
- **After ANY schema change, restart the `next dev` server on 4127.** The Prisma client loads at server *start*. Symptom: machine routes 500 where they used to 401 — and while it lasts, the live gateway's sync POSTs fail, so a real turn is lost.
- **Don't run `npm run build` while the dev server is up** — shared `.next/`. Use `lint` + `tsc`, but remember `next build` catches things neither does.
- **Anthropic auto-reload is now ON** (2026-07-28), which should end the recurring credit-exhaustion outages. If credit-balance errors ever reappear, that is still this rather than a code fault.

### How to resume

> Read session-handoff-2026-07-28.md and continue. Everything is built and merged; verify with `git log origin/main..` and `gh pr list --state all` rather than trusting any branch/PR claim here, and re-run CLAUDE.md §5's parity recipes rather than trusting the parity lines. What's left is productionization, starting with whichever account-level step I authorize — Hetzner + `terraform apply` (TODO item 3) or the Vercel deploy (item 4). **Don't start either without me:** both cost money and neither account exists. **A channel-consolidation target was decided on 2026-07-28 and not built** (TODO item 12: operator → Telegram, buyer → Cloud API, one number per customer instead of two) — 12a and 12d need no account and are the obvious next build; 12b is Hetzner-gated. Three things to know before planning. **The buyer bot is fully paired on both channels but its gateway is stopped** — it is public whenever it runs, so start it only to test and stop it after. **Its WhatsApp `bridge_port` must stay 3001**, because the adapter kills whatever holds its port on startup and its default is 3000, the live operator bridge. And **a skill edit does not reach a conversation already in progress** — use `/new` or a fresh sender. If a dev server is running from an older checkout, restart it: the Prisma client loads at start, so it will 500 on every machine route until you do.
