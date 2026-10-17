# ==============================================================================
# Errandy Backend — Standalone Azure + K3s Deployment Makefile
# ==============================================================================

TF_DIR = infrastructure/terraform
VM_IP = $(shell terraform -chdir=$(TF_DIR) output -raw k3s_vm_public_ip)
ENV_FILE = $(if $(wildcard .env.production),.env.production,.env)
SSH_OPTIONS = -o BatchMode=yes -o ConnectTimeout=20 -o ConnectionAttempts=5 -o ServerAliveInterval=15 -o ServerAliveCountMax=2 -o StrictHostKeyChecking=no

ifeq ($(OS),Windows_NT)
    SSH = C:\Windows\sysnative\OpenSSH\ssh.exe
    SCP = C:\Windows\sysnative\OpenSSH\scp.exe
    SSH_KEY = $(USERPROFILE)\.ssh\id_rsa_azure
    RM = del /f /q
    MAKE_CMD = make
else
    SSH = ssh
    SCP = scp
    SSH_KEY = ~/.ssh/id_rsa_azure
    RM = rm -f
    MAKE_CMD = $(MAKE)
endif

.PHONY: start deploy-stack build-image sync-source seed-db stop ssh update-dns logs-api logs-worker prune-runtime-images

# 1. Build the Azure infrastructure from scratch and deploy the stack
start:
	@echo "=> Building Azure infrastructure (Standard_D2ads_v7)..."
	cd $(TF_DIR) && terraform init -upgrade && terraform apply -auto-approve
	@echo "=> Waiting 45s for VM SSH to boot..."
	timeout /t 45 /nobreak
	$(MAKE_CMD) deploy-stack

# Internal target: runs AFTER infrastructure exists so $(VM_IP) evaluates correctly
deploy-stack:
	@echo "=> Checking if Docker and K3s are installed and ready on $(VM_IP)..."
	$(SSH) $(SSH_OPTIONS) -i $(SSH_KEY) ubuntu@$(VM_IP) "while ! command -v docker >/dev/null 2>&1; do echo 'Waiting for Docker...'; sleep 5; done; while ! command -v k3s >/dev/null 2>&1; do echo 'Waiting for K3s...'; sleep 5; done; while ! sudo k3s kubectl get node >/dev/null 2>&1; do echo 'Waiting for Kubernetes to be ready...'; sleep 5; done; echo 'Infrastructure is Ready!'"
	@echo "=> Syncing Secrets ($(ENV_FILE)) to VM..."
	$(eval FIREBASE_JSON := $(wildcard infrastructure/Firebase/*.json))
	$(eval FIREBASE_JSON_NAME := $(notdir $(FIREBASE_JSON)))
	@$(SCP) -O $(SSH_OPTIONS) -i $(SSH_KEY) $(ENV_FILE) ubuntu@$(VM_IP):/tmp/.env
	$(if $(FIREBASE_JSON),@$(SCP) -O $(SSH_OPTIONS) -i $(SSH_KEY) $(FIREBASE_JSON) ubuntu@$(VM_IP):/tmp/$(FIREBASE_JSON_NAME),)
	@echo "=> Ensuring Docker Image errandy/app:latest exists in K3s..."
	@$(SSH) $(SSH_OPTIONS) -i $(SSH_KEY) ubuntu@$(VM_IP) "sudo k3s ctr images ls | grep -q errandy/app:latest" || $(MAKE_CMD) build-image
	@echo "=> Applying Kubernetes Secrets..."
	$(SSH) $(SSH_OPTIONS) -i $(SSH_KEY) ubuntu@$(VM_IP) "export KUBECONFIG=/home/ubuntu/.kube/config && kubectl delete secret errandy-secrets firebase-secrets --ignore-not-found && kubectl create secret generic errandy-secrets --from-env-file=/tmp/.env $(if $(FIREBASE_JSON),&& kubectl create secret generic firebase-secrets --from-file=/tmp/$(FIREBASE_JSON_NAME),)"
	@echo "=> Syncing & Applying Kubernetes Manifests..."
	@$(MAKE_CMD) sync-source
	$(SSH) $(SSH_OPTIONS) -i $(SSH_KEY) ubuntu@$(VM_IP) "export KUBECONFIG=/home/ubuntu/.kube/config && kubectl apply -k /home/ubuntu/errandy/infrastructure/k8s/base"
	@echo "=> Rolling out the Errandy API and Worker deployments..."
	$(SSH) $(SSH_OPTIONS) -i $(SSH_KEY) ubuntu@$(VM_IP) "export KUBECONFIG=/home/ubuntu/.kube/config && kubectl rollout restart deployment/errandy-api deployment/errandy-worker && kubectl rollout status deployment/errandy-api --timeout=180s && kubectl rollout status deployment/errandy-worker --timeout=180s"
	$(MAKE_CMD) prune-runtime-images
	@echo "=> Environment is completely up and running!"

sync-source:
	@echo "=> Packaging Errandy source files..."
	tar --exclude=errandy.tar.gz --exclude=node_modules --exclude=dist --exclude=.git --exclude=coverage --exclude=infrastructure/terraform/.terraform -czf errandy.tar.gz .
	@echo "=> Uploading errandy.tar.gz to ubuntu@$(VM_IP):/tmp/..."
	@$(SCP) -O $(SSH_OPTIONS) -i $(SSH_KEY) errandy.tar.gz ubuntu@$(VM_IP):/tmp/errandy.tar.gz
	@echo "=> Extracting on remote VM at /home/ubuntu/errandy..."
	@$(SSH) $(SSH_OPTIONS) -i $(SSH_KEY) ubuntu@$(VM_IP) "mkdir -p /home/ubuntu/errandy && tar -xzf /tmp/errandy.tar.gz -C /home/ubuntu/errandy && rm -f /tmp/errandy.tar.gz"
	-@$(RM) errandy.tar.gz

build-image: sync-source
	@echo "=> Building Docker Image and Loading into K3s..."
	$(SSH) $(SSH_OPTIONS) -i $(SSH_KEY) ubuntu@$(VM_IP) "cd /home/ubuntu/errandy && sudo docker build -t errandy/app:latest . && sudo docker save errandy/app:latest | sudo k3s ctr images import -"

seed-db:
	@echo "=> Running Prisma DB Seed inside errandy-api pod..."
	$(SSH) $(SSH_OPTIONS) -i $(SSH_KEY) ubuntu@$(VM_IP) "export KUBECONFIG=/home/ubuntu/.kube/config && POD=\$$(kubectl get pod -l app=errandy-api -o jsonpath='{.items[0].metadata.name}') && kubectl exec \$$POD -- npx prisma db seed"

prune-runtime-images:
	@echo "=> Pruning unused Docker build cache and K3s images..."
	$(SSH) $(SSH_OPTIONS) -i $(SSH_KEY) ubuntu@$(VM_IP) "sudo docker builder prune -af && sudo docker image prune -af && sudo k3s crictl rmi --prune"

# 2. Completely destroy the Azure infrastructure
stop:
	@echo "=> Destroying all Azure infrastructure (including disks)..."
	cd $(TF_DIR) && terraform destroy -auto-approve
	@echo "=> Environment destroyed. Billing is now $$0."

# 3. SSH directly into the VM
ssh:
	@echo "=> Connecting to VM..."
	$(SSH) -i $(SSH_KEY) -o StrictHostKeyChecking=no ubuntu@$(VM_IP)

# 4. Update Cloudflare DNS
update-dns:
	@echo "=> Updating Cloudflare DNS for api.errandy.com.ng to $(VM_IP)..."
	@$(SSH) -i $(SSH_KEY) -o StrictHostKeyChecking=no ubuntu@$(VM_IP) "\
		CF_TOKEN=\$$(grep CLOUDFLARE_API_TOKEN /tmp/.env | cut -d '=' -f2 | tr -d '\r') && \
		CF_ZONE=\$$(grep CLOUDFLARE_ZONE_ID /tmp/.env | cut -d '=' -f2 | tr -d '\r') && \
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

logs-api:
	$(SSH) -i $(SSH_KEY) -o StrictHostKeyChecking=no ubuntu@$(VM_IP) "export KUBECONFIG=/home/ubuntu/.kube/config && kubectl logs -f -l app=errandy-api"

logs-worker:
	$(SSH) -i $(SSH_KEY) -o StrictHostKeyChecking=no ubuntu@$(VM_IP) "export KUBECONFIG=/home/ubuntu/.kube/config && kubectl logs -f -l app=errandy-worker"
