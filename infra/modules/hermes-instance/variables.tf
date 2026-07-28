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

// --- Operator channel -------------------------------------------------------
// A customer's agent-facing bot runs on WhatsApp and/or Telegram. Both are
// wired here deliberately (decided 2026-07-28, TODO 12a): Telegram needs no
// phone number at all, so it is the route to one-number-per-customer, but
// WhatsApp stays available while it's still unknown whether Tel Aviv agents
// will actually work in Telegram.
//
// TO DROP WHATSAPP LATER, once that question is answered: remove
// whatsapp_allowed_users above, its two lines in cloud-init.yaml.tftpl's .env
// block, and the display.platforms.whatsapp block. Nothing else references it.
// Kept as an explicit note because "which parts are the WhatsApp half" is
// exactly the archaeology that makes a cheap deletion expensive later.

variable "telegram_bot_token" {
  description = "BotFather token for this customer's agent-facing Telegram bot. Empty disables Telegram entirely (no adapter starts), which is the correct value for a WhatsApp-only customer. Injected post-boot like the other secrets, so rotating it never rebuilds the server."
  type        = string
  sensitive   = true
  default     = ""
}

variable "telegram_allowed_users" {
  description = "The customer's own numeric Telegram user id - the only sender their agent-facing bot will respond to. Ignored when telegram_bot_token is empty."
  type        = string
  default     = ""
}

variable "operator_ssh_key_name" {
  description = "Name of the operator's SSH key as already uploaded to the Hetzner project (Security -> SSH Keys). Looked up, not created: Hetzner rejects a duplicate public key within a project regardless of the resource name, so creating one per customer from the same operator key breaks every apply after the first. Upload it once, reference it by name for every customer."
  type        = string
  default     = "autoestate-operator"
}

variable "operator_ssh_private_key_path" {
  description = "Path to the matching private key on the machine running Terraform - used only for the post-boot secret-injection step, never uploaded anywhere."
  type        = string
}

variable "operator_ssh_cidrs" {
  description = "CIDR ranges allowed to SSH into the instance (e.g. [\"1.2.3.4/32\"] for your own IP). Never leave this open to 0.0.0.0/0."
  type        = list(string)

  # Enforced, not just advised. This is the only inbound rule on the firewall,
  # so a world-open value is the difference between "SSH from the operator" and
  # "SSH from the internet" on a box holding the customer's paired WhatsApp
  # session and their ingestion secret.
  validation {
    condition     = !contains(var.operator_ssh_cidrs, "0.0.0.0/0") && !contains(var.operator_ssh_cidrs, "::/0")
    error_message = "operator_ssh_cidrs must not contain 0.0.0.0/0 or ::/0 - SSH is the only inbound rule on this instance. Use your own address, e.g. [\"1.2.3.4/32\"]."
  }
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
