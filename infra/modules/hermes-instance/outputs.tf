output "server_ipv4" {
  description = "Public IPv4 address of the customer's instance."
  value       = hcloud_server.hermes.ipv4_address
}

output "server_id" {
  description = "Hetzner server ID."
  value       = hcloud_server.hermes.id
}

output "operator_ingestion_secret" {
  description = "The generated per-customer OPERATOR secret. Register it with provision-customer.ts (default --role operator), which stores its SHA-256 hash as Customer.operatorSecretHash - see the module README. This module provisions the operator role only; a buyer instance needs its own separate secret, scoped to /api/inquiries and /api/listings/buyer-view, which is minted at provisioning time rather than here (there is no buyer Terraform module yet - see TODO's instance_role item)."
  value       = random_password.ingestion_secret.result
  sensitive   = true
}

output "ssh_connection_hint" {
  description = "Command to SSH into the instance for the manual WhatsApp pairing step."
  value       = "ssh root@${hcloud_server.hermes.ipv4_address}"
}
