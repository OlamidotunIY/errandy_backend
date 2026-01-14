# ==============================================================================
# Stage 2: Variables
# ==============================================================================

variable "do_token" {
  description = "DigitalOcean API token (for registry credentials)"
  type        = string
  sensitive   = true
}

variable "letsencrypt_email" {
  description = "Email for Let's Encrypt certificate notifications"
  type        = string
}

variable "api_domain" {
  description = "Domain for the API"
  type        = string
  default     = "api.errandy.com.ng"
}

variable "registry_name" {
  description = "DigitalOcean Container Registry name"
  type        = string
  default     = "errandy"
}
