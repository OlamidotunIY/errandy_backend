# Kubernetes Deployment Guide for Errandy Backend

Deploy NestJS backend to DigitalOcean Kubernetes with **Cloudflare DNS**.

## Prerequisites

1. **DigitalOcean Account** with:
   - API token ([generate here](https://cloud.digitalocean.com/account/api/tokens))
   - Container Registry `errandy` created

2. **Cloudflare Account** with:
   - Domain `errandy.com` managed in Cloudflare

3. **Local Tools**:

   ```bash
   # Install doctl
   brew install doctl  # or snap install doctl

   # Install terraform
   brew install terraform

   # Install kubectl
   brew install kubectl

   # Authenticate
   doctl auth init
   doctl registry login
   ```

---

## Step-by-Step Deployment

### 1. Build & Push Docker Image

```bash
docker build -t registry.digitalocean.com/errandy/errandy-backend:latest .
docker push registry.digitalocean.com/errandy/errandy-backend:latest
```

### 2. Stage 1: Create DOKS Cluster

```bash
cd terraform/infra

# Configure variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your DO token

# Create cluster
terraform init
terraform apply
```

**Wait for completion, then configure kubectl:**

```bash
doctl kubernetes cluster kubeconfig save errandy-cluster
kubectl get nodes
```

### 3. Stage 2: Install Platform Components

```bash
cd ../platform

# Configure variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your DO token and email

# Install ingress, cert-manager, etc.
terraform init
terraform apply
```

**Copy the LoadBalancer IP from the output.**

### 4. Configure Cloudflare DNS

In Cloudflare Dashboard:

1. Go to **DNS** → **Records**
2. Add a new record:
   - **Type**: `A`
   - **Name**: `api`
   - **IPv4 address**: `<LoadBalancer IP from Step 3>`
   - **Proxy status**: **DNS only** (grey cloud) ← IMPORTANT!

> ⚠️ **Must be DNS only (grey cloud)** for cert-manager HTTP-01 validation to work!

### 5. Generate & Apply Kubernetes Secrets

```bash
cd ../../  # Back to errandy_backend root

# Generate secret from .env
./scripts/generate-secret.sh

# Apply manifests
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

### 6. Verify Deployment

```bash
# Check pods are running
kubectl get pods -n errandy

# Check ingress has address
kubectl get ingress -n errandy

# Check certificate status (may take 2-5 min)
kubectl get certificate -n errandy
kubectl describe certificate errandy-api-tls -n errandy

# View logs
kubectl logs -f deployment/errandy-backend -n errandy

# Test endpoint
curl https://api.errandy.com/health
```

---

## Destroy Infrastructure

To tear down everything and stop costs:

```bash
# Stage 2 first (platform)
cd terraform/platform
terraform destroy

# Stage 1 (cluster)
cd ../infra
terraform destroy
```

---

## Redeploy After Destruction

```bash
# 1. Recreate cluster
cd terraform/infra
terraform apply

# 2. Configure kubectl
doctl kubernetes cluster kubeconfig save errandy-cluster

# 3. Install platform
cd ../platform
terraform apply

# 4. Update Cloudflare DNS with new LoadBalancer IP

# 5. Apply app manifests
kubectl apply -f k8s/
```

---

## Troubleshooting

### Certificate Not Issuing

```bash
# Check certificate status
kubectl describe certificate errandy-api-tls -n errandy

# Check challenge
kubectl get challenges -n errandy

# Check cert-manager logs
kubectl logs -n cert-manager deploy/cert-manager
```

**Common fixes:**

- Ensure Cloudflare proxy is OFF (DNS only/grey cloud)
- Wait 2-5 minutes for DNS propagation

### Pod CrashLooping

```bash
kubectl describe pod -n errandy -l app.kubernetes.io/name=errandy-backend
kubectl logs -n errandy deploy/errandy-backend --previous
```

### Image Pull Errors

```bash
# Check secret exists
kubectl get secret docr-registry -n errandy

# Verify deployment uses the secret
kubectl get deployment errandy-backend -n errandy -o yaml | grep imagePullSecrets
```

---

## Directory Structure

```
errandy_backend/
├── Dockerfile
├── .dockerignore
├── DEPLOYMENT.md
├── terraform/
│   ├── infra/              # Stage 1: DOKS cluster
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── terraform.tfvars.example
│   └── platform/           # Stage 2: Ingress, cert-manager
│       ├── main.tf
│       ├── variables.tf
│       ├── outputs.tf
│       └── terraform.tfvars.example
├── k8s/
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secret.template.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   └── ingress.yaml
└── scripts/
    └── generate-secret.sh
```

---

## Cost Estimates

| Resource                     | Monthly Cost   |
| ---------------------------- | -------------- |
| DOKS (control plane)         | $0             |
| Node (s-2vcpu-4gb)           | ~$24           |
| LoadBalancer                 | ~$12           |
| Container Registry (starter) | $0             |
| **Total**                    | **~$36/month** |

**Cost Strategy**: `terraform destroy` both stages when idle.
