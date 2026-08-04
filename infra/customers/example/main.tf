terraform {
  required_version = ">= 1.5"
  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.45"
    }
  }
}

provider "hcloud" {
  token = var.hcloud_token
}

variable "hcloud_token" {
  type      = string
  sensitive = true
}

variable "customer_id" {
  type = string
}

variable "customer_email" {
  type = string
}

variable "anthropic_api_key" {
  type      = string
  sensitive = true
}

variable "ingestion_api_url" {
  type = string
}

# Empty is legal for a TELEGRAM-ONLY customer (set the Telegram pair below
# instead) - the module refuses to plan an operator with NO channel at all.
variable "whatsapp_allowed_users" {
  type    = string
  default = ""
}

# The agent-facing channel can be Telegram, WhatsApp or both (TODO 12a).
# These MUST be declared here as well as in the module: this wrapper is what
# `terraform.tfvars` is read against, and Terraform treats a value for an
# undeclared root variable as a WARNING, not an error - so before these existed,
# setting telegram_bot_token per the module README's step 4 applied cleanly and
# silently provisioned a WhatsApp-only instance.
variable "telegram_bot_token" {
  type      = string
  sensitive = true
  default   = ""
}

variable "telegram_allowed_users" {
  type    = string
  default = ""
}

variable "operator_ssh_key_name" {
  type    = string
  default = "autoestate-operator"
}

variable "operator_ssh_private_key_path" {
  type    = string
  default = "~/.ssh/id_ed25519"
}

variable "operator_ssh_cidrs" {
  type = list(string)
}

# A fully-provisioned customer has TWO stacks - one operator, one buyer - each
# its own directory with its own state and its own generated secret. Copy this
# wrapper twice (e.g. infra/customers/acme-operator/ and acme-buyer/) and set
# instance_role accordingly; do NOT try to run both roles from one stack, since
# each is a distinct server with a distinct machine credential.
#
# EVERY VARIABLE THE MODULE OR ITS README MENTIONS MUST BE DECLARED HERE, not
# just in the module. This wrapper is what terraform.tfvars is read against, and
# Terraform treats a value for an undeclared root variable as a WARNING, not an
# error - so a missing declaration produces a clean green apply that silently
# discarded the value. That already happened once with the Telegram pair.
variable "instance_role" {
  type    = string
  default = "operator"
}

# BUYER ROLE ONLY, and REQUIRED there - the module refuses to plan without them.
# These are the OPERATOR's own ids (whoever runs the business), never a
# customer's and never a buyer's: an empty list switches slash-command gating
# OFF entirely, which on a public instance promotes every stranger to admin tier
# on ~68 commands including /profile.
variable "buyer_telegram_admin_ids" {
  type    = list(string)
  default = []
}

# WITH the @lid suffix, e.g. ["107186009169928@lid"]. The bare number does not
# work - the slash layer does no normalising.
variable "buyer_whatsapp_admin_lids" {
  type    = list(string)
  default = []
}

# The five per-customer tuning knobs the module documents as overridable.
# Declared here BECAUSE of the invariant above: before these existed, setting
# any of them in terraform.tfvars (e.g. pinning hermes_image_tag, or
# hetzner_location per the module's own "pick one close to the customer")
# produced a warning, a clean green apply, and a silently discarded value -
# the same regression class as the Telegram pair, five more times. Defaults
# mirror the module's.
variable "hetzner_server_type" {
  type    = string
  default = "cx22"
}

variable "hetzner_location" {
  type    = string
  default = "nbg1"
}

variable "hetzner_image" {
  type    = string
  default = "ubuntu-24.04"
}

variable "hermes_model" {
  type    = string
  default = "anthropic/claude-opus-4.6"
}

variable "hermes_image_tag" {
  type    = string
  default = "latest"
}

module "hermes" {
  source = "../../modules/hermes-instance"

  instance_role                 = var.instance_role
  customer_id                   = var.customer_id
  customer_email                = var.customer_email
  anthropic_api_key             = var.anthropic_api_key
  ingestion_api_url             = var.ingestion_api_url
  whatsapp_allowed_users        = var.whatsapp_allowed_users
  telegram_bot_token            = var.telegram_bot_token
  telegram_allowed_users        = var.telegram_allowed_users
  buyer_telegram_admin_ids      = var.buyer_telegram_admin_ids
  buyer_whatsapp_admin_lids     = var.buyer_whatsapp_admin_lids
  operator_ssh_key_name         = var.operator_ssh_key_name
  operator_ssh_private_key_path = var.operator_ssh_private_key_path
  operator_ssh_cidrs            = var.operator_ssh_cidrs
  hetzner_server_type           = var.hetzner_server_type
  hetzner_location              = var.hetzner_location
  hetzner_image                 = var.hetzner_image
  hermes_model                  = var.hermes_model
  hermes_image_tag              = var.hermes_image_tag
}

output "server_ipv4" {
  value = module.hermes.server_ipv4
}

output "ssh_connection_hint" {
  value = module.hermes.ssh_connection_hint
}

output "instance_role" {
  value = module.hermes.instance_role
}

# Register with `--role` matching instance_role. Registering under the wrong
# role produces an instance that authenticates nowhere: 401 on every sync,
# which on a buyer box silently drops every lead.
output "ingestion_secret" {
  value     = module.hermes.ingestion_secret
  sensitive = true
}
