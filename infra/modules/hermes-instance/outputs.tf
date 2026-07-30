output "server_ipv4" {
  description = "Public IPv4 address of the customer's instance."
  value       = hcloud_server.hermes.ipv4_address
}

output "server_id" {
  description = "Hetzner server ID."
  value       = hcloud_server.hermes.id
}

output "instance_role" {
  description = "Which role this instance was provisioned as - \"operator\" or \"buyer\"."
  value       = var.instance_role
}

# ONE secret per instance, and the two roles' secrets must never be the same
# value. Register this one with:
#
#   terraform output -raw ingestion_secret | npx tsx .../provision-customer.ts \
#     customer@email.com --role <operator|buyer>
#
# and pass the role matching instance_role. The reporting app looks a secret up
# in that role's column ONLY (lib/ingest-auth.ts takes the role as a required
# parameter, with no fallback), so registering it under the wrong role produces
# an instance that authenticates nowhere - a 401 on every sync, which on a buyer
# box means every lead is silently dropped.
#
# provision-customer.ts already rejects registering the SAME secret for both
# roles, which would rebuild the single shared credential the split removed.
output "ingestion_secret" {
  description = "The generated per-customer machine secret for THIS instance's role. Register with provision-customer.ts using --role matching instance_role: operator hashes to Customer.operatorSecretHash and is valid on /api/ingest + /api/listings/active; buyer hashes to Customer.buyerSecretHash and is valid on /api/inquiries + /api/listings/buyer-view. A buyer instance holding the operator's secret would carry write access to the customer's real Listing data from the one public box in the product - which is exactly the exposure the credential split closed."
  value       = random_password.ingestion_secret.result
  sensitive   = true
}

# Kept so an existing operator stack's `terraform output operator_ingestion_secret`
# does not break. Deprecated in favour of the role-neutral name above.
output "operator_ingestion_secret" {
  description = "DEPRECATED alias for `ingestion_secret`, kept so existing operator stacks and any scripted `terraform output operator_ingestion_secret` keep working. Use `ingestion_secret` plus `instance_role` instead - this name is actively misleading on a buyer instance, where the value is the BUYER secret."
  value       = random_password.ingestion_secret.result
  sensitive   = true
}

output "ssh_connection_hint" {
  description = "Command to SSH into the instance for the manual WhatsApp pairing step."
  value       = "ssh root@${hcloud_server.hermes.ipv4_address}"
}
