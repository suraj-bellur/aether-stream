terraform {
  required_version = ">= 1.6"

  required_providers {
    hcloud = {
      source = "hetznercloud/hcloud"
      # Pinned: the Storage Box resources are new and changed between 1.57 and 1.58.
      version = "~> 1.70.2"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7"
    }
  }
}

variable "hcloud_token" {
  type      = string
  sensitive = true
}

provider "hcloud" {
  token = var.hcloud_token
}
