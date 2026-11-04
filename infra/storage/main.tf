# Passwords are generated here, so nothing is typed or pasted by hand.
# Only characters that are safe in a CIFS credentials file and in YAML: letters, digits, - _ .
# They live in terraform.tfstate (git-ignored). Back that file up with the other secrets.
resource "random_password" "box" {
  length           = 32
  special          = true
  override_special = "-_."
  min_upper        = 2
  min_lower        = 2
  min_numeric      = 2
  min_special      = 2
}

resource "random_password" "public" {
  length           = 32
  special          = true
  override_special = "-_."
  min_upper        = 2
  min_lower        = 2
  min_numeric      = 2
  min_special      = 2
}

resource "random_password" "private" {
  length           = 32
  special          = true
  override_special = "-_."
  min_upper        = 2
  min_lower        = 2
  min_numeric      = 2
  min_special      = 2
}

# The box holds the media, so it is persistent and never part of the daily destroy.
resource "hcloud_storage_box" "main" {
  name             = var.name
  storage_box_type = var.storage_box_type
  location         = var.location
  password         = random_password.box.result

  access_settings = {
    samba_enabled        = true
    ssh_enabled          = true
    webdav_enabled       = false
    zfs_enabled          = false
    reachable_externally = var.external_access
  }

  delete_protection = true

  lifecycle {
    # To really delete the box, remove this block (and delete_protection) and apply first.
    prevent_destroy = true
  }
}

# Public library: the server mounts it read-only; you upload to it from home.
resource "hcloud_storage_box_subaccount" "public" {
  storage_box_id = hcloud_storage_box.main.id
  name           = "public"
  home_directory = "public/"
  password       = random_password.public.result
  description    = "public library"

  access_settings = {
    samba_enabled        = true
    ssh_enabled          = true
    webdav_enabled       = false
    readonly             = false
    reachable_externally = var.external_access
  }
}

# Private library: its own account and folder, so each site only sees its own media.
resource "hcloud_storage_box_subaccount" "private" {
  storage_box_id = hcloud_storage_box.main.id
  name           = "private"
  home_directory = "private/"
  password       = random_password.private.result
  description    = "private library"

  access_settings = {
    samba_enabled        = true
    ssh_enabled          = true
    webdav_enabled       = false
    readonly             = false
    reachable_externally = var.external_access
  }
}
