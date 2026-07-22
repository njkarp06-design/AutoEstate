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
    anthropic_api_key      = var.anthropic_api_key
    customer_id            = var.customer_id
    ingestion_api_url      = var.ingestion_api_url
    whatsapp_allowed_users = var.whatsapp_allowed_users
    skill_content          = file("${path.module}/../../../agent/skills/real-estate/listing-to-social/SKILL.md")
    plugin_yaml_content    = file("${path.module}/../../../agent/plugins/sync-to-webapp/plugin.yaml")
    plugin_init_content    = file("${path.module}/../../../agent/plugins/sync-to-webapp/__init__.py")
  })

  labels = {
    customer = var.customer_id
    project  = "autoestate"
  }
}

# Injects AUTOESTATE_INGESTION_SECRET after boot, separately from the main
# cloud-init payload, so the secret can be rotated (change the trigger,
# re-apply) without forcing hcloud_server to recreate the whole instance -
# changing user_data on an existing server forces a rebuild, which would
# lose the paired WhatsApp session.
resource "null_resource" "inject_secret" {
  triggers = {
    secret_hash = sha256(random_password.ingestion_secret.result)
    server_id   = hcloud_server.hermes.id
  }

  connection {
    type        = "ssh"
    host        = hcloud_server.hermes.ipv4_address
    user        = "root"
    private_key = file(var.operator_ssh_private_key_path)
  }

  provisioner "remote-exec" {
    inline = [
      "grep -v '^AUTOESTATE_INGESTION_SECRET=' /root/.hermes/.env > /root/.hermes/.env.tmp || true",
      "echo 'AUTOESTATE_INGESTION_SECRET=${random_password.ingestion_secret.result}' >> /root/.hermes/.env.tmp",
      "mv /root/.hermes/.env.tmp /root/.hermes/.env",
      "docker compose -f /root/docker-compose.yml restart gateway",
    ]
  }
}
