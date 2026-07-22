variable "hcloud_token" {
  description = "Hetzner Cloud API token (project-scoped, generated in the Hetzner console)."
  type        = string
  sensitive   = true
}

variable "customer_id" {
  description = "Short, unique slug for this customer (e.g. \"acme-realty\"). Used to name cloud resources - keep it DNS/hostname-safe."
  type        = string
}

variable "customer_email" {
  description = "The customer's email. Not used by Terraform directly - documents which Customer row (set up by the operator in the reporting webapp beforehand) this instance's ingestion secret belongs to."
  type        = string
}

variable "anthropic_api_key" {
  description = "Direct Anthropic API key for this customer's Hermes instance."
  type        = string
  sensitive   = true
}

variable "ingestion_api_url" {
  description = "The reporting webapp's ingestion endpoint (e.g. https://app.autoestate.example/api/ingest)."
  type        = string
}

variable "whatsapp_allowed_users" {
  description = "The customer's own WhatsApp number, international format, no + or spaces (e.g. 972501234567) - the only sender the bot will respond to."
  type        = string
}

variable "operator_ssh_public_key" {
  description = "Operator's SSH public key content, for provisioning access to the instance."
  type        = string
}

variable "operator_ssh_private_key_path" {
  description = "Path to the matching private key on the machine running Terraform - used only for the post-boot secret-injection step, never uploaded anywhere."
  type        = string
}

variable "operator_ssh_cidrs" {
  description = "CIDR ranges allowed to SSH into the instance (e.g. [\"1.2.3.4/32\"] for your own IP). Never leave this open to 0.0.0.0/0."
  type        = list(string)
}

variable "hetzner_server_type" {
  description = "Hetzner server type. Verify current options/pricing at console.hetzner.cloud before deploying - cx22 (2 vCPU, 4GB RAM) is a reasonable default; the real-estate skill doesn't use browser tools, so this has headroom (Hermes's own docs put 1GB as the bare minimum without browser automation)."
  type        = string
  default     = "cx22"
}

variable "hetzner_location" {
  description = "Hetzner datacenter location (e.g. \"nbg1\", \"fsn1\", \"hel1\", \"ash\"). Pick one close to the customer."
  type        = string
  default     = "nbg1"
}

variable "hetzner_image" {
  description = "Base OS image. Docker is installed via cloud-init, so a plain OS image works - no need for a pre-built Docker image."
  type        = string
  default     = "ubuntu-24.04"
}

variable "hermes_model" {
  description = "Model identifier written to config.yaml's model.default. Override per customer if needed."
  type        = string
  default     = "anthropic/claude-opus-4.6"
}

variable "hermes_image_tag" {
  description = "Tag for the nousresearch/hermes-agent Docker image. Defaults to \"latest\" (unpinned) - override to pin a specific version once one has been chosen and verified."
  type        = string
  default     = "latest"
}
