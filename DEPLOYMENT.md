# Kubernetes Deployment Guide for Errandy Backend

This guide explains how to deploy the errandy_backend to DigitalOcean Kubernetes (DOKS).

## Prerequisites

1. **DigitalOcean Account** with:
   - API token ([generate here](https://cloud.digitalocean.com/account/api/tokens))
   - Container Registry created named `errandy`
   - Domain `errandy.com` added to DigitalOcean DNS

2. **Local Tools**:

   ```bash
   # Install doctl (DigitalOcean CLI)
   brew install doctl  # or snap install doctl

   # Install Terraform
   brew install terraform  # or apt install terraform

   # Install kubectl
   brew install kubectl  # or apt install kubectl
   ```

3. **Authenticate doctl**:
   ```bash
   doctl auth init
   ```

---

## Quick Start

### 1. Build & Push Docker Image

```bash
# Login to DigitalOcean Container Registry
doctl registry login

# Build the image
docker build -t registry.digitalocean.com/errandy/errandy-backend:latest .

# Push to registry
docker push registry.digitalocean.com/errandy/errandy-backend:latest
```

### 2. Create Infrastructure with Terraform

```bash
cd terraform

# Copy and configure variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your DO token and email

# Initialize Terraform
terraform init

# Preview what will be created
terraform plan

# Create everything
terraform apply
```

This creates:

- ✅ DOKS cluster
- ✅ NGINX Ingress Controller
- ✅ cert-manager
- ✅ Let's Encrypt ClusterIssuer
- ✅ DNS A record for api.errandy.com
- ✅ Registry credentials in cluster

### 3. Configure kubectl

```bash
doctl kubernetes cluster kubeconfig save errandy-cluster
```

### 4. Generate & Apply Secrets

```bash
# Generate secret.yaml from .env
./scripts/generate-secret.sh

# Apply all manifests
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
```

### 5. Verify Deployment

```bash
# Check pods
kubectl get pods -n errandy

# Check ingress
kubectl get ingress -n errandy

# Check certificate
kubectl describe certificate errandy-api-tls -n errandy

# Check logs
kubectl logs -f deployment/errandy-backend -n errandy

# Test endpoint
curl https://api.errandy.com/health
```

---

## Destroy Infrastructure (When Idle)

To avoid ongoing costs, destroy everything when not in use:

```bash
cd terraform
terraform destroy
```

This removes:

- DOKS cluster and all nodes
- LoadBalancer
- DNS record (will be recreated on next apply)

---

## Redeploy After Destruction

```bash
# Recreate infrastructure
cd terraform
terraform apply

# Get kubeconfig
doctl kubernetes cluster kubeconfig save errandy-cluster

# Reapply manifests
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
```

---

## Updating the Application

### Deploy New Version

```bash
# Build and push new image
docker build -t registry.digitalocean.com/errandy/errandy-backend:v1.0.1 .
docker push registry.digitalocean.com/errandy/errandy-backend:v1.0.1

# Update deployment image
kubectl set image deployment/errandy-backend \
  errandy-backend=registry.digitalocean.com/errandy/errandy-backend:v1.0.1 \
  -n errandy

# Or edit deployment.yaml and apply
kubectl apply -f k8s/deployment.yaml
```

### Rollback

```bash
kubectl rollout undo deployment/errandy-backend -n errandy
```

---

## Troubleshooting

### Pod Not Starting

```bash
# Check pod status
kubectl describe pod -l app.kubernetes.io/name=errandy-backend -n errandy

# Check events
kubectl get events -n errandy --sort-by='.lastTimestamp'
```

### Certificate Not Issued

```bash
# Check certificate status
kubectl describe certificate errandy-api-tls -n errandy

# Check cert-manager logs
kubectl logs -n cert-manager deploy/cert-manager
```

### Image Pull Errors

```bash
# Verify registry secret exists
kubectl get secret docr-registry -n errandy

# Re-apply if needed
doctl kubernetes cluster kubeconfig save errandy-cluster
```

---

## Cost Estimates (DigitalOcean)

| Resource           | Specification        | Monthly Cost   |
| ------------------ | -------------------- | -------------- |
| DOKS Cluster       | Free (control plane) | $0             |
| Node (s-2vcpu-4gb) | 2 vCPU, 4GB RAM      | ~$24           |
| LoadBalancer       | Small                | ~$12           |
| Container Registry | Starter (500MB)      | $0             |
| **Total**          |                      | **~$36/month** |

**Cost Strategy**: `terraform destroy` when idle to avoid costs.

---

## File Structure

```
errandy_backend/
├── Dockerfile              # Multi-stage build
├── .dockerignore           # Build context exclusions
├── terraform/
│   ├── main.tf             # Infrastructure definition
│   ├── variables.tf        # Input variables
│   ├── outputs.tf          # Output values
│   └── terraform.tfvars.example
├── k8s/
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secret.template.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   └── ingress.yaml
└── scripts/
    └── generate-secret.sh  # Generate secret from .env
```
