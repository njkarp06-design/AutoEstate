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

## ⚠ Both lockdowns are per-platform, and both are Telegram-only

`platform_toolsets` and the slash-command gating are keyed by platform name.
They cover `telegram` (and `cli`). They do **not** cover WhatsApp.

This matters because the buyer-channel transport is undecided and currently
leans toward a second WhatsApp eSIM. Slash gating is switched on *by the
presence of an admin list* — so a `platforms.whatsapp` block with no
`allow_admin_from` puts every stranger back at admin tier on all ~68 commands,
`/profile` included, which is precisely the escape route to the operator's
outbound skills that this whole profile exists to prevent.

**Add the gating in the same change as the transport, never after.** No
`platforms.whatsapp` block is pre-added here, because WhatsApp must stay
*absent* from this profile rather than disabled (see `.env.example`) — an
inert-looking block would contend with the operator profile's paired device.

## Known production gates (not fixed here)

- ~~**The ingestion secret is shared with the operator instance.**~~ **Fixed
  2026-07-27.** This instance now holds its own credential, scoped by the
  reporting app to `/api/inquiries` and `/api/listings/buyer-view`; presenting
  it to `/api/ingest` returns 401, so extracting it from this public box no
  longer carries write access to the customer's `Listing` data. See
  `reporting-app/lib/ingest-auth.ts` and the `Customer` model comment.
- **No OS-level isolation** (`terminal.backend: local`). The tool lockdown means
  there is no code-execution tool to abuse, but Hermes's own `SECURITY.md` is
  clear that OS isolation is the only real boundary. Containerize on the real
  deployment target.
- **The buyer channel transport is undecided** (2nd WhatsApp eSIM vs. official
  Cloud API vs. staying on Telegram). This profile is transport-agnostic; only
  `.env` changes.
