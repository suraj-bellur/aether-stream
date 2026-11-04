output "box_host" {
  description = "Hostname of the Storage Box."
  value       = hcloud_storage_box.main.server
}

output "public_username" {
  value = hcloud_storage_box_subaccount.public.username
}

output "public_host" {
  value = hcloud_storage_box_subaccount.public.server
}

output "public_password" {
  value     = random_password.public.result
  sensitive = true
}

output "private_username" {
  value = hcloud_storage_box_subaccount.private.username
}

output "private_host" {
  value = hcloud_storage_box_subaccount.private.server
}

output "private_password" {
  value     = random_password.private.result
  sensitive = true
}
