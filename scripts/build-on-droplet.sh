#!/bin/bash
# ==============================================================================
# Build Docker image on a DigitalOcean Droplet (using cloud-init)
# ==============================================================================
# This version uses cloud-init and polling - no SSH key required!
#
# Usage:
#   export DIGITALOCEAN_ACCESS_TOKEN=dop_v1_xxx
#   export GITHUB_TOKEN=ghp_xxx
#   ./scripts/build-on-droplet.sh [tag] [branch]
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
  exit 1
fi

if [ -z "$GITHUB_TOKEN" ]; then
  echo "❌ GITHUB_TOKEN not set"
  exit 1
fi

# Create cloud-init user-data script
USER_DATA=$(cat <<EOF
#!/bin/bash
exec > /var/log/build.log 2>&1
set -ex

echo "=== Starting build ==="
date

# Install doctl
cd /tmp
wget -q https://github.com/digitalocean/doctl/releases/download/v1.104.0/doctl-1.104.0-linux-amd64.tar.gz
tar xf doctl-1.104.0-linux-amd64.tar.gz
mv doctl /usr/local/bin/

# Auth doctl and registry
echo "${DIGITALOCEAN_ACCESS_TOKEN}" | doctl auth init --access-token -
doctl registry login

# Clone repo
cd /root
git clone --depth 1 --branch ${BRANCH} https://${GITHUB_TOKEN}@${GITHUB_REPO} errandy_backend
cd errandy_backend

# Build and push
docker build -t ${REGISTRY}/${IMAGE_NAME}:${TAG} .
docker push ${REGISTRY}/${IMAGE_NAME}:${TAG}

echo "=== Build complete ==="
date

# Signal completion
touch /tmp/build_complete
EOF
)

# Create droplet with cloud-init
echo "🔨 Creating build droplet with cloud-init..."
DROPLET_ID=$(doctl compute droplet create "$DROPLET_NAME" \
  --region "$REGION" \
  --size "$SIZE" \
  --image "$IMAGE" \
  --user-data "$USER_DATA" \
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
  echo "✅ Droplet destroyed"
}
trap cleanup EXIT

# Poll for image in registry
echo "⏳ Waiting for build to complete (polling registry)..."
echo "   This usually takes 5-10 minutes..."

for i in {1..60}; do
  sleep 30
  echo "  Checking... ($(( i * 30 / 60 )) min elapsed)"

  # Check if image exists in registry
  if doctl registry repository list-tags "$IMAGE_NAME" 2>/dev/null | grep -q "$TAG"; then
    echo ""
    echo "=============================================="
    echo "🎉 SUCCESS!"
    echo "=============================================="
    echo "Image: $REGISTRY/$IMAGE_NAME:$TAG"
    echo ""
    echo "Deploy to cluster:"
    echo "  kubectl rollout restart deployment/errandy-backend -n errandy"
    echo ""
    exit 0
  fi
done

echo "❌ Build timed out after 30 minutes"
echo "Check droplet logs if it still exists"
exit 1
