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
