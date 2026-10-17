variable "location" {
  description = "Azure Region (East US)"
  type        = string
  default     = "eastus"
}

variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
  default     = "errandy-k3s-rg"
}

variable "subscription_id" {
  description = "Azure subscription ID used for deployment"
  type        = string
}

variable "ssh_public_key" {
  description = "SSH Public Key string for accessing the VM"
  type        = string
}

variable "vm_size" {
  description = "Azure VM size for the K3s node"
  type        = string
  default     = "Standard_D2ads_v7"
}
