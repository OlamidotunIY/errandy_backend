#!/usr/bin/env bash
set -euo pipefail

err() { echo "ERROR: $*" >&2; }
log() { echo "OK: $*"; }
info() { echo "INFO: $*"; }

have() { command -v "$1" >/dev/null 2>&1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

APP_DIR="${APP_DIR:-$REPO_DIR}"
COMPOSE_FILE="$APP_DIR/docker-compose.prod.yml"

SRC_CONF_DIR="$REPO_DIR/nginx/conf.d"
DST_CONF_DIR="$APP_DIR/nginx/conf.d"

require_file() {
  local path="$1"
  local what="$2"
  if [ ! -f "$path" ]; then
    err "Missing $what: $path"
    exit 1
  fi
}

require_dir() {
  local path="$1"
  local what="$2"
  if [ ! -d "$path" ]; then
    err "Missing $what: $path"
    exit 1
  fi
}

copy_nginx_config() {
  require_dir "$SRC_CONF_DIR" "nginx config source directory"

  mkdir -p "$DST_CONF_DIR"

  # Copy config into the compose project directory when needed.
  # This is important if only docker-compose.yml is deployed to $APP_DIR.
  if [ "$(cd "$SRC_CONF_DIR" && pwd)" = "$(cd "$DST_CONF_DIR" && pwd)" ]; then
    info "Nginx config already present at: $DST_CONF_DIR"
    return
  fi

  cp -a "$SRC_CONF_DIR/." "$DST_CONF_DIR/"
  log "Nginx config copied to: $DST_CONF_DIR"
}

validate_nginx_config() {
  require_file "$COMPOSE_FILE" "docker-compose.prod.yml"

  if ! have docker; then
    err "docker not found. Run scripts/nginx/install.sh first."
    exit 1
  fi

  if ! docker compose version >/dev/null 2>&1; then
    err "docker compose plugin not found. Run scripts/nginx/install.sh first."
    exit 1
  fi

  info "Validating nginx config inside a one-off container..."
  docker compose -f "$COMPOSE_FILE" run --rm nginx nginx -t
  log "Nginx config OK"
}

reload_nginx() {
  info "Starting/updating nginx service..."
  docker compose -f "$COMPOSE_FILE" up -d nginx

  info "Reloading nginx..."
  docker compose -f "$COMPOSE_FILE" exec -T nginx nginx -s reload

  log "Nginx reloaded"
}

main() {
  copy_nginx_config
  validate_nginx_config
  reload_nginx
}

main "$@"
