# The persistent Storage Box stack (infra/storage) must be applied first.
# Its usernames, hostnames and generated passwords are read here, so nothing is copied by hand.
data "terraform_remote_state" "storage" {
  backend = "local"
  config = {
    path = "${path.module}/../storage/terraform.tfstate"
  }
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
    # The token is only handed to the server when the tunnel is switched on.
    tunnel_token     = var.enable_tunnel ? var.tunnel_token : ""
    compose_services = var.enable_tunnel ? "backend frontend nginx cloudflared" : "backend frontend nginx"
  })

  labels = {
    project = var.name
  }

  lifecycle {
    precondition {
      condition     = !var.enable_tunnel || var.tunnel_token != ""
      error_message = "enable_tunnel is true but no tunnel token was found. Create .passwords\\aether-stream-cloudflare-public-tunnel-token."
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
