terraform {
  required_version = ">= 1.6"

  required_providers {
    hcloud = {
      source = "hetznercloud/hcloud"
      # Pinned to one minor version: the Storage Box resources are new and
      # changed in a breaking way between 1.57 and 1.58.
      version = "~> 1.70.2"
    }
  }
}

# The API token comes from the environment, never from a file in this repo:
#   PowerShell: $env:TF_VAR_hcloud_token = "<token>"
variable "hcloud_token" {
  type      = string
  sensitive = true
}

provider "hcloud" {
  token = var.hcloud_token
}
