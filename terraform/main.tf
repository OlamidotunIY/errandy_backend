# ==============================================================================
# Terraform Configuration for DigitalOcean Kubernetes (DOKS)
# ==============================================================================
# This configuration creates:
# - DOKS cluster with configurable node pool
# - NGINX Ingress Controller via Helm
# - cert-manager via Helm
# - Let's Encrypt ClusterIssuer
# - DNS A record for api.errandy.com pointing to LoadBalancer IP
# ==============================================================================

terraform {
  required_version = ">= 1.0.0"

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.34"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.25"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.12"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.10"
    }
  }
}

# ==============================================================================
# Providers
# ==============================================================================

provider "digitalocean" {
  token = var.do_token
}

provider "kubernetes" {
  host                   = digitalocean_kubernetes_cluster.errandy.endpoint
  token                  = digitalocean_kubernetes_cluster.errandy.kube_config[0].token
  cluster_ca_certificate = base64decode(digitalocean_kubernetes_cluster.errandy.kube_config[0].cluster_ca_certificate)
}

provider "helm" {
  kubernetes {
    host                   = digitalocean_kubernetes_cluster.errandy.endpoint
    token                  = digitalocean_kubernetes_cluster.errandy.kube_config[0].token
    cluster_ca_certificate = base64decode(digitalocean_kubernetes_cluster.errandy.kube_config[0].cluster_ca_certificate)
  }
}

# ==============================================================================
# DigitalOcean Kubernetes Cluster
# ==============================================================================

resource "digitalocean_kubernetes_cluster" "errandy" {
  name    = var.cluster_name
  region  = var.region
  version = var.kubernetes_version

  node_pool {
    name       = "default-pool"
    size       = var.node_size
    node_count = var.node_count
    auto_scale = var.auto_scale
    min_nodes  = var.auto_scale ? var.min_nodes : null
    max_nodes  = var.auto_scale ? var.max_nodes : null
  }

  tags = ["errandy", "production"]
}

# ==============================================================================
# NGINX Ingress Controller
# ==============================================================================

resource "helm_release" "ingress_nginx" {
  name             = "ingress-nginx"
  repository       = "https://kubernetes.github.io/ingress-nginx"
  chart            = "ingress-nginx"
  namespace        = "ingress-nginx"
  create_namespace = true
  version          = "4.9.0"

  set {
    name  = "controller.service.type"
    value = "LoadBalancer"
  }

  set {
    name  = "controller.service.annotations.service\\.beta\\.kubernetes\\.io/do-loadbalancer-name"
    value = "errandy-ingress-lb"
  }

  set {
    name  = "controller.service.annotations.service\\.beta\\.kubernetes\\.io/do-loadbalancer-protocol"
    value = "http"
  }

  set {
    name  = "controller.service.annotations.service\\.beta\\.kubernetes\\.io/do-loadbalancer-tls-ports"
    value = "443"
  }

  set {
    name  = "controller.service.annotations.service\\.beta\\.kubernetes\\.io/do-loadbalancer-certificate-id"
    value = ""
  }

  depends_on = [digitalocean_kubernetes_cluster.errandy]
}

# Wait for LoadBalancer to get an external IP
resource "time_sleep" "wait_for_lb" {
  depends_on      = [helm_release.ingress_nginx]
  create_duration = "60s"
}

# Get the LoadBalancer IP
data "kubernetes_service" "ingress_nginx" {
  metadata {
    name      = "ingress-nginx-controller"
    namespace = "ingress-nginx"
  }

  depends_on = [time_sleep.wait_for_lb]
}

# ==============================================================================
# cert-manager
# ==============================================================================

resource "helm_release" "cert_manager" {
  name             = "cert-manager"
  repository       = "https://charts.jetstack.io"
  chart            = "cert-manager"
  namespace        = "cert-manager"
  create_namespace = true
  version          = "v1.14.3"

  set {
    name  = "installCRDs"
    value = "true"
  }

  depends_on = [digitalocean_kubernetes_cluster.errandy]
}

# Wait for cert-manager to be ready
resource "time_sleep" "wait_for_cert_manager" {
  depends_on      = [helm_release.cert_manager]
  create_duration = "30s"
}

# ==============================================================================
# Let's Encrypt ClusterIssuer
# ==============================================================================

resource "kubernetes_manifest" "letsencrypt_issuer" {
  manifest = {
    apiVersion = "cert-manager.io/v1"
    kind       = "ClusterIssuer"
    metadata = {
      name = "letsencrypt-prod"
    }
    spec = {
      acme = {
        server = "https://acme-v02.api.letsencrypt.org/directory"
        email  = var.letsencrypt_email
        privateKeySecretRef = {
          name = "letsencrypt-prod-account-key"
        }
        solvers = [
          {
            http01 = {
              ingress = {
                class = "nginx"
              }
            }
          }
        ]
      }
    }
  }

  depends_on = [time_sleep.wait_for_cert_manager]
}

# ==============================================================================
# DNS A Record for api.errandy.com
# ==============================================================================

# Get the domain
data "digitalocean_domain" "errandy" {
  name = var.domain_name
}

# Create/Update A record pointing to LoadBalancer IP
resource "digitalocean_record" "api" {
  domain = data.digitalocean_domain.errandy.id
  type   = "A"
  name   = var.api_subdomain
  value  = data.kubernetes_service.ingress_nginx.status[0].load_balancer[0].ingress[0].ip
  ttl    = 300

  depends_on = [data.kubernetes_service.ingress_nginx]
}

# ==============================================================================
# Container Registry Integration
# ==============================================================================

# Connect the cluster to the container registry
resource "digitalocean_container_registry_docker_credentials" "errandy" {
  registry_name = var.registry_name
}

resource "kubernetes_secret" "docr_registry" {
  metadata {
    name      = "docr-registry"
    namespace = "errandy"
  }

  type = "kubernetes.io/dockerconfigjson"

  data = {
    ".dockerconfigjson" = digitalocean_container_registry_docker_credentials.errandy.docker_credentials
  }

  depends_on = [kubernetes_namespace.errandy]
}

# Create the errandy namespace for the registry secret
resource "kubernetes_namespace" "errandy" {
  metadata {
    name = "errandy"
    labels = {
      name = "errandy"
    }
  }

  depends_on = [digitalocean_kubernetes_cluster.errandy]
}
