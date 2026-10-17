# Infrastructure & Deployment Guide

This guide contains all the essential commands to manage your standalone Azure (`Standard_D2ads_v7`) + Kubernetes (K3s) infrastructure for **Errandy Backend**.

## 🏗️ 1. Makefile Automation (Run on Windows)
These commands are run locally on your Windows machine from the root `errandy_backend` folder.

| Command | Description |
| :--- | :--- |
| `make start` | **From Scratch:** Provisions the dedicated Azure VM (`errandy-k3s-node` in `errandy-k3s-rg`), waits for boot, installs Docker/K3s, copies secrets, builds the image, and deploys all Kubernetes pods. |
| `make deploy-stack` | **Fast Update:** Use this if the VM is already running. Syncs secrets, builds the image (if missing), and applies updated Kubernetes YAML files. |
| `make build-image` | **Force Rebuild:** Syncs your latest code to the remote VM, rebuilds the Docker image (`errandy/app:latest`), and loads it into K3s. |
| `make seed-db` | **Database Seed:** Runs `npx prisma db seed` inside the running `errandy-api` pod against your MongoDB database. |
| `make update-dns` | **Cloudflare DNS:** Updates the `A` record for `api.errandy.com.ng` to the Azure VM's public IP. |
| `make stop` | **Destroy Everything:** Destroys the Azure VM, VNet, IP, and all disks (`errandy-k3s-rg`) so billing = $0. |
| `make ssh` | Instantly logs you into the Azure VM so you can run Kubernetes commands. |
| `make logs-api` | Streams live logs for the `errandy-api` deployment. |
| `make logs-worker` | Streams live logs for the `errandy-worker` BullMQ background deployment. |

---

## ☸️ 2. Kubernetes Commands (Run inside the VM)
To run these, first type `make ssh` on your Windows machine to enter the remote server. K3s has standard `kubectl` built-in!

### Checking if Apps are Running
* **See all running apps:** `kubectl get pods`
* **See everything in the cluster:** `kubectl get all`
* **Check if your domain is mapped:** `kubectl get ingress`

### Viewing Logs (Debugging)
* **Stream live logs for the NestJS API:**
  `kubectl logs -f -l app=errandy-api`
* **Stream live logs for the BullMQ Worker:**
  `kubectl logs -f -l app=errandy-worker`
* **Stream live logs for Redis:**
  `kubectl logs -f -l app=redis`

### Restarting Services
If you ever need to forcefully restart Errandy without rebuilding the image:
* `kubectl rollout restart deployment errandy-api errandy-worker`

---

## ☁️ 3. Terraform Commands (Run on Windows)
You rarely need to run these manually because `make start` and `make stop` handle them, but they are useful for debugging.

| Command | Description |
| :--- | :--- |
| `cd infrastructure/terraform` | Move into the Terraform directory first! |
| `terraform output k3s_vm_public_ip` | Prints the exact public IP address of your current Azure VM. |
| `terraform state list` | Lists all the Azure resources Terraform is currently tracking. |
