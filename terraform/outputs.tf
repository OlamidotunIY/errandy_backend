# ==============================================================================
# Outputs
# ==============================================================================

output "cluster_id" {
  description = "ID of the Kubernetes cluster"
  value       = digitalocean_kubernetes_cluster.errandy.id
}

output "cluster_endpoint" {
  description = "Endpoint of the Kubernetes cluster"
  value       = digitalocean_kubernetes_cluster.errandy.endpoint
  sensitive   = true
}

output "cluster_name" {
  description = "Name of the Kubernetes cluster"
  value       = digitalocean_kubernetes_cluster.errandy.name
}

output "kubeconfig" {
  description = "Kubeconfig for the cluster (use: doctl kubernetes cluster kubeconfig save errandy-cluster)"
  value       = "Run: doctl kubernetes cluster kubeconfig save ${digitalocean_kubernetes_cluster.errandy.name}"
}

output "loadbalancer_ip" {
  description = "IP address of the NGINX Ingress LoadBalancer"
  value       = data.kubernetes_service.ingress_nginx.status[0].load_balancer[0].ingress[0].ip
}

output "api_url" {
  description = "URL of the API"
  value       = "https://${var.api_subdomain}.${var.domain_name}"
}

output "dns_record" {
  description = "DNS A record created"
  value       = "${var.api_subdomain}.${var.domain_name} -> ${data.kubernetes_service.ingress_nginx.status[0].load_balancer[0].ingress[0].ip}"
}

output "registry_secret" {
  description = "Name of the registry secret in the errandy namespace"
  value       = kubernetes_secret.docr_registry.metadata[0].name
}
