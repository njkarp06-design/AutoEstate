# hermes-instance module

Provisions one dedicated Hetzner Cloud server for **one role of** one AutoEstate
customer: Docker, the official `nousresearch/hermes-agent` image, that role's
skills and plugins - everything up to the point where WhatsApp pairing (a
manual, interactive step) is the only thing left.

## Two roles, two servers, `instance_role`

A fully-provisioned customer has **two** instances, and they cannot share one.
That is forced rather than preferred: the Hermes sender allowlist is a hard
adapter gate and sender identity never reaches a skill, so a buyer messaging the
operator's channel could trigger the outbound, `Listing`-mutating skills.

| | `instance_role = "operator"` (default) | `instance_role = "buyer"` |
|---|---|---|
| Who messages it | the customer only (allowlisted number/id) | **anyone** - it is public |
| Skills | 5, from `agent/skills/real-estate/` | **1**, from `agent/skills-buyer/real-estate/` |
| Plugins | `sync-to-webapp`, `listing-footer-reminder`, `active-listings-context` | `buyer-listings-context`, `sync-inquiries-to-webapp` |
| Tools the model gets | Hermes defaults | **3** (`skills_list`, `skill_view`, `skill_manage`) |
| Slash gating | off - see the config comment | **on, and required** |
| Secret role | `operator` | `buyer` |

The other role's plugins are deleted after upload: the whole `plugins/` directory
is uploaded in one go, and a public buyer box has no business carrying the
operator's `Listing`-mutating sync code.

**Buyer instances require `buyer_telegram_admin_ids` and
`buyer_whatsapp_admin_lids`, and the module refuses to plan without them.** An
empty admin list does not mean "no admins" - `gateway/slash_access.py` computes
`enabled = bool(admin_ids)`, so empty switches gating **off** and every allowed
caller (i.e. every stranger, since the buyer allowlist is `*`) holds admin tier
on ~68 commands including `/profile`. These are the **operator's own** ids.

**`skills.external_dirs` is deliberately absent from the generated buyer
config.** The dev profile pins an absolute Windows path, which on Linux resolves
to nothing and would leave the instance with **zero** skills - a public
receptionist with no receptionist, failing silently and totally. Hermes discovers
`/root/.hermes/skills` natively and only that role's tree is uploaded there.

**How they get there matters.** Skills and plugins are *not* embedded in
cloud-init `user_data` - Hetzner caps that at 32KB and the five operator skills
alone are ~63KB of Markdown. (Measured after this change: the rendered
`user_data` is ~9.5KB for the operator role and ~13KB for the buyer role, both
well inside the cap.) They are uploaded over SSH after boot.

`null_resource.deploy_agent_content` re-uploads whenever any of those files
change, then `null_resource.inject_secrets` restarts the gateway.

**Status: written and unapplied.** `terraform validate`/`fmt` only, per Phase
C's scope - no real server has been provisioned against this module yet, so
nothing here has been observed working end to end. See the
`resilient-waddling-lecun` plan file for the original design this was built
from (updated here: the plan's gateway-hook design is superseded by the
plugin-hook approach that Phase B actually shipped).

## Prerequisites

- A Hetzner Cloud account with a project API token (Security -> API Tokens,
  read+write). Creating a real server here starts real billing (~$5/month
  for the default `cx22` type) - nothing is charged by writing or planning
  this module, only by `apply`.
- Terraform >= 1.5.
- An SSH key pair for operator access, with the **public key already uploaded
  to the Hetzner project** (Security -> SSH Keys). The module looks it up by
  name (`operator_ssh_key_name`, default `autoestate-operator`) rather than
  creating it: Hetzner rejects the same public key twice within a project
  regardless of resource name, so creating one per customer would break every
  `apply` after the first. Upload once, reuse for every customer.
- The reporting webapp already deployed somewhere reachable from the
  internet (customer instances need to reach `ingestion_api_url`) - not
  done yet as of Phase C; the app has only run locally so far.
- No `Customer` row is needed up front - provisioning runs the other way
  round. `terraform apply` generates the ingestion secret, and
  `provision-customer.ts` (Step 3 below) then creates or updates the
  `Customer` row with that secret's hash. The customer's Clerk *login* can
  happen any time after that; it links to the row by the email the operator
  registered.

## Provisioning a new customer

### 1. Create their directory

```bash
cp -r infra/customers/example infra/customers/<customer-slug>
cd infra/customers/<customer-slug>
cp terraform.tfvars.example terraform.tfvars
# Fill in terraform.tfvars with real values - it's gitignored, never commit it.
```

### 2. Apply

```bash
terraform init
terraform plan   # review what will be created
terraform apply
```

### 3. Register the customer in the reporting webapp's database

```bash
# --role MUST match instance_role. Registering under the wrong role produces an
# instance that authenticates nowhere - 401 on every sync, which on a buyer box
# silently drops every lead. provision-customer.ts also rejects the same secret
# being registered for both roles, which would rebuild the shared credential
# the split removed.
terraform output -raw ingestion_secret | \
  npx tsx ../../../reporting-app/scripts/provision-customer.ts <customer-email> --role operator
```

For a **buyer** stack, everything is the same but `--role buyer`. The customer
must already exist, so register their operator credential first.

### 4. Pick the customer's agent-facing channel(s)

The agent-facing bot can run on **Telegram, WhatsApp, or both** (decided
2026-07-28, TODO 12a). They are independent - set either, neither or both.

**Telegram costs no phone number**, which is the whole point: it is the route
to one number per customer rather than two. Create a bot in BotFather, then set
`telegram_bot_token` and `telegram_allowed_users` (the customer's own numeric
Telegram user id). No pairing step, no SIM, nothing to keep alive - the token
is injected post-boot like the other secrets, so rotating it never rebuilds
the server. Leave `telegram_bot_token` empty and no Telegram adapter starts.

**WhatsApp costs an eSIM per customer** that must stay alive (a linked device
is logged out after 14 days of its primary account not opening WhatsApp) and
carries Baileys' unofficial-use ban risk. Step 5 below is its pairing dance.

Both are wired deliberately while it is still unknown whether Tel Aviv agents
will actually work in Telegram. If that answer turns out to be yes, dropping
the WhatsApp half is a small, contained edit - `variables.tf` says exactly
which pieces to remove.

### 5. Pair WhatsApp (manual - cloud-init can't automate this; skip for a Telegram-only customer)

Wait a minute or two after `apply` for cloud-init to finish (Docker
install, image pull, container start), then:

```bash
ssh root@$(terraform output -raw server_ipv4)
docker exec -it hermes hermes whatsapp
```

Choose "separate bot number", scan the QR from the customer's WhatsApp
Business app (Settings -> Linked Devices -> Link a Device), then restart
the gateway so the newly-written `WHATSAPP_ENABLED` setting actually takes
effect in the running process:

```bash
docker compose -f /root/docker-compose.yml restart gateway
```

### 6. Verify

Send a real listing to whichever channel(s) you configured - the customer's
WhatsApp Business number and/or their Telegram bot - and confirm it shows up
in the reporting webapp once they log in. Check the `Listing` row was created
too, not just the reply: a correct-looking caption with no tracked listing is
the exact failure PR #23 exists to prevent.

## Rotating the operator ingestion secret

Tainting `random_password.ingestion_secret` and re-applying regenerates the
**operator** secret and re-runs the injection step *without* rebuilding the server
(`user_data` itself is untouched, so `hcloud_server` isn't recreated):

```bash
terraform taint 'module.hermes.random_password.ingestion_secret'
terraform apply
terraform output -raw ingestion_secret | \
  npx tsx ../../../reporting-app/scripts/provision-customer.ts <customer-email> --role operator
```

## What's deliberately not automated

- **WhatsApp pairing** - `hermes whatsapp` requires a real interactive
  terminal (confirmed the hard way on the dev machine - it refuses to run
  through any piped/non-interactive process), so there's no way to script
  the QR scan itself.
- **DNS / a stable hostname per customer** - not needed yet; the instance
  is reached by IP for SSH only, and it never receives inbound traffic
  from the reporting webapp (only sends outbound to it).

## The buyer instance's secret is separate

Each stack generates **one** secret, for its own role. A buyer instance's
credential is scoped by the reporting app to `/api/inquiries` and
`/api/listings/buyer-view` — presenting it to `/api/ingest` returns 401. That is
deliberate: the buyer box is the one public surface, and a shared secret there
meant write access to the customer's `Listing` data.

Since 2026-07-31 the buyer secret is generated by this module too (run a second
stack with `instance_role = "buyer"`), so the hand-minting step below is no
longer needed. It is kept only for a buyer instance you are running **outside**
Terraform — e.g. the dev laptop profile:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
echo <that-secret> | npx tsx ../../../reporting-app/scripts/provision-customer.ts <customer-email> --role buyer
```

Then set the same value as `AUTOESTATE_INGESTION_SECRET` in the buyer profile's
`.env`. The customer must already exist — register the operator credential first.
