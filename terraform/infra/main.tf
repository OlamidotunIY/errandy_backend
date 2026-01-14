# ==============================================================================
# Stage 1: Infrastructure - DOKS Cluster Only
# ==============================================================================
# This creates the Kubernetes cluster. Run this first, then configure kubectl
# before running the platform stage.
#
# Usage:
#   cd terraform/infra
#   terraform init
#   terraform apply
#   doctl kubernetes cluster kubeconfig save errandy-cluster
# ==============================================================================

terraform {
  required_version = ">= 1.0.0"

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.34"
    }
  }
}

# ==============================================================================
# Provider
# ==============================================================================

provider "digitalocean" {
  token = var.do_token
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

    labels = {
      app = "errandy"
    }
  }

  tags = ["errandy", "production"]
}

# ==============================================================================
# Assign Cluster to Project
# ==============================================================================

data "digitalocean_project" "errandy" {
  name = var.project_name
}

resource "digitalocean_project_resources" "cluster" {
  project = data.digitalocean_project.errandy.id
  resources = [
    digitalocean_kubernetes_cluster.errandy.urn
  ]
}
