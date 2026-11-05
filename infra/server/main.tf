# The persistent Storage Box stack (infra/storage) must be applied first.
# Its usernames, hostnames and generated passwords are read here, so nothing is copied by hand.
data "terraform_remote_state" "storage" {
  backend = "local"
  config = {
    path = "${path.module}/../storage/terraform.tfstate"
  }
}

locals {
  # Which compose services run, and which Storage Box folders must be mounted first.
  compose_services = join(" ", concat(
    ["backend", "frontend", "nginx"],
    var.enable_tunnel ? ["cloudflared"] : [],
    var.enable_private ? ["backend-private", "nginx-private"] : [],
    var.enable_private && var.enable_tunnel ? ["cloudflared-private"] : [],
  ))
  compose_profiles = var.enable_private ? "private" : ""
  media_mounts     = var.enable_private ? "/media/videos /media/private" : "/media/videos"

  # Secrets are only handed to the server when the feature that needs them is on.
  tunnel_token         = var.enable_tunnel ? var.tunnel_token : ""
  private_site_pw      = var.enable_private ? var.private_site_password : ""
  private_tunnel_token = var.enable_private && var.enable_tunnel ? var.private_tunnel_token : ""
}

resource "hcloud_ssh_key" "main" {
  name       = var.name
  public_key = file(pathexpand(var.ssh_public_key_path))
}

# Inbound: SSH only (TCP 22). Outbound is open, as in Phase 1.
resource "hcloud_firewall" "main" {
  name = var.name

  rule {
    description = "SSH access (TCP 22)"
    direction   = "in"
    protocol    = "tcp"
    port        = "22"
    source_ips  = ["0.0.0.0/0", "::/0"]
  }
}

resource "hcloud_server" "main" {
  name         = var.name
  server_type  = var.server_type
  image        = var.image
  location     = var.location
  ssh_keys     = [hcloud_ssh_key.main.id]
  firewall_ids = [hcloud_firewall.main.id]

  public_net {
    ipv4_enabled = true
    ipv6_enabled = true
  }

  user_data = templatefile("${path.module}/cloud-init.yaml.tftpl", {
    deploy_user    = var.deploy_user
    ssh_public_key = trimspace(file(pathexpand(var.ssh_public_key_path)))
    repo_url       = var.repo_url
    repo_branch    = var.repo_branch
    smb_host       = data.terraform_remote_state.storage.outputs.public_host
    smb_username   = data.terraform_remote_state.storage.outputs.public_username
    smb_password   = data.terraform_remote_state.storage.outputs.public_password
    site_password  = var.site_password

    tunnel_token     = local.tunnel_token
    compose_services = local.compose_services
    compose_profiles = local.compose_profiles
    media_mounts     = local.media_mounts

    enable_private       = var.enable_private
    private_site_pw      = local.private_site_pw
    private_tunnel_token = local.private_tunnel_token
    smb_private_host     = var.enable_private ? data.terraform_remote_state.storage.outputs.private_host : ""
    smb_private_username = var.enable_private ? data.terraform_remote_state.storage.outputs.private_username : ""
    smb_private_password = var.enable_private ? data.terraform_remote_state.storage.outputs.private_password : ""
  })

  labels = {
    project = var.name
  }

  lifecycle {
    precondition {
      condition     = !var.enable_tunnel || var.tunnel_token != ""
      error_message = "enable_tunnel is true but no tunnel token was found. Create .passwords\\aether-stream-cloudflare-public-tunnel-token."
    }
    precondition {
      condition     = !var.enable_private || var.private_site_password != ""
      error_message = "enable_private is true but no private site password was found. Create .passwords\\aether-stream-private-site-password."
    }
    precondition {
      condition     = !var.enable_private || var.private_site_password != var.site_password
      error_message = "The private site password must be different from the public one."
    }
    precondition {
      condition     = !(var.enable_private && var.enable_tunnel) || var.private_tunnel_token != ""
      error_message = "enable_private and enable_tunnel are both true but no private tunnel token was found. Create .passwords\\aether-stream-cloudflare-private-tunnel-token."
    }
  }
}

# Hetzner can hand a freed IP to a new server, which has a new SSH host key.
# Remove any old known_hosts entry for the new IP, so ssh doesn't refuse to
# connect with "REMOTE HOST IDENTIFICATION HAS CHANGED". Runs after each create.
# Note: this clears the Windows known_hosts only; WSL has its own file.
resource "terraform_data" "forget_old_host_key" {
  triggers_replace = [hcloud_server.main.ipv4_address]

  provisioner "local-exec" {
    command    = "ssh-keygen -R ${hcloud_server.main.ipv4_address}"
    on_failure = continue
  }
}
