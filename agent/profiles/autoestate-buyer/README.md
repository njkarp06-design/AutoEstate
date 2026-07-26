# `autoestate-buyer` — the buyer-facing Hermes profile

This is the **public** instance. Strangers message it directly; it is the first
untrusted-input surface in AutoEstate. Everything here exists so that safety is
a property of the configuration, not of the model's good behaviour.

`config.yaml` and `SOUL.md` are the real, deployed files (copied verbatim from
the running dev profile). `.env.example` is the same `.env` with every secret
value stripped. They live in the repo so the lockdown is reviewable and
reproducible — a security posture that exists only on one laptop is not a
deliverable, and Terraform's future per-customer buyer instance ships from here.

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
cp agent/plugins/buyer-listings-context      "$PROFILE/plugins/"
cp agent/plugins/sync-inquiries-to-webapp    "$PROFILE/plugins/"
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

## Known production gates (not fixed here)

- **The ingestion secret is shared with the operator instance.** It currently
  also grants write access to `/api/ingest`. A public box should carry a scoped,
  read-limited second secret.
- **No OS-level isolation** (`terminal.backend: local`). The tool lockdown means
  there is no code-execution tool to abuse, but Hermes's own `SECURITY.md` is
  clear that OS isolation is the only real boundary. Containerize on the real
  deployment target.
- **The buyer channel transport is undecided** (2nd WhatsApp eSIM vs. official
  Cloud API vs. staying on Telegram). This profile is transport-agnostic; only
  `.env` changes.
