# hermes-instance module

Provisions one dedicated Hetzner Cloud server for one AutoEstate customer:
Docker, the official `nousresearch/hermes-agent` image, the real-estate
skill, and the `sync-to-webapp` plugin - everything up to the point where
WhatsApp pairing (a manual, interactive step) is the only thing left.

**Status: written and unapplied.** `terraform plan` only, per Phase C's
scope - no real server has been provisioned against this module yet. See
the `resilient-waddling-lecun` plan file for the original design this was
built from (updated here: the plan's gateway-hook design is superseded by
the plugin-hook approach that Phase B actually shipped).

## Prerequisites

- A Hetzner Cloud account with a project API token (Security -> API Tokens,
  read+write). Creating a real server here starts real billing (~$5/month
  for the default `cx22` type) - nothing is charged by writing or planning
  this module, only by `apply`.
- Terraform >= 1.5.
- An SSH key pair for operator access.
- The reporting webapp already deployed somewhere reachable from the
  internet (customer instances need to reach `ingestion_api_url`) - not
  done yet as of Phase C; the app has only run locally so far.
- A `Customer` row for this customer already needs to exist... actually,
  provisioning order is the reverse: `terraform apply` generates the
  ingestion secret, then `provision-customer.ts` (see Step 3 below)
  registers it. The customer's Clerk *login* can happen any time after
  that - the operator sets their `email` up front either way.

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
terraform output -raw ingestion_secret | \
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

## Rotating the ingestion secret

Tainting `random_password.ingestion_secret` and re-applying regenerates the
secret and re-runs the injection step *without* rebuilding the server
(`user_data` itself is untouched, so `hcloud_server` isn't recreated):

```bash
terraform taint 'module.hermes.random_password.ingestion_secret'
terraform apply
terraform output -raw ingestion_secret | \
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
