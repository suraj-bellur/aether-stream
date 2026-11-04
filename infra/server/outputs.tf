output "server_ipv4" {
  description = "Public IPv4 address of the server."
  value       = hcloud_server.main.ipv4_address
}

output "ssh_command" {
  description = "Command to log in. Root login is disabled by cloud-init."
  value       = "ssh ${var.deploy_user}@${hcloud_server.main.ipv4_address}"
}

output "site_tunnel_command" {
  description = "Run this on your PC, then open http://localhost:8080 (the site is not public until M6)."
  value       = "ssh -L 8080:localhost:80 ${var.deploy_user}@${hcloud_server.main.ipv4_address}"
}
