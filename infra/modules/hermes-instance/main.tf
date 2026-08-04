locals {
  agent_root  = "${path.module}/../../../agent"
  is_buyer    = var.instance_role == "buyer"
  plugins_dir = "${local.agent_root}/plugins"

  # The skill directory split is the whole isolation mechanism, not a filing
  # convention: the buyer tree holds exactly ONE skill (buyer-inquiry) and the
  # operator tree holds the five outbound, Listing-mutating ones. A buyer
  # instance pointed at the operator tree would hand strangers the ability to
  # mark a customer's property SOLD. Verified on the dev profiles by resolving
  # what each one actually discovers: buyer 1 skill, operator 5, neither
  # sees the other's.
  skills_dir = local.is_buyer ? "${local.agent_root}/skills-buyer/real-estate" : "${local.agent_root}/skills/real-estate"

  # Plugins split by role. The whole plugins/ directory is uploaded in one go
  # and the OTHER role's are deleted remotely afterwards - simpler and more
  # self-maintaining than enumerating them in provisioners, which can't be
  # looped over with a dynamic block.
  operator_plugins = [
    "sync-to-webapp",
    "listing-footer-reminder",
    "active-listings-context",
  ]
  buyer_plugins = [
    "buyer-listings-context",
    "sync-inquiries-to-webapp",
  ]
  # Deleted remotely AND excluded from agent_content_hash below: they are never
  # enabled on this role, so letting them into the hash means editing the other
  # role's plugin forces a pointless re-upload and gateway restart here.
  foreign_plugins = local.is_buyer ? local.operator_plugins : local.buyer_plugins

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
    && !anytrue([for p in local.foreign_plugins : startswith(f, "${p}/")])
  ])
  # The buyer instance also ships a SOUL.md (its receptionist persona). Folded
  # into the hash so editing it actually redeploys, same as a SKILL.md.
  buyer_soul_path = "${local.agent_root}/profiles/autoestate-buyer/SOUL.md"
  # Filenames are folded into the hash alongside contents ("name:hash"), not
  # contents alone: hashing only contents made a same-content RENAME invisible
  # - the old filename lingered on the server, the new one never arrived, and
  # inject_secrets (which triggers on this same hash) never restarted the
  # gateway.
  agent_content_hash = sha256(join("", concat(
    [for f in local.skill_files : "${f}:${filesha256("${local.skills_dir}/${f}")}"],
    [for f in local.plugin_files : "${f}:${filesha256("${local.plugins_dir}/${f}")}"],
    local.is_buyer ? [filesha256(local.buyer_soul_path)] : [],
  )))

  # Every plugin directory must be claimed by exactly one role list above.
  # Without this check the split FAILS OPEN: a future plugin named in neither
  # list is uploaded to BOTH roles and deleted from neither - i.e. the next
  # plugin silently lands on the public buyer box. Enforced by a precondition
  # on hcloud_server below.
  all_plugin_dirs = distinct([
    for f in tolist(fileset(local.plugins_dir, "*/plugin.yaml")) : dirname(f)
  ])
  unassigned_plugins = setsubtract(
    local.all_plugin_dirs,
    concat(local.operator_plugins, local.buyer_plugins),
  )
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

# The role is part of BOTH resource names below, and it is load-bearing: a
# fully-provisioned customer is TWO stacks (operator + buyer) sharing one
# customer_id, and Hetzner enforces project-scoped uniqueness on server and
# firewall names - so without the role suffix the second stack's apply failed
# on a name collision, and the documented workaround (suffixing customer_id
# by hand) silently broke the AUTOESTATE_CUSTOMER_ID symmetry and the
# `customer` label correlation between a customer's two boxes.
resource "hcloud_firewall" "hermes" {
  name = "${var.customer_id}-${var.instance_role}-hermes"

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
  name         = "hermes-${var.customer_id}-${var.instance_role}"
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
    instance_role             = var.instance_role
    customer_id               = var.customer_id
    ingestion_api_url         = var.ingestion_api_url
    whatsapp_allowed_users    = var.whatsapp_allowed_users
    telegram_allowed_users    = var.telegram_allowed_users
    buyer_telegram_admin_ids  = var.buyer_telegram_admin_ids
    buyer_whatsapp_admin_lids = var.buyer_whatsapp_admin_lids
    hermes_model              = var.hermes_model
    hermes_image_tag          = var.hermes_image_tag
  })

  labels = {
    customer = var.customer_id
    project  = "autoestate"
    role     = var.instance_role
  }

  # Enforced here rather than in a `validation` block because this module is
  # pinned to Terraform >= 1.5 and cross-variable validation needs 1.9+.
  #
  # An empty admin list does not mean "no admins" - gateway/slash_access.py
  # computes `enabled = bool(admin_ids)`, so empty switches gating OFF and every
  # ALLOWED caller gets admin tier on ~68 commands. On a buyer box the allowlist
  # is `*`, so that is every stranger, holding /profile - which reaches the
  # operator profile's outbound Listing-mutating skills. Failing the plan is the
  # correct outcome: this is the one misconfiguration that silently produces a
  # working-looking public bot with no isolation at all.
  lifecycle {
    # user_data is consumed ONCE, at first boot - cloud-init never re-runs it
    # on an existing server, but Terraform treats any change to it as
    # force-new and would DESTROY the box (losing the paired WhatsApp
    # session) to deliver a value the replacement is the only thing that
    # could read anyway. ingestion_api_url is guaranteed to change at least
    # once (the vercel.app -> custom-domain cutover), so this trap sat
    # directly on the planned path. Config changes to a live box are
    # out-of-band (SSH, edit /root/.hermes/.env or config, restart the
    # gateway - see the README); a deliberate rebuild is
    # `terraform apply -replace=module.<name>.hcloud_server.hermes`.
    ignore_changes = [user_data]

    precondition {
      condition     = !local.is_buyer || length(var.buyer_telegram_admin_ids) > 0
      error_message = "instance_role = \"buyer\" requires a non-empty buyer_telegram_admin_ids. An empty list disables slash-command gating entirely, which promotes every stranger on a public instance to admin tier (including /profile)."
    }
    precondition {
      condition     = !local.is_buyer || length(var.buyer_whatsapp_admin_lids) > 0
      error_message = "instance_role = \"buyer\" requires a non-empty buyer_whatsapp_admin_lids (WITH the @lid suffix). An empty list disables slash-command gating entirely - see buyer_telegram_admin_ids."
    }
    # At least ONE agent-facing channel, not WhatsApp specifically: a
    # Telegram-only operator is a supported configuration (module README
    # step 4/5, and the channel-consolidation decision makes it the TARGET
    # one) - the previous `whatsapp_allowed_users != ""` condition refused
    # to plan exactly that.
    precondition {
      condition     = local.is_buyer || var.whatsapp_allowed_users != "" || (var.telegram_bot_token != "" && var.telegram_allowed_users != "")
      error_message = "instance_role = \"operator\" requires at least one agent-facing channel: whatsapp_allowed_users (the customer's own number), or BOTH telegram_bot_token and telegram_allowed_users for a Telegram-only customer. Only the buyer role runs open to everyone."
    }
    precondition {
      condition     = length(local.unassigned_plugins) == 0
      error_message = "Every directory under agent/plugins/ must be named in exactly one of operator_plugins or buyer_plugins (main.tf locals). Unassigned plugins would be uploaded to BOTH roles - including the public buyer instance - and deleted from neither."
    }
  }
}

# Uploads the real-estate skills and the operator plugins over SSH after boot.
#
# ORDER, precisely - an earlier version of this comment got it wrong. cloud-init
# has ALREADY started the container by the time this runs (`docker compose up -d`
# is the last runcmd), with /root/.hermes/skills and /root/.hermes/plugins not
# yet in existence. This resource then clears and rewrites both directories
# underneath the running gateway, and null_resource.inject_secrets restarts it
# afterwards - the restart is what actually makes the content live, not the
# upload. That is why inject_secrets triggers on agent_content_hash too: without
# it, a re-apply after editing a SKILL.md uploaded the new file to a gateway
# that never reloaded it, and the change silently did nothing.
#
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
  #
  # `set -e` FIRST, and it is load-bearing rather than boilerplate. Terraform's
  # remote-exec provisioner concatenates `inline` into ONE script joined by
  # newlines, with no shebang and no errexit (generateScripts, internal/builtin/
  # provisioners/remote-exec), and reports the script's exit status - i.e. the
  # LAST command's. So without this, a failed check does not stop the commands
  # after it and the whole provisioner still reports success. Every guard in
  # this file assumes otherwise.
  #
  # `|| true` on the wait is deliberate and is not the silent-failure pattern:
  # `cloud-init status --wait` blocks until cloud-init finishes either way, but
  # exits non-zero on a DEGRADED boot (a non-fatal module warning), which under
  # `set -e` would abort an otherwise-fine apply. Its job here is to wait, not to
  # assert - so the assertion is explicit instead.
  #
  # /root/docker-compose.yml is the sentinel because it is a write_files output
  # and nothing else on the box creates it, so its absence means write_files did
  # not run. That is the one state in which the `rm -rf` below must NOT proceed:
  # clearing /root/.hermes on a box that was never provisioned would destroy
  # whatever is there instead of refreshing shipped content.
  provisioner "remote-exec" {
    inline = [
      "set -e",
      "cloud-init status --wait || true",
      "test -f /root/docker-compose.yml",
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

  # Drop the OTHER role's plugins that came along with the directory upload
  # (not in plugins.enabled, so inert either way - but a public buyer box has
  # no business carrying the operator's Listing-mutating sync code, and vice
  # versa), and any local __pycache__ the file provisioner swept up, since it
  # cannot filter its source.
  provisioner "remote-exec" {
    inline = concat(
      ["set -e"], # see the first remote-exec above for why this is required
      [for p in local.foreign_plugins : "rm -rf /root/.hermes/plugins/${p}"],
      ["find /root/.hermes/plugins -type d -name __pycache__ -exec rm -rf {} +"],
    )
  }
}

# The buyer instance's receptionist persona. A separate count-gated resource
# rather than a conditional `provisioner` block inside the one above, because
# provisioners cannot be made conditional - and the alternative (pointing an
# unwanted upload at a throwaway destination) is the kind of cleverness that
# reads as a bug to the next person. The operator role deliberately runs
# Hermes's default persona and gets no SOUL.md at all.
resource "null_resource" "deploy_buyer_soul" {
  count      = local.is_buyer ? 1 : 0
  depends_on = [null_resource.deploy_agent_content]

  triggers = {
    server_id = hcloud_server.hermes.id
    soul_hash = filesha256(local.buyer_soul_path)
  }

  connection {
    type        = "ssh"
    host        = hcloud_server.hermes.ipv4_address
    user        = "root"
    private_key = file(var.operator_ssh_private_key_path)
  }

  provisioner "file" {
    source      = local.buyer_soul_path
    destination = "/root/.hermes/SOUL.md"
  }
}

# Injects AUTOESTATE_INGESTION_SECRET, ANTHROPIC_API_KEY and
# TELEGRAM_BOT_TOKEN after boot, separately from the main cloud-init payload,
# so any of them can be rotated (change the trigger, re-apply) without forcing
# hcloud_server to recreate the whole instance - changing user_data on an
# existing server forces a rebuild, which would lose the paired WhatsApp
# session. An empty TELEGRAM_BOT_TOKEN is written as an empty value and simply
# starts no Telegram adapter, which is the correct WhatsApp-only behaviour.
#
# `cloud-init status --wait` blocks until cloud-init's write_files stage has
# actually finished, so this never races the file into existence. The grep step
# fails loudly instead of silently producing an empty .env.tmp, and the sentinel
# check before `mv` confirms the rest of the file's content survived before the
# live .env is overwritten - a corrupted/empty .env would otherwise wipe
# ANTHROPIC_API_KEY and friends.
#
# BOTH OF THOSE GUARANTEES DEPEND ENTIRELY ON `set -e`, which is why it is the
# first inline command of each remote-exec block below. Terraform joins `inline`
# into ONE newline-separated script with no shebang and no errexit, and reports
# the LAST command's exit status - so before it was added, the sentinel `grep -q`
# failing did not stop the `mv` on the next line, and the provisioner still
# reported success because `docker compose restart` succeeded. Measured, not
# assumed: replaying this exact sequence under plain `sh` overwrote a live .env
# holding AUTOESTATE_CUSTOMER_ID with the three secrets alone and exited 0. The
# comment above described the intent; the shell did something else. Do not
# remove `set -e` as noise - it is the only thing making any of this true.
#
# The secret VALUES are written via a file provisioner (SCP) rather than
# interpolated into `inline` commands: an inline `echo 'SECRET' >> file` puts
# the value in the remote shell's argv, where it is visible in the process
# list and in TF_LOG output, and breaks outright if the value contains a
# single quote (anthropic_api_key is operator-supplied, so that is not
# hypothetical). The temp file is 0600 and removed in the same run.
resource "null_resource" "inject_secrets" {
  depends_on = [null_resource.deploy_agent_content, null_resource.deploy_buyer_soul]

  triggers = {
    secret_hash  = sha256(random_password.ingestion_secret.result)
    api_key_hash = sha256(var.anthropic_api_key)
    # Without this, swapping a customer's Telegram bot token would write the
    # new value into no plan at all - this resource owns the only path that
    # gets it onto the box, and triggers are the only thing that re-runs it.
    telegram_token_hash = sha256(var.telegram_bot_token)
    server_id           = hcloud_server.hermes.id
    # This resource owns the only `docker compose restart`, so it must re-run
    # whenever the uploaded content changes - `depends_on` alone only orders
    # the two, it does not re-trigger this one when deploy_agent_content
    # re-runs. Without this an edited SKILL.md or plugin was uploaded to a
    # gateway that never reloaded it: the apply succeeded, the file on disk
    # was correct, and the running agent kept executing the old code. That is
    # the same "merging deploys nothing" failure this project already has a
    # standing rule about, reproduced in Terraform.
    agent_content_hash = local.agent_content_hash
  }

  connection {
    type        = "ssh"
    host        = hcloud_server.hermes.ipv4_address
    user        = "root"
    private_key = file(var.operator_ssh_private_key_path)
  }

  provisioner "remote-exec" {
    inline = [
      "set -e",
      # Waits either way; `|| true` only tolerates a DEGRADED exit status. The
      # `test -f` is the real assertion. See deploy_agent_content's first
      # remote-exec for the full reasoning.
      "cloud-init status --wait || true",
      "test -f /root/.hermes/.env",
    ]
  }

  provisioner "file" {
    content     = <<-EOT
      AUTOESTATE_INGESTION_SECRET=${random_password.ingestion_secret.result}
      ANTHROPIC_API_KEY=${var.anthropic_api_key}
      TELEGRAM_BOT_TOKEN=${var.telegram_bot_token}
    EOT
    destination = "/root/.hermes/.env.secrets"
  }

  provisioner "remote-exec" {
    inline = [
      # Without this, the `grep -q` sentinel below cannot stop the `mv` that
      # follows it - see this resource's header comment.
      "set -e",
      "chmod 600 /root/.hermes/.env.secrets",
      "grep -v -e '^AUTOESTATE_INGESTION_SECRET=' -e '^ANTHROPIC_API_KEY=' -e '^TELEGRAM_BOT_TOKEN=' /root/.hermes/.env > /root/.hermes/.env.tmp",
      "cat /root/.hermes/.env.secrets >> /root/.hermes/.env.tmp",
      # AUTOESTATE_CUSTOMER_ID is read by NOTHING at runtime - it exists in
      # the generated .env (cloud-init.yaml.tftpl) PRECISELY to be this
      # sentinel: proof the original file's content survived the rewrite
      # above, before the destructive mv. Removing it from the template as
      # "unused" breaks secret injection on every instance. The two sites
      # cross-reference each other.
      "grep -q '^AUTOESTATE_CUSTOMER_ID=' /root/.hermes/.env.tmp",
      "mv /root/.hermes/.env.tmp /root/.hermes/.env",
      "chmod 600 /root/.hermes/.env",
      "rm -f /root/.hermes/.env.secrets",
      "docker compose -f /root/docker-compose.yml restart gateway",
    ]
  }
}
