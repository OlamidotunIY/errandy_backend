#!/bin/bash
# ==============================================================================
# Build Docker image on a DigitalOcean Droplet (GitHub Clone)
# ==============================================================================
# Usage:
#   export DIGITALOCEAN_ACCESS_TOKEN=dop_v1_xxx
#   export GITHUB_TOKEN=ghp_xxx
#   ./scripts/build-on-droplet.sh [tag] [branch]
#
# Examples:
#   ./scripts/build-on-droplet.sh latest main
#   ./scripts/build-on-droplet.sh v1.0.0 main
# ==============================================================================

set -e

# Configuration
DROPLET_NAME="errandy-builder-$(date +%s)"
REGION="lon1"
SIZE="s-2vcpu-4gb"
IMAGE="docker-20-04"
REGISTRY="registry.digitalocean.com/errandy"
IMAGE_NAME="errandy-backend"
TAG="${1:-latest}"
BRANCH="${2:-main}"
GITHUB_REPO="github.com/axora-agency/errandy_backend.git"
GITHUB_TOKEN="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"
DIGITALOCEAN_ACCESS_TOKEN="dop_v1_7424ed698063b54a893fdb348faab9431bd57e6e92256ab9ec6879655ba22608"

echo "=============================================="
echo "🚀 Errandy Backend - Droplet Build"
echo "=============================================="
echo "📁 Repo: $GITHUB_REPO"
echo "🌿 Branch: $BRANCH"
echo "🏷️  Tag: $TAG"
echo "=============================================="

# Check for required tokens
if [ -z "$DIGITALOCEAN_ACCESS_TOKEN" ]; then
  echo "❌ DIGITALOCEAN_ACCESS_TOKEN not set"
  echo "   export DIGITALOCEAN_ACCESS_TOKEN=dop_v1_xxx"
  exit 1
fi

if [ -z "$GITHUB_TOKEN" ]; then
  echo "❌ GITHUB_TOKEN not set"
  echo "   export GITHUB_TOKEN=ghp_xxx"
  echo "   Get one at: https://github.com/settings/tokens"
  exit 1
fi

# Create droplet
echo "🔨 Creating build droplet..."
DROPLET_ID=$(doctl compute droplet create "$DROPLET_NAME" \
  --region "$REGION" \
  --size "$SIZE" \
  --image "$IMAGE" \
  --ssh-keys "$(doctl compute ssh-key list --format ID --no-header | head -1)" \
  --wait \
  --format ID \
  --no-header)

echo "✅ Droplet created: $DROPLET_ID"

DROPLET_IP=$(doctl compute droplet get "$DROPLET_ID" --format PublicIPv4 --no-header)
echo "📍 IP: $DROPLET_IP"

# Cleanup on exit
cleanup() {
  echo ""
  echo "🧹 Destroying droplet $DROPLET_ID..."
  doctl compute droplet delete "$DROPLET_ID" --force
  echo "✅ Droplet destroyed - no ongoing costs!"
}
trap cleanup EXIT

# Wait for SSH
echo "⏳ Waiting for SSH..."
for i in {1..30}; do
  if ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5 "root@$DROPLET_IP" "echo 'ready'" 2>/dev/null; then
    break
  fi
  sleep 2
done

echo "📦 Setting up droplet..."
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "root@$DROPLET_IP" "
  set -e

  # Install doctl
  cd /tmp
  wget -q https://github.com/digitalocean/doctl/releases/download/v1.104.0/doctl-1.104.0-linux-amd64.tar.gz
  tar xf doctl-1.104.0-linux-amd64.tar.gz
  mv doctl /usr/local/bin/

  # Auth doctl
  echo '$DIGITALOCEAN_ACCESS_TOKEN' | doctl auth init --access-token -
  doctl registry login

  # Clone repo
  echo '🔐 Cloning private repo...'
  cd /root
  git clone --depth 1 --branch $BRANCH https://$GITHUB_TOKEN@$GITHUB_REPO errandy_backend
  cd errandy_backend

  # Build
  echo '🔨 Building Docker image...'
  docker build -t $REGISTRY/$IMAGE_NAME:$TAG .

  # Push
  echo '📤 Pushing to registry...'
  docker push $REGISTRY/$IMAGE_NAME:$TAG

  echo '✅ Done!'
"

echo ""
echo "=============================================="
echo "🎉 SUCCESS!"
echo "=============================================="
echo "Image: $REGISTRY/$IMAGE_NAME:$TAG"
echo ""
echo "Deploy to cluster:"
echo "  kubectl rollout restart deployment/errandy-backend -n errandy"
echo ""
echo "Or set specific image:"
echo "  kubectl set image deployment/errandy-backend errandy-backend=$REGISTRY/$IMAGE_NAME:$TAG -n errandy"
echo ""
