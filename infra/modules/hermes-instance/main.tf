locals {
  agent_root  = "${path.module}/../../../agent"
  skills_dir  = "${local.agent_root}/skills/real-estate"
  plugins_dir = "${local.agent_root}/plugins"

  # Plugins that belong to the BUYER instance (agent/skills-buyer), not this
  # one. The whole plugins/ directory is uploaded in one go and these two are
  # deleted remotely afterwards - simpler and more self-maintaining than
  # enumerating the operator plugins in provisioners, which can't be looped
  # over with a dynamic block. When a buyer-role instance is added
  # (instance_role, see TODO.md), this becomes the conditional.
  buyer_only_plugins = [
    "buyer-listings-context",
    "sync-inquiries-to-webapp",
  ]

  # Re-upload whenever any shipped skill or plugin file changes, so an edited
  # SKILL.md actually reaches an already-provisioned server.
  #
  # __pycache__ is filtered out explicitly: fileset() walks the FILESYSTEM,
  # not git, so gitignored .pyc files are very much present here. Left in,
  # they would churn this hash every time the plugins are imported locally,
  # forcing pointless re-uploads. (The file provisioner can't filter, so the
  # uploaded copies are deleted remotely instead - see deploy_agent_content.)
  skill_files = sort([
    for f in tolist(fileset(local.skills_dir, "**")) : f
    if !strcontains(f, "__pycache__")
  ])
  plugin_files = sort([
    for f in tolist(fileset(local.plugins_dir, "**")) : f
    if !strcontains(f, "__pycache__")
  ])
  agent_content_hash = sha256(join("", concat(
    [for f in local.skill_files : filesha256("${local.skills_dir}/${f}")],
    [for f in local.plugin_files : filesha256("${local.plugins_dir}/${f}")],
  )))
}

resource "random_password" "ingestion_secret" {
  length  = 48
  special = false
}

# Looked up, not created. Hetzner enforces uniqueness on the KEY MATERIAL
# within a project, not on the resource name - so creating one
# hcloud_ssh_key per customer from the same operator public key succeeds for
# the first customer and then fails every subsequent `terraform apply`. Since
# the whole architecture is one instance per customer provisioned by one
# operator, that is the normal case, not an edge case. Upload the key once in
# the Hetzner console (Security -> SSH Keys) and reference it by name here.
data "hcloud_ssh_key" "operator" {
  name = var.operator_ssh_key_name
}

resource "hcloud_firewall" "hermes" {
  name = "${var.customer_id}-hermes"

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "22"
    source_ips = var.operator_ssh_cidrs
  }
  # No other inbound rules. The gateway never needs an inbound port - see
  # cloud-init.yaml.tftpl.
}

resource "hcloud_server" "hermes" {
  name         = "hermes-${var.customer_id}"
  server_type  = var.hetzner_server_type
  image        = var.hetzner_image
  location     = var.hetzner_location
  ssh_keys     = [data.hcloud_ssh_key.operator.id]
  firewall_ids = [hcloud_firewall.hermes.id]

  # Deliberately small: no skills and no plugins are embedded here. Hetzner
  # caps user_data at 32KB and the five operator skills alone are ~63KB of
  # Markdown before the plugins and before YAML block-scalar indentation
  # overhead, so embedding them cannot work and would fail at apply time
  # rather than at write time. They are uploaded post-boot instead - see
  # null_resource.deploy_agent_content below.
  user_data = templatefile("${path.module}/cloud-init.yaml.tftpl", {
    customer_id            = var.customer_id
    ingestion_api_url      = var.ingestion_api_url
    whatsapp_allowed_users = var.whatsapp_allowed_users
    hermes_model           = var.hermes_model
    hermes_image_tag       = var.hermes_image_tag
  })

  labels = {
    customer = var.customer_id
    project  = "autoestate"
  }
}

# Uploads the real-estate skills and the operator plugins over SSH after boot.
#
# This runs BEFORE null_resource.inject_secrets, which restarts the gateway -
# so the container comes up once, with skills and plugins already on disk.
# Hermes discovers skills under /root/.hermes/skills; plugins are NOT
# discovered by a config pointer and must be physically present in
# /root/.hermes/plugins AND named in config.yaml's plugins.enabled (both are
# handled - see cloud-init.yaml.tftpl).
resource "null_resource" "deploy_agent_content" {
  triggers = {
    server_id          = hcloud_server.hermes.id
    agent_content_hash = local.agent_content_hash
  }

  connection {
    type        = "ssh"
    host        = hcloud_server.hermes.ipv4_address
    user        = "root"
    private_key = file(var.operator_ssh_private_key_path)
  }

  # Wait for cloud-init's write_files stage before touching /root/.hermes, and
  # clear out anything previously shipped so a renamed or retired skill/plugin
  # doesn't linger on an already-provisioned server.
  provisioner "remote-exec" {
    inline = [
      "cloud-init status --wait",
      "rm -rf /root/.hermes/skills/real-estate /root/.hermes/plugins",
      "mkdir -p /root/.hermes/skills/real-estate /root/.hermes/plugins",
    ]
  }

  provisioner "file" {
    source      = "${local.skills_dir}/"
    destination = "/root/.hermes/skills/real-estate"
  }

  provisioner "file" {
    source      = "${local.plugins_dir}/"
    destination = "/root/.hermes/plugins"
  }

  # Drop the buyer-instance plugins that came along with the directory upload
  # (not in plugins.enabled, so inert either way - but an operator box has no
  # business carrying the public instance's code), and any local __pycache__
  # the file provisioner swept up, since it cannot filter its source.
  provisioner "remote-exec" {
    inline = concat(
      [for p in local.buyer_only_plugins : "rm -rf /root/.hermes/plugins/${p}"],
      ["find /root/.hermes/plugins -type d -name __pycache__ -exec rm -rf {} +"],
    )
  }
}

# Injects AUTOESTATE_INGESTION_SECRET and ANTHROPIC_API_KEY after boot,
# separately from the main cloud-init payload, so either can be rotated
# (change the trigger, re-apply) without forcing hcloud_server to recreate
# the whole instance - changing user_data on an existing server forces a
# rebuild, which would lose the paired WhatsApp session.
#
# `cloud-init status --wait` blocks until cloud-init's write_files stage has
# actually finished, so this never races the file into existence. The grep
# step (no longer `|| true`) fails loudly instead of silently producing an
# empty .env.tmp, and the sentinel check before `mv` confirms the rest of
# the file's content survived before the live .env is overwritten - a
# corrupted/empty .env would otherwise wipe ANTHROPIC_API_KEY and friends.
#
# The secret VALUES are written via a file provisioner (SCP) rather than
# interpolated into `inline` commands: an inline `echo 'SECRET' >> file` puts
# the value in the remote shell's argv, where it is visible in the process
# list and in TF_LOG output, and breaks outright if the value contains a
# single quote (anthropic_api_key is operator-supplied, so that is not
# hypothetical). The temp file is 0600 and removed in the same run.
resource "null_resource" "inject_secrets" {
  depends_on = [null_resource.deploy_agent_content]

  triggers = {
    secret_hash  = sha256(random_password.ingestion_secret.result)
    api_key_hash = sha256(var.anthropic_api_key)
    server_id    = hcloud_server.hermes.id
  }

  connection {
    type        = "ssh"
    host        = hcloud_server.hermes.ipv4_address
    user        = "root"
    private_key = file(var.operator_ssh_private_key_path)
  }

  provisioner "remote-exec" {
    inline = [
      "cloud-init status --wait",
      "test -f /root/.hermes/.env",
    ]
  }

  provisioner "file" {
    content     = <<-EOT
      AUTOESTATE_INGESTION_SECRET=${random_password.ingestion_secret.result}
      ANTHROPIC_API_KEY=${var.anthropic_api_key}
    EOT
    destination = "/root/.hermes/.env.secrets"
  }

  provisioner "remote-exec" {
    inline = [
      "chmod 600 /root/.hermes/.env.secrets",
      "grep -v -e '^AUTOESTATE_INGESTION_SECRET=' -e '^ANTHROPIC_API_KEY=' /root/.hermes/.env > /root/.hermes/.env.tmp",
      "cat /root/.hermes/.env.secrets >> /root/.hermes/.env.tmp",
      "grep -q '^AUTOESTATE_CUSTOMER_ID=' /root/.hermes/.env.tmp",
      "mv /root/.hermes/.env.tmp /root/.hermes/.env",
      "chmod 600 /root/.hermes/.env",
      "rm -f /root/.hermes/.env.secrets",
      "docker compose -f /root/docker-compose.yml restart gateway",
    ]
  }
}
