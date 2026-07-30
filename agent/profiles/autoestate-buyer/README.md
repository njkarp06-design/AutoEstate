# `autoestate-buyer` — the buyer-facing Hermes profile

This is the **public** instance. Strangers message it directly; it is the first
untrusted-input surface in AutoEstate. Everything here exists so that safety is
a property of the configuration, not of the model's good behaviour.

`config.yaml` and `SOUL.md` are the real, deployed files (copied verbatim from
the running dev profile). `.env.example` is the same `.env` with every secret
value stripped, and with the three `WHATSAPP_*` pairing vars commented out until
a number is actually paired. They live in the repo so the lockdown is reviewable
and reproducible — a security posture that exists only on one laptop is not a
deliverable, and Terraform's future per-customer buyer instance ships from here.

**That "same file, secrets stripped" claim is only true if you keep it true.**
`.env.example` was missing `WHATSAPP_ALLOW_ALL_USERS` entirely — not commented,
absent — while the live `.env` had it, and it is a *hard startup requirement* of
`config.yaml`'s `dm_policy: open`: without it the gateway refuses to boot at all.
So a buyer instance stood up from this template, exactly as the steps below say
to, would never have started, with the reason only in the log. Fixed; the lesson
is that a key-name diff of the live `.env` against this template is cheap and
catches what reading either one alone cannot.

## The machine-specific keys — change them on deploy

All are marked `MACHINE-SPECIFIC` in `config.yaml` and tracked as deploy gates
in TODO.md. They are left at their real dev values so this file stays a verbatim
copy of the deployed one (which is what makes the parity check in CLAUDE.md
work); all are excluded from that comparison rather than templated.

**Read the markers in `config.yaml` rather than trusting this list** — there is
one `allow_admin_from` pair per platform block, so every future channel adds two
more. As of 2026-07-28 there are three markers:

- **`skills.external_dirs`** is an absolute Windows path. On a Linux instance it
  resolves to nothing and the profile discovers **zero** skills — a public
  receptionist with no receptionist, failing silently and totally.
- **`platforms.telegram.extra.allow_admin_from`** (and the `group_` twin) is the
  dev operator's own Telegram user id. Shipped as-is to every customer, it would
  grant one personal account admin-tier slash-command access to every buyer bot.
- **`platforms.whatsapp.extra.allow_admin_from`** (and its `group_` twin) is the
  same thing for WhatsApp, and takes the operator's **LID** with the `@lid`
  suffix — the bare number does not grant admin. Added 2026-07-28 with the
  second buyer channel.

## Why a second instance exists at all

The Hermes sender allowlist is enforced **inside the vendored adapter, upstream
of every hook and skill**, and sender identity **never reaches a skill**.
So a skill cannot tell an operator from a stranger. Widening the operator bot's
allowlist to admit buyers would hand strangers the outbound skills that mutate
the `Listing` table (`just-sold`, `listing-status-update`, …). Role-by-channel
isolation is therefore forced, not preferred: **the dangerous skills are simply
not loaded here.**

Plugin *hooks* do receive `sender_id` (`pre_llm_call` and `post_llm_call` both;
`sync-inquiries-to-webapp` uses it). That does not weaken the above and must not
be mistaken for a way to gate by role: a plugin can only inject text, and text
does not reliably stop the model taking an action — proven three times in this
project. Isolation stays structural.

## The two isolation layers

**Skills.** `skills.external_dirs` points at `agent/skills-buyer/`, which
contains only `buyer-inquiry`. It deliberately does *not* point at
`agent/skills/` (the operator's five outbound skills). Verified: this profile
discovers 1 skill, the operator profile discovers 5, neither sees the other's.

**Tools.** Two mechanisms, and the second is load-bearing rather than
belt-and-braces:

1. `platform_toolsets.<platform>: [skills]` — an allowlist by direct membership
   (`hermes_cli/tools_config.py::_get_platform_tools`). **One entry per channel,
   currently `telegram` and `whatsapp`.** A platform with no entry of its own
   falls back to the platform default, which resolves to `[clarify, skills]`
   rather than `[skills]` — so adding a channel without adding its entry
   silently widens the tool surface.
2. `agent.disabled_toolsets` — a final, unconditional subtraction
   (`model_tools.py::_compute_tool_definitions`).

Layer 1 alone is **not** a complete allowlist. `_get_platform_tools` ends with a
"recover non-configurable platform toolsets" block that runs in *both* branches
and re-adds toolsets that are in the platform composite but absent from
`CONFIGURABLE_TOOLSETS`. `kanban` reached telegram that way despite an explicit
`[skills]` list, and only layer 2 removed it. **If you add a toolset to layer 1,
re-dump the resolved tool list rather than assuming.**

Net result, verified by resolving the real config: the model receives
**3 tools** — `skills_list`, `skill_view`, `skill_manage`. No terminal, no file
access, no code execution, no browser, no web, no delegation, no memory.

## `skill_manage`, and why it is still listed

The `skills` toolset is all-or-nothing and Hermes has no per-tool denylist, so
`skill_manage` cannot be dropped while keeping the `skill_view` this instance
needs. It is neutered instead: `skills.write_approval: true` makes every
create/edit/patch/delete **stage for review** rather than commit (it never
prompts inline), and nobody approves anything on a buyer instance. Without it, a
prompt-injected buyer could persistently rewrite the skill that answers every
later buyer — the one genuinely durable compromise this instance is exposed to.

`curator.enabled: false` for a related reason: the background curator archives
unused skills, and this profile has exactly one — an archive would silently take
the whole instance down with no operator watching.

`memory` is off (both the toolset and `memory.*`): on a public instance, durable
agent memory and the user profile are a poisoning vector across buyers.

`vision` is off: enabling it would have a public instance process
attacker-supplied image files, which is exactly what makes the deferred Pillow
CVEs reachable. Buyers get a text-only receptionist.

## Standing it up

```sh
hermes profile create autoestate-buyer --no-skills --no-alias
# then copy config.yaml + SOUL.md into the profile dir, and .env.example -> .env
# with real values filled in
cp -r agent/plugins/buyer-listings-context      "$PROFILE/plugins/"
cp -r agent/plugins/sync-inquiries-to-webapp    "$PROFILE/plugins/"
hermes -p autoestate-buyer gateway
```

`--no-skills` matters: it creates an empty profile *and* writes a
`.no-bundled-skills` marker so `hermes update` never re-seeds bundled skills
into it. Plugins, unlike skills, are **not** discovered via a config pointer —
they must be physically copied into the profile's `plugins/` directory and named
in `plugins.enabled`.

`TELEGRAM_ALLOWED_USERS` must be an explicit `*`. An empty value passes the
adapter's intake prefilter but then routes unknown DMs into a pairing flow that
a stranger would never complete.

**`WHATSAPP_ALLOW_ALL_USERS=true` is required for the gateway to start at all**,
and it is not the same thing as an allowlist of `*`. `config.yaml` sets
`whatsapp.extra.dm_policy: open`, and Hermes requires a second explicit opt-in on
top of the allowlist for any open policy
(`gateway/run.py::_own_policy_open_startup_violation`) — without it the process
aborts with *"Refusing to start: whatsapp has dm_policy/group_policy set to
'open' but neither GATEWAY_ALLOW_ALL_USERS nor WHATSAPP_ALLOW_ALL_USERS is
enabled."* It applies even before a WhatsApp number is paired, because WhatsApp
resolves `enabled: True` regardless of the commented-out `WHATSAPP_*` vars. Use
the **platform-scoped** variable, never `GATEWAY_ALLOW_ALL_USERS`, which would
open every platform at once.

## ⚠ Both lockdowns are per-platform — now Telegram **and** WhatsApp

`platform_toolsets` and the slash-command gating are keyed by platform name.
They cover `telegram`, `whatsapp` and `cli`.

Slash gating is switched on *by the presence of an admin list* — so any future
platform block with no `allow_admin_from` puts every stranger back at admin tier
on all ~68 commands, `/profile` included, which is precisely the escape route to
the operator's outbound skills that this whole profile exists to prevent.
**Add the gating in the same change as the transport, never after.**

**Still uncovered, deliberately: `whatsapp_cloud`.** The official Meta Cloud API
(which Hermes ships an adapter for) registers under that *distinct* platform
name, so neither lockdown applies to it. Its admin id cannot be known until a
real Cloud sender exists, and shipping untested gating would manufacture exactly
the false confidence this section exists to prevent. Tracked as a deploy gate in
`TODO.md`.

### Two channels, one instance

Buyers who found the property on **Yad2 or Instagram** reply on WhatsApp; buyers
who found it on **Facebook** reply on Telegram. One Hermes gateway serves both
simultaneously.

The former rule here — *WhatsApp must be absent from this profile, never merely
disabled, or it would contend with the operator profile's paired device* — was
retired on 2026-07-28, not forgotten. Its rationale is now satisfied
structurally: a **separate number**, a **separate session dir** (already
profile-scoped) and a **separate bridge port**. Nothing is left to contend over.

Two things about that port are worth knowing before touching this config:

- `bridge_port: 3001` is **load-bearing**. The adapter defaults to 3000 and, on
  gateway start, kills whatever holds that port to clear stale bridges — and on
  the dev laptop 3000 is the **live operator bridge**.
- **Pairing is safe regardless.** `hermes whatsapp` runs `bridge.js --pair-only`,
  which starts no HTTP server at all, so pairing can be done at any time without
  disturbing the operator bot.

### Pairing the WhatsApp channel

1. Get an SMS-capable number on a **dedicated** line — never the operator's,
   never a personal one. This bot is public, and a Baileys ban takes that
   number's WhatsApp with it.
2. Register it on the WhatsApp Business app. You do **not** log the operator bot
   out to do this; you need a free *slot* (a spare handset, or the multi-account
   support in WhatsApp/WhatsApp Business).
3. `hermes -p autoestate-buyer whatsapp` → choose **separate bot number** mode →
   scan the QR from Settings → Linked Devices. Scan **promptly**: the QR expires
   in roughly 20 seconds. A `stream:error code 515` followed by an automatic
   reconnect is normal WhatsApp Web restart behaviour, not a fault — wait for
   `✅ WhatsApp connected!`.
4. Uncomment the three `WHATSAPP_*` vars in `.env`.

**⚠ The wizard rewrites `.env`, and on a profile whose `WHATSAPP_*` values it
cannot see it re-runs *first-time setup* rather than the "keep what you have?"
path.** It then asks who may message the bot and writes the answer straight in.
`*` is the right answer **here** and the wrong one on the operator profile, and
the wizard asks identically either way — on 2026-07-29 that put
`WHATSAPP_ALLOWED_USERS=*` onto the operator instance, which loads all five
outbound `Listing`-mutating skills and has slash gating off. Caught before any
restart. **Back the `.env` up before re-pairing, and re-read it afterwards.**

**Do not rely on commenting `WHATSAPP_*` out to disable this channel.** Measured
2026-07-29 by resolving `load_gateway_config()` on both profiles: WhatsApp comes
out `enabled: True` with `WHATSAPP_ENABLED` absent, `=false`, **and** `=true`.
The vars ship commented here for tidiness and to avoid a half-configured channel,
not because commenting them out is a kill switch. To actually stop the adapter
connecting, remove the pairing (`creds.json`), not the environment variables.

**Keepalive:** a linked device is logged out if its primary phone account goes
**14 days** without opening WhatsApp. If that happens the bridge silently drops
and the buyer bot goes dark — an argument for leaving a spare device powered on.

## The third isolation layer: the credential

Skills and tools constrain what the *agent* can do. They say nothing about what
its *credential* is allowed to reach, and the two are orthogonal — which is why
a shared secret survived a security-focused build here.

This instance holds its **own** per-customer secret, not the operator's. The
reporting app scopes each one to its own routes, so this one is valid only on
`/api/inquiries` and `/api/listings/buyer-view` and returns **401 on
`/api/ingest`**. Extracting it from this public box therefore grants no write
access to the customer's `Listing` data. Never paste the operator instance's
secret into this profile's `.env` to save a provisioning step — see
`reporting-app/lib/ingest-auth.ts` and `.env.example`.

## The fourth isolation layer: outbound file delivery

Added 2026-07-29. It is a *fourth* layer because neither the skill lockdown, the
tool lockdown nor the credential scoping touches it, and it took a feature
question about listing photos to notice it was open.

**Outbound media is not a tool.** The model emits a path in its reply **text**;
the gateway strips it and delivers the file (`gateway/run.py` → `send_video` /
`send_multiple_images` / `send_document`). So this instance's 3-tool allowlist
constrains it not at all, and `agent.disabled_toolsets` has nothing to say about
it. A prompt-injected buyer who gets the model to emit one path gets that file —
delivered to themselves.

**There are TWO triggers, not one** (corrected 2026-07-31 — every doc here said
`MEDIA:` alone, which understates the surface):

- `extract_media` — an explicit `MEDIA:<abs path>` tag.
- `extract_local_files` — a **bare** absolute, `~/` or Windows drive-letter path
  merely *mentioned* in the reply, with a recognised extension and passing
  `os.path.isfile()`. Its own docstring states the intent: ship artifacts
  "without needing an explicit `MEDIA:` tag". Both run on every reply
  (`gateway/run.py`, the `extract_media` → `extract_images` → `extract_local_files`
  chain).

**The lockdown covers both**, which is why this was a documentation gap and not a
hole: `filter_media_delivery_paths` and `filter_local_delivery_paths`
(`gateway/platforms/base.py`) each call the same `validate_media_delivery_path`,
so the table below holds for either trigger. Verified by reading both call sites,
not assumed.

Hermes ships `gateway.strict: false` by default, which accepts **any** existing
file not on a credential denylist, and that denylist is scoped to the *active*
profile plus the shared root — so it does not cover a sibling profile. Measured
here by running `validate_media_delivery_path` with `HERMES_HOME` set to this
profile, not by reading it:

| path | default | now |
|---|---|---|
| `autoestate-buyer/.env`, `hermes/auth.json` | blocked | blocked |
| `autoestate-buyer/state.db` (every buyer's messages + captured phone numbers) | **delivered** | blocked |
| `autoestate/.env` (operator's API key, bot token, ingestion secret) | **delivered** | blocked |
| `autoestate/state.db` (operator's whole history) | **delivered** | blocked |
| `cache/images/<file>` (legitimate delivery) | delivered | delivered |

**`strict: true` alone does not close it — `trust_recent_files: false` is
load-bearing.** Strict mode keeps a recency fallback that delivers anything
modified within 600s (on by default). Its rationale is that injection targets
"have mtimes measured in days or months" — true of `/etc/passwd`, false of the
file that matters most here: this profile's `state.db` is rewritten on *every
turn*, so while the gateway runs it is permanently inside the window. With
strict alone, a freshly-touched `state.db` came back **delivered**.

Legitimate delivery is unaffected: the cache roots are honoured *before* the
denylist, so `cache/{images,audio,videos,documents}` stay deliverable — which is
where any future listing-media feature must write.

## Known production gates (not fixed here)

- **No OS-level isolation** (`terminal.backend: local`). The tool lockdown means
  there is no code-execution tool to abuse, but Hermes's own `SECURITY.md` is
  clear that OS isolation is the only real boundary. Containerize on the real
  deployment target.
- **`whatsapp_cloud` is still ungated** — see the section above. That is the one
  genuinely open transport question, and it is a deploy gate, not a preference.

The transport question itself is **settled** (2026-07-28): this profile runs
**both** Telegram and WhatsApp, because buyers reply on whichever platform the ad
reached them on. Baileys for the pilot, the official Cloud API once Hetzner
exists (TODO 12b). This paragraph previously read "the buyer channel transport is
undecided", which had been false for a day.
