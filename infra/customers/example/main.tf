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

variable "whatsapp_allowed_users" {
  type = string
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

module "hermes" {
  source = "../../modules/hermes-instance"

  customer_id                   = var.customer_id
  customer_email                = var.customer_email
  anthropic_api_key             = var.anthropic_api_key
  ingestion_api_url             = var.ingestion_api_url
  whatsapp_allowed_users        = var.whatsapp_allowed_users
  operator_ssh_key_name         = var.operator_ssh_key_name
  operator_ssh_private_key_path = var.operator_ssh_private_key_path
  operator_ssh_cidrs            = var.operator_ssh_cidrs
}

output "server_ipv4" {
  value = module.hermes.server_ipv4
}

output "ssh_connection_hint" {
  value = module.hermes.ssh_connection_hint
}

output "ingestion_secret" {
  value     = module.hermes.ingestion_secret
  sensitive = true
}
