# ==============================================================================
# Input Variables
# ==============================================================================

# DigitalOcean API Token
variable "do_token" {
  description = "DigitalOcean API token"
  type        = string
  sensitive   = true
}

# Cluster Configuration
variable "cluster_name" {
  description = "Name of the Kubernetes cluster"
  type        = string
  default     = "errandy-cluster"
}

variable "region" {
  description = "DigitalOcean region for the cluster"
  type        = string
  default     = "lon1" # London - closest to Nigeria
}

variable "kubernetes_version" {
  description = "Kubernetes version for the cluster"
  type        = string
  default     = "1.29.1-do.0"
}

# Node Pool Configuration
variable "node_size" {
  description = "Size of the worker nodes"
  type        = string
  default     = "s-2vcpu-4gb" # $24/month - good for testing
}

variable "node_count" {
  description = "Number of worker nodes"
  type        = number
  default     = 1
}

variable "auto_scale" {
  description = "Enable auto-scaling for the node pool"
  type        = bool
  default     = false
}

variable "min_nodes" {
  description = "Minimum number of nodes (if auto-scaling enabled)"
  type        = number
  default     = 1
}

variable "max_nodes" {
  description = "Maximum number of nodes (if auto-scaling enabled)"
  type        = number
  default     = 3
}

# Domain Configuration
variable "domain_name" {
  description = "The root domain name (must already exist in DigitalOcean)"
  type        = string
  default     = "errandy.com"
}

variable "api_subdomain" {
  description = "Subdomain for the API"
  type        = string
  default     = "api"
}

# Let's Encrypt Configuration
variable "letsencrypt_email" {
  description = "Email for Let's Encrypt certificate notifications"
  type        = string
}

# Container Registry
variable "registry_name" {
  description = "Name of the DigitalOcean Container Registry"
  type        = string
  default     = "errandy"
}
