output "server_ipv4" {
  description = "Public IPv4 address of the server."
  value       = hcloud_server.main.ipv4_address
}

output "ssh_command" {
  description = "Command to log in (root until cloud-init creates the deploy user in M2)."
  value       = "ssh root@${hcloud_server.main.ipv4_address}"
}
