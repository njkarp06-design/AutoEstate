# `autoestate-buyer` — the buyer-facing Hermes profile

This is the **public** instance. Strangers message it directly; it is the first
untrusted-input surface in AutoEstate. Everything here exists so that safety is
a property of the configuration, not of the model's good behaviour.

`config.yaml` and `SOUL.md` are the real, deployed files (copied verbatim from
the running dev profile). `.env.example` is the same `.env` with every secret
value stripped. They live in the repo so the lockdown is reviewable and
reproducible — a security posture that exists only on one laptop is not a
deliverable, and Terraform's future per-customer buyer instance ships from here.

## Two keys that are machine-specific — change them on deploy

Both are marked `MACHINE-SPECIFIC` in `config.yaml` and tracked as deploy gates
in TODO.md. They are left at their real dev values so this file stays a verbatim
copy of the deployed one (which is what makes the parity check in CLAUDE.md
work); both are excluded from that comparison rather than templated.

- **`skills.external_dirs`** is an absolute Windows path. On a Linux instance it
  resolves to nothing and the profile discovers **zero** skills — a public
  receptionist with no receptionist, failing silently and totally.
- **`platforms.telegram.extra.allow_admin_from`** (and the `group_` twin) is the
  dev operator's own Telegram user id. Shipped as-is to every customer, it would
  grant one personal account admin-tier slash-command access to every buyer bot.

## Why a second instance exists at all

The Hermes sender allowlist is enforced **inside the vendored adapter, upstream
of every hook and skill**, and sender identity is not passed to plugin hooks.
So a skill cannot tell an operator from a stranger. Widening the operator bot's
allowlist to admit buyers would hand strangers the outbound skills that mutate
the `Listing` table (`just-sold`, `listing-status-update`, …). Role-by-channel
isolation is therefore forced, not preferred: **the dangerous skills are simply
not loaded here.**

## The two isolation layers

**Skills.** `skills.external_dirs` points at `agent/skills-buyer/`, which
contains only `buyer-inquiry`. It deliberately does *not* point at
`agent/skills/` (the operator's five outbound skills). Verified: this profile
discovers 1 skill, the operator profile discovers 5, neither sees the other's.

**Tools.** Two mechanisms, and the second is load-bearing rather than
belt-and-braces:

1. `platform_toolsets.telegram: [skills]` — an allowlist by direct membership
   (`hermes_cli/tools_config.py::_get_platform_tools`).
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
   scan the QR from Settings → Linked Devices.
4. Uncomment the three `WHATSAPP_*` vars in `.env`.

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

## Known production gates (not fixed here)

- **No OS-level isolation** (`terminal.backend: local`). The tool lockdown means
  there is no code-execution tool to abuse, but Hermes's own `SECURITY.md` is
  clear that OS isolation is the only real boundary. Containerize on the real
  deployment target.
- **The buyer channel transport is undecided** (2nd WhatsApp eSIM vs. official
  Cloud API vs. staying on Telegram). This profile is transport-agnostic; only
  `.env` changes.
