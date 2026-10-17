# ==============================================================================
# Errandy Backend — Co-Deployment Makefile (Shared Azure K3s Cluster)
# ==============================================================================
# Reads the shared Azure VM IP from atlashub-backend's Terraform state by default,
# or allows overriding manually: make deploy-stack VM_IP=1.2.3.4
# ==============================================================================

TF_DIR ?= ../../Atlashub/atlashub-backend/infrastructure/terraform
VM_IP ?= $(shell terraform -chdir=$(TF_DIR) output -raw k3s_vm_public_ip)
ENV_FILE ?= $(if $(wildcard .env.production),.env.production,.env)
SSH_OPTIONS = -o BatchMode=yes -o ConnectTimeout=15 -o ServerAliveInterval=15 -o ServerAliveCountMax=2 -o StrictHostKeyChecking=no

ifeq ($(OS),Windows_NT)
    SSH = C:\Windows\sysnative\OpenSSH\ssh.exe
    SCP = C:\Windows\sysnative\OpenSSH\scp.exe
    SSH_KEY = $(USERPROFILE)\.ssh\id_rsa_azure
else
    SSH = ssh
    SCP = scp
    SSH_KEY = ~/.ssh/id_rsa_azure
endif

.PHONY: deploy-stack build-image sync-source seed-db update-dns ssh logs-api logs-worker prune-runtime-images

# 1. Deploy or update the Errandy stack on the running shared K3s VM
deploy-stack:
	$(if $(strip $(VM_IP)),,$(error VM_IP is empty. Ensure the shared Azure VM is running in $(TF_DIR) or pass VM_IP=<ip>))
	@echo "=> Checking if Docker and K3s are ready on $(VM_IP)..."
	$(SSH) $(SSH_OPTIONS) -i $(SSH_KEY) ubuntu@$(VM_IP) "while ! command -v docker >/dev/null 2>&1; do echo 'Waiting for Docker...'; sleep 5; done; while ! command -v k3s >/dev/null 2>&1; do echo 'Waiting for K3s...'; sleep 5; done; while ! sudo k3s kubectl get node >/dev/null 2>&1; do echo 'Waiting for Kubernetes to be ready...'; sleep 5; done; echo 'Shared K3s Infrastructure is Ready!'"
	@echo "=> Syncing Errandy Secrets ($(ENV_FILE)) to VM..."
	$(eval FIREBASE_JSON := $(wildcard infrastructure/Firebase/*.json))
	$(eval FIREBASE_JSON_NAME := $(notdir $(FIREBASE_JSON)))
	@$(SCP) -O $(SSH_OPTIONS) -i $(SSH_KEY) $(ENV_FILE) ubuntu@$(VM_IP):/tmp/.env.errandy
	$(if $(FIREBASE_JSON),@$(SCP) -O $(SSH_OPTIONS) -i $(SSH_KEY) $(FIREBASE_JSON) ubuntu@$(VM_IP):/tmp/$(FIREBASE_JSON_NAME),)
	@echo "=> Applying Kubernetes Secrets for Errandy..."
	$(SSH) $(SSH_OPTIONS) -i $(SSH_KEY) ubuntu@$(VM_IP) "export KUBECONFIG=/home/ubuntu/.kube/config && kubectl delete secret errandy-secrets errandy-firebase-secrets --ignore-not-found && kubectl create secret generic errandy-secrets --from-env-file=/tmp/.env.errandy $(if $(FIREBASE_JSON),&& kubectl create secret generic errandy-firebase-secrets --from-file=/tmp/$(FIREBASE_JSON_NAME),)"
	@echo "=> Ensuring Docker Image errandy/app:latest exists in K3s..."
	@$(SSH) $(SSH_OPTIONS) -i $(SSH_KEY) ubuntu@$(VM_IP) "sudo k3s ctr images ls | grep -q errandy/app:latest" || $(MAKE) build-image
	@echo "=> Syncing Kubernetes Manifests & Applying Kustomization..."
	@$(MAKE) sync-source
	$(SSH) $(SSH_OPTIONS) -i $(SSH_KEY) ubuntu@$(VM_IP) "export KUBECONFIG=/home/ubuntu/.kube/config && kubectl apply -k /home/ubuntu/errandy/infrastructure/k8s/overlays/free-tier"
	@echo "=> Rolling out Errandy API and Worker deployments..."
	$(SSH) $(SSH_OPTIONS) -i $(SSH_KEY) ubuntu@$(VM_IP) "export KUBECONFIG=/home/ubuntu/.kube/config && kubectl rollout restart deployment/errandy-api deployment/errandy-worker && kubectl rollout status deployment/errandy-api --timeout=180s && kubectl rollout status deployment/errandy-worker --timeout=180s"
	$(MAKE) prune-runtime-images
	@echo "=> Errandy Backend (API + Worker) is completely up and running!"

# 2. Sync local repository (excluding node_modules/dist/.git) to the VM
sync-source:
	@echo "=> Syncing Errandy source files to ubuntu@$(VM_IP):/home/ubuntu/errandy..."
	tar --exclude='node_modules' --exclude='dist' --exclude='.git' --exclude='coverage' -czf - . | $(SSH) $(SSH_OPTIONS) -i $(SSH_KEY) ubuntu@$(VM_IP) "mkdir -p /home/ubuntu/errandy && tar -xzf - -C /home/ubuntu/errandy"

# 3. Build Docker image on the VM and import into K3s containerd
build-image: sync-source
	@echo "=> Building Docker Image errandy/app:latest and loading into K3s..."
	$(SSH) $(SSH_OPTIONS) -i $(SSH_KEY) ubuntu@$(VM_IP) "cd /home/ubuntu/errandy && sudo docker build -t errandy/app:latest . && sudo docker save errandy/app:latest | sudo k3s ctr images import -"

# 4. Run Prisma database seed inside the running errandy-api pod
seed-db:
	@echo "=> Running Prisma DB Seed inside errandy-api pod..."
	$(SSH) $(SSH_OPTIONS) -i $(SSH_KEY) ubuntu@$(VM_IP) "export KUBECONFIG=/home/ubuntu/.kube/config && POD=\$$(kubectl get pod -l app=errandy-api -o jsonpath='{.items[0].metadata.name}') && kubectl exec \$$POD -- npx prisma db seed"

# 5. Prune unused Docker build cache and K3s images
prune-runtime-images:
	@echo "=> Pruning unused Docker build cache and K3s images..."
	$(SSH) $(SSH_OPTIONS) -i $(SSH_KEY) ubuntu@$(VM_IP) "sudo docker builder prune -af && sudo docker image prune -af && sudo k3s crictl rmi --prune"

# 6. Update Cloudflare DNS for api.errandy.com.ng
update-dns:
	@echo "=> Updating Cloudflare DNS for api.errandy.com.ng to $(VM_IP)..."
	@$(SSH) -i $(SSH_KEY) -o StrictHostKeyChecking=no ubuntu@$(VM_IP) "\
		CF_TOKEN=\$$(grep CLOUDFLARE_API_TOKEN /tmp/.env.errandy | cut -d '=' -f2 | tr -d '\r') && \
		CF_ZONE=\$$(grep CLOUDFLARE_ZONE_ID /tmp/.env.errandy | cut -d '=' -f2 | tr -d '\r') && \
		if [ -z \"\$$CF_TOKEN\" ] || [ -z \"\$$CF_ZONE\" ]; then \
			echo 'ERROR: CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID not found in $(ENV_FILE)'; exit 1; \
		fi && \
		sudo apt-get update >/dev/null 2>&1 && sudo apt-get install -y jq >/dev/null 2>&1 && \
		echo 'Fetching existing DNS Record ID...' && \
		RECORD_ID=\$$(curl -s -X GET \"https://api.cloudflare.com/client/v4/zones/\$$CF_ZONE/dns_records?name=api.errandy.com.ng&type=A\" -H \"Authorization: Bearer \$$CF_TOKEN\" -H \"Content-Type: application/json\" | jq -r '.result[0].id') && \
		if [ \"\$$RECORD_ID\" = \"null\" ] || [ -z \"\$$RECORD_ID\" ]; then \
			echo 'Creating new DNS record...' && \
			curl -s -X POST \"https://api.cloudflare.com/client/v4/zones/\$$CF_ZONE/dns_records\" -H \"Authorization: Bearer \$$CF_TOKEN\" -H \"Content-Type: application/json\" --data '{\"type\":\"A\",\"name\":\"api.errandy.com.ng\",\"content\":\"$(VM_IP)\",\"ttl\":1,\"proxied\":true}' >/dev/null; \
		else \
			echo 'Updating existing DNS record...' && \
			curl -s -X PUT \"https://api.cloudflare.com/client/v4/zones/\$$CF_ZONE/dns_records/\$$RECORD_ID\" -H \"Authorization: Bearer \$$CF_TOKEN\" -H \"Content-Type: application/json\" --data '{\"type\":\"A\",\"name\":\"api.errandy.com.ng\",\"content\":\"$(VM_IP)\",\"ttl\":1,\"proxied\":true}' >/dev/null; \
		fi && echo '\n=> DNS Update Complete!'"

# 7. SSH & Live Log Helpers
ssh:
	@echo "=> Connecting to Shared Azure K3s VM ($(VM_IP))..."
	$(SSH) -i $(SSH_KEY) -o StrictHostKeyChecking=no ubuntu@$(VM_IP)

logs-api:
	$(SSH) -i $(SSH_KEY) -o StrictHostKeyChecking=no ubuntu@$(VM_IP) "export KUBECONFIG=/home/ubuntu/.kube/config && kubectl logs -f -l app=errandy-api"

logs-worker:
	$(SSH) -i $(SSH_KEY) -o StrictHostKeyChecking=no ubuntu@$(VM_IP) "export KUBECONFIG=/home/ubuntu/.kube/config && kubectl logs -f -l app=errandy-worker"
