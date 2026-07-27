# hermes-instance module

Provisions one dedicated Hetzner Cloud server for one AutoEstate customer:
Docker, the official `nousresearch/hermes-agent` image, all five operator
real-estate skills, and the three operator plugins - everything up to the
point where WhatsApp pairing (a manual, interactive step) is the only thing
left.

Shipped to the instance:

- **Skills** (`/root/.hermes/skills/real-estate/`) - `listing-to-social`,
  `listing-status-update`, `just-sold`, `listing-reengagement`,
  `weekly-digest`. Everything under `agent/skills/real-estate/` is uploaded,
  so a new skill directory needs no change here.
- **Plugins** (`/root/.hermes/plugins/`, and named in `config.yaml`'s
  `plugins.enabled`) - `sync-to-webapp`, `listing-footer-reminder`,
  `active-listings-context`. The buyer-instance plugins are removed after
  upload; this module provisions the **operator** role only.

**How they get there matters.** Skills and plugins are *not* embedded in
cloud-init `user_data` - Hetzner caps that at 32KB and the five skills alone
are ~63KB of Markdown. They are uploaded over SSH after boot by
`null_resource.deploy_agent_content`, which re-uploads whenever any of those
files change, then `null_resource.inject_secrets` restarts the gateway.

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
terraform output -raw operator_ingestion_secret | \
  npx tsx ../../../reporting-app/scripts/provision-customer.ts <customer-email>
```

### 4. Pair WhatsApp (manual - cloud-init can't automate this)

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

### 5. Verify

Send a real listing to the customer's WhatsApp Business number and confirm
it shows up in the reporting webapp once they log in.

## Rotating the operator ingestion secret

Tainting `random_password.ingestion_secret` and re-applying regenerates the
**operator** secret and re-runs the injection step *without* rebuilding the server
(`user_data` itself is untouched, so `hcloud_server` isn't recreated):

```bash
terraform taint 'module.hermes.random_password.ingestion_secret'
terraform apply
terraform output -raw operator_ingestion_secret | \
  npx tsx ../../../reporting-app/scripts/provision-customer.ts <customer-email>
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

This module provisions the **operator** role only. A customer's buyer instance
authenticates with its own credential, scoped by the reporting app to
`/api/inquiries` and `/api/listings/buyer-view` — presenting it to `/api/ingest`
returns 401. That is deliberate: the buyer box is the one public surface, and a
shared secret there meant write access to the customer's `Listing` data.

It is minted at provisioning time rather than generated here, because there is no
buyer Terraform module yet (`instance_role`, see TODO.md) and generating it in the
operator module would force a future buyer module to read the operator's state:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
echo <that-secret> | npx tsx ../../../reporting-app/scripts/provision-customer.ts <customer-email> --role buyer
```

Then set the same value as `AUTOESTATE_INGESTION_SECRET` in the buyer profile's
`.env`. The customer must already exist — register the operator credential first.
