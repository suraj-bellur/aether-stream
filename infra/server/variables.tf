variable "name" {
  description = "Prefix for the names of everything created here."
  type        = string
  default     = "aether-stream"
}

variable "server_type" {
  description = "Hetzner server type. cpx22 = 2 vCPU, 4 GB RAM, 80 GB disk."
  type        = string
  default     = "cpx22"
}

variable "location" {
  description = "Hetzner location. Use the same one as the Storage Box (fsn1, nbg1 or hel1 for cpx22)."
  type        = string
  default     = "fsn1"
}

variable "image" {
  description = "Operating system image."
  type        = string
  default     = "ubuntu-24.04"
}

variable "ssh_public_key_path" {
  description = "Path to the public SSH key that is allowed to log in."
  type        = string
  default     = "~/.ssh/id_ed25519.pub"
}

variable "deploy_user" {
  description = "Login user created by cloud-init (root login is disabled)."
  type        = string
  default     = "deploy"
}

variable "repo_url" {
  description = "Git repository the server clones (public, so no key is needed)."
  type        = string
  default     = "https://github.com/suraj-bellur/aether-stream.git"
}

variable "repo_branch" {
  description = "Branch or tag to clone. Must contain the DOCKER_USER change in bootstrap.sh."
  type        = string
  default     = "feature/hetzner-iac"
}

variable "site_password" {
  description = <<-EOT
    Login password of the site (SITE_PASSWORD in .env). Chosen by you, read from
    .passwords\aether-stream-public-site-password by tf.cmd. Only the characters listed in the
    validation are allowed, so it is safe inside .env and the cloud-init file.
  EOT
  type        = string
  sensitive   = true

  validation {
    condition     = can(regex("^[A-Za-z0-9._@+=:,~-]+$", var.site_password))
    error_message = "site_password may only use letters, digits and . _ @ + = : , ~ - (no spaces, quotes, $ or #), and must not be empty."
  }
}

variable "enable_tunnel" {
  description = <<-EOT
    Start the Cloudflare tunnel on the server, so the public hostname is served from it (M6).
    On by default. Set it to false (-var="enable_tunnel=false") for an SSH-tunnel-only session.
    While it is on, never run the same tunnel anywhere else (the home VM).
  EOT
  type        = bool
  default     = true
}

variable "tunnel_token" {
  description = <<-EOT
    Cloudflare tunnel token of the public site. tf.cmd reads it from
    .passwords\aether-stream-cloudflare-public-tunnel-token. It is written into the server's
    .env only when enable_tunnel is true.
  EOT
  type        = string
  sensitive   = true
  default     = ""

  validation {
    condition     = var.tunnel_token == "" || can(regex("^[A-Za-z0-9+/=_-]+$", var.tunnel_token))
    error_message = "tunnel_token contains characters a Cloudflare token never has. Check the file for spaces or quotes."
  }
}

variable "enable_private" {
  description = <<-EOT
    Also run the private site (M7): it mounts the private sub-account at /media/private and
    starts backend-private and nginx-private (and cloudflared-private when enable_tunnel is on).
    On by default. Needs the two private files in .passwords\ (see tf.cmd). Set it to false
    (-var="enable_private=false") for a public-only session.
  EOT
  type        = bool
  default     = true
}

variable "private_site_password" {
  description = <<-EOT
    Login password of the private site (PRIVATE_SITE_PASSWORD in .env). Must differ from the
    public one. tf.cmd reads it from .passwords\aether-stream-private-site-password.
    Same allowed characters as site_password. Ignored while enable_private is false.
  EOT
  type        = string
  sensitive   = true
  default     = ""

  validation {
    condition     = var.private_site_password == "" || can(regex("^[A-Za-z0-9._@+=:,~-]+$", var.private_site_password))
    error_message = "private_site_password may only use letters, digits and . _ @ + = : , ~ - (no spaces, quotes, $ or #)."
  }
}

variable "private_tunnel_token" {
  description = <<-EOT
    Cloudflare tunnel token of the PRIVATE site (a different tunnel from the public one).
    tf.cmd reads it from .passwords\aether-stream-cloudflare-private-tunnel-token. Only used
    when enable_private and enable_tunnel are both true.
  EOT
  type        = string
  sensitive   = true
  default     = ""

  validation {
    condition     = var.private_tunnel_token == "" || can(regex("^[A-Za-z0-9+/=_-]+$", var.private_tunnel_token))
    error_message = "private_tunnel_token contains characters a Cloudflare token never has. Check the file for spaces or quotes."
  }
}
