# Errandy Backend — Infrastructure & Co-Deployment Guide

This directory contains the Kubernetes (K3s) and Docker configurations for deploying `errandy_backend` alongside `atlashub-backend` on the **shared Azure K3s VM**.

---

## 🏗️ 1. Architecture Summary

* **Shared Compute**: Runs on the same Azure K3s node (`atlashub-k3s-node`) provisioned in `atlashub-backend/infrastructure/terraform`.
* **Ingress Routing (Traefik)**:
  * `api.atlashub.name.ng` $\rightarrow$ `atlashub-app:8080`
  * `api.errandy.com.ng` $\rightarrow$ `errandy-api:8080`
* **Workloads**:
  * `errandy-api`: NestJS HTTP/GraphQL/WebSocket/Better-Auth server (`node dist/src/main.js`).
  * `errandy-worker`: BullMQ background processor (`node dist/src/worker.js`) for payouts, escrow releases, and notifications.
* **Shared Redis**: Connects to the in-cluster `redis:6379` service using **logical DB `1`** (`REDIS_URL=redis://redis:6379/1`) so keys never collide with Atlashub (logical DB `0`).
* **Database**: Uses MongoDB (`DATABASE_URL` in `.env.production` / `.env`, injected via the `errandy-secrets` Kubernetes Secret).

---

## 🚀 2. Makefile Automation (Run on Windows)

Run these commands from the root `errandy_backend` directory. By default, `Makefile` reads `VM_IP` from `../../Atlashub/atlashub-backend/infrastructure/terraform` (or you can pass `VM_IP=<ip>` directly).

| Command | Description |
| :--- | :--- |
| `make deploy-stack` | **Deploy / Update Errandy:** Syncs `.env.production` (or `.env`) and `infrastructure/Firebase/*.json` to the VM, updates Kubernetes secrets, builds the image (if missing), applies K8s manifests, and restarts `errandy-api` & `errandy-worker`. |
| `make build-image` | **Force Rebuild:** Syncs the current codebase to the remote VM, builds `errandy/app:latest`, imports it into K3s containerd, and restarts both deployments. |
| `make seed-db` | **Seed MongoDB:** Executes `npx prisma db seed` inside the running `errandy-api` pod. |
| `make update-dns` | **Cloudflare DNS:** Updates the `A` record for `api.errandy.com.ng` to point to the current Azure VM IP. |
| `make logs-api` | Streams live logs from the `errandy-api` pod. |
| `make logs-worker` | Streams live logs from the `errandy-worker` pod. |
| `make ssh` | Opens an interactive SSH session into the Azure K3s VM. |

---

## ☸️ 3. Kubernetes Commands (Run inside the VM)

After running `make ssh`, use standard `kubectl` commands:

* **Check running pods (both Atlashub & Errandy):**
  `kubectl get pods`
* **Check ingress host mappings:**
  `kubectl get ingress`
* **Stream API logs:**
  `kubectl logs -f -l app=errandy-api`
* **Stream Worker logs:**
  `kubectl logs -f -l app=errandy-worker`
* **Restart Errandy deployments:**
  `kubectl rollout restart deployment/errandy-api deployment/errandy-worker`
