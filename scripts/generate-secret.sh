#!/bin/bash
# ==============================================================================
# Generate Kubernetes Secret from .env file
# ==============================================================================
# Usage: ./generate-secret.sh
# This script reads your .env file and generates a properly encoded secret.yaml
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$BACKEND_DIR/.env"
OUTPUT_FILE="$BACKEND_DIR/k8s/secret.yaml"

if [ ! -f "$ENV_FILE" ]; then
    echo "Error: .env file not found at $ENV_FILE"
    exit 1
fi

echo "Generating secret.yaml from .env file..."

cat > "$OUTPUT_FILE" << 'EOF'
# ==============================================================================
# Secret - Sensitive credentials
# ==============================================================================
# AUTO-GENERATED from .env file
# DO NOT commit this file to version control!
# ==============================================================================
apiVersion: v1
kind: Secret
metadata:
  name: errandy-backend-secrets
  namespace: errandy
  labels:
    app.kubernetes.io/name: errandy-backend
    app.kubernetes.io/component: backend
type: Opaque
data:
EOF

# Read .env and encode each value
while IFS='=' read -r key value || [ -n "$key" ]; do
    # Skip empty lines and comments
    [[ -z "$key" || "$key" =~ ^# ]] && continue

    # Remove any quotes from value
    value=$(echo "$value" | sed 's/^["'"'"']//;s/["'"'"']$//')

    # Base64 encode the value
    encoded=$(echo -n "$value" | base64 -w 0)

    # Write to output file
    echo "  $key: \"$encoded\"" >> "$OUTPUT_FILE"
done < "$ENV_FILE"

echo "✅ Generated: $OUTPUT_FILE"
echo ""
echo "⚠️  WARNING: This file contains sensitive data!"
echo "   Make sure k8s/secret.yaml is in .gitignore"
echo ""
echo "To apply the secret:"
echo "   kubectl apply -f k8s/secret.yaml"
