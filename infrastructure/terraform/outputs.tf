output "k3s_vm_public_ip" {
  description = "Public IP of the K3s VM"
  value       = azurerm_public_ip.public_ip.ip_address
}

output "k3s_vm_private_ip" {
  description = "Private IP of the K3s VM"
  value       = azurerm_network_interface.nic.private_ip_address
}
