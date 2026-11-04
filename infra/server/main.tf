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

  labels = {
    project = var.name
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
