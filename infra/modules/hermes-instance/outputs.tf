output "server_ipv4" {
  description = "Public IPv4 address of the customer's instance."
  value       = hcloud_server.hermes.ipv4_address
}

output "server_id" {
  description = "Hetzner server ID."
  value       = hcloud_server.hermes.id
}

output "ingestion_secret" {
  description = "The generated per-customer ingestion secret. Register its SHA-256 hash as Customer.ingestionSecretHash in the reporting webapp's database - see the module README for the exact command."
  value       = random_password.ingestion_secret.result
  sensitive   = true
}

output "ssh_connection_hint" {
  description = "Command to SSH into the instance for the manual WhatsApp pairing step."
  value       = "ssh root@${hcloud_server.hermes.ipv4_address}"
}
