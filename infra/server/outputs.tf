output "server_ipv4" {
  description = "Public IPv4 address of the server."
  value       = hcloud_server.main.ipv4_address
}

output "ssh_command" {
  description = "Command to log in. Root login is disabled by cloud-init."
  value       = "ssh ${var.deploy_user}@${hcloud_server.main.ipv4_address}"
}
