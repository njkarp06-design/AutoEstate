resource "random_password" "ingestion_secret" {
  length  = 48
  special = false
}

resource "hcloud_ssh_key" "operator" {
  name       = "${var.customer_id}-operator"
  public_key = var.operator_ssh_public_key
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
  ssh_keys     = [hcloud_ssh_key.operator.id]
  firewall_ids = [hcloud_firewall.hermes.id]

  user_data = templatefile("${path.module}/cloud-init.yaml.tftpl", {
    customer_id            = var.customer_id
    ingestion_api_url      = var.ingestion_api_url
    whatsapp_allowed_users = var.whatsapp_allowed_users
    hermes_model           = var.hermes_model
    hermes_image_tag       = var.hermes_image_tag
    skill_content          = file("${path.module}/../../../agent/skills/real-estate/listing-to-social/SKILL.md")
    plugin_yaml_content    = file("${path.module}/../../../agent/plugins/sync-to-webapp/plugin.yaml")
    plugin_init_content    = file("${path.module}/../../../agent/plugins/sync-to-webapp/__init__.py")
  })

  labels = {
    customer = var.customer_id
    project  = "autoestate"
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
resource "null_resource" "inject_secrets" {
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
      "grep -v -e '^AUTOESTATE_INGESTION_SECRET=' -e '^ANTHROPIC_API_KEY=' /root/.hermes/.env > /root/.hermes/.env.tmp",
      "echo 'AUTOESTATE_INGESTION_SECRET=${random_password.ingestion_secret.result}' >> /root/.hermes/.env.tmp",
      "echo 'ANTHROPIC_API_KEY=${var.anthropic_api_key}' >> /root/.hermes/.env.tmp",
      "grep -q '^AUTOESTATE_CUSTOMER_ID=' /root/.hermes/.env.tmp",
      "mv /root/.hermes/.env.tmp /root/.hermes/.env",
      "docker compose -f /root/docker-compose.yml restart gateway",
    ]
  }
}
