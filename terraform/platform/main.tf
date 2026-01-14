# ==============================================================================
# Stage 2: Platform - Ingress, cert-manager, ClusterIssuer
# ==============================================================================
# Prerequisites:
#   1. Run Stage 1 (infra) first
#   2. Configure kubectl: doctl kubernetes cluster kubeconfig save errandy-cluster
#   3. Verify: kubectl get nodes
#
# Usage:
#   cd terraform/platform
#   terraform init
#   terraform apply
# ==============================================================================

terraform {
  required_version = ">= 1.0.0"

  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.25"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.12"
    }
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.34"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.10"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }
}

# ==============================================================================
# Providers - Use existing kubeconfig
# ==============================================================================

provider "kubernetes" {
  config_path = "~/.kube/config"
}

provider "helm" {
  kubernetes {
    config_path = "~/.kube/config"
  }
}

provider "digitalocean" {
  token = var.do_token
}

# ==============================================================================
# Namespace
# ==============================================================================

resource "kubernetes_namespace" "errandy" {
  metadata {
    name = "errandy"
    labels = {
      name = "errandy"
    }
  }
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
  timeout          = 600
  wait             = true
  atomic           = false

  set {
    name  = "controller.service.type"
    value = "LoadBalancer"
  }

  set {
    name  = "controller.service.annotations.service\\.beta\\.kubernetes\\.io/do-loadbalancer-name"
    value = "errandy-ingress-lb"
  }
}

# Wait for LoadBalancer to get an external IP
resource "time_sleep" "wait_for_lb" {
  depends_on      = [helm_release.ingress_nginx]
  create_duration = "90s"
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
  timeout          = 600
  wait             = true
  atomic           = false

  set {
    name  = "installCRDs"
    value = "true"
  }
}

# Wait for cert-manager to be ready
resource "time_sleep" "wait_for_cert_manager" {
  depends_on      = [helm_release.cert_manager]
  create_duration = "60s"
}

# ==============================================================================
# Let's Encrypt ClusterIssuer (applied via kubectl to avoid CRD validation issues)
# ==============================================================================

resource "null_resource" "letsencrypt_issuer" {
  depends_on = [time_sleep.wait_for_cert_manager]

  provisioner "local-exec" {
    command = <<-EOT
      cat <<EOF | kubectl apply -f -
      apiVersion: cert-manager.io/v1
      kind: ClusterIssuer
      metadata:
        name: letsencrypt-prod
      spec:
        acme:
          server: https://acme-v02.api.letsencrypt.org/directory
          email: ${var.letsencrypt_email}
          privateKeySecretRef:
            name: letsencrypt-prod-account-key
          solvers:
          - http01:
              ingress:
                class: nginx
      EOF
    EOT
  }

  provisioner "local-exec" {
    when    = destroy
    command = "kubectl delete clusterissuer letsencrypt-prod --ignore-not-found=true"
  }
}

# ==============================================================================
# Container Registry Credentials
# ==============================================================================

resource "digitalocean_container_registry_docker_credentials" "errandy" {
  registry_name = var.registry_name
}

resource "kubernetes_secret" "docr_registry" {
  metadata {
    name      = "docr-registry"
    namespace = kubernetes_namespace.errandy.metadata[0].name
  }

  type = "kubernetes.io/dockerconfigjson"

  data = {
    ".dockerconfigjson" = digitalocean_container_registry_docker_credentials.errandy.docker_credentials
  }
}

# ==============================================================================
# Ingress for api.errandy.com
# ==============================================================================

resource "kubernetes_ingress_v1" "api" {
  metadata {
    name      = "errandy-backend"
    namespace = kubernetes_namespace.errandy.metadata[0].name

    annotations = {
      "cert-manager.io/cluster-issuer"           = "letsencrypt-prod"
      "nginx.ingress.kubernetes.io/ssl-redirect" = "true"
      "nginx.ingress.kubernetes.io/proxy-body-size" = "50m"
    }
  }

  spec {
    ingress_class_name = "nginx"

    tls {
      hosts       = [var.api_domain]
      secret_name = "errandy-api-tls"
    }

    rule {
      host = var.api_domain

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = "errandy-backend"
              port {
                number = 80
              }
            }
          }
        }
      }
    }
  }

  depends_on = [null_resource.letsencrypt_issuer, time_sleep.wait_for_lb]
}
