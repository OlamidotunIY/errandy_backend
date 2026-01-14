# ==============================================================================
# Stage 2: Outputs
# ==============================================================================

output "loadbalancer_ip" {
  description = "Ingress LoadBalancer IP - Add this to Cloudflare DNS as an A record for 'api'"
  value       = data.kubernetes_service.ingress_nginx.status[0].load_balancer[0].ingress[0].ip
}

output "cloudflare_dns_instructions" {
  description = "Instructions for Cloudflare DNS setup"
  value       = <<-EOT

    ============================================================
    CLOUDFLARE DNS CONFIGURATION REQUIRED
    ============================================================

    Create the following DNS record in Cloudflare:

      Type:  A
      Name:  api
      Value: ${data.kubernetes_service.ingress_nginx.status[0].load_balancer[0].ingress[0].ip}
      Proxy: DNS only (grey cloud) ← IMPORTANT for cert-manager

    After DNS propagates (~2-5 min), verify:
      curl https://${var.api_domain}/health

    ============================================================
  EOT
}

output "verification_commands" {
  description = "Commands to verify the deployment"
  value       = <<-EOT

    # Check ingress
    kubectl get ingress -n errandy

    # Check certificate status
    kubectl get certificate -n errandy
    kubectl describe certificate errandy-api-tls -n errandy

    # Check pods
    kubectl get pods -n errandy

    # Check certificate issuance logs
    kubectl logs -n cert-manager deploy/cert-manager

  EOT
}

output "registry_secret" {
  description = "Registry secret name created in errandy namespace"
  value       = kubernetes_secret.docr_registry.metadata[0].name
}
