#!/usr/bin/env bash
set -euo pipefail

err() { echo "ERROR: $*" >&2; }
log() { echo "OK: $*"; }
info() { echo "INFO: $*"; }

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    err "This script must run as root. Re-run with: sudo $0"
    exit 1
  fi
}

have() { command -v "$1" >/dev/null 2>&1; }

ensure_docker() {
  if have docker; then
    info "Docker already installed: $(docker --version 2>/dev/null || echo 'unknown version')"
    return
  fi

  require_root
  info "Docker not found. Installing Docker..."

  if have apt-get; then
    apt-get update -y
    apt-get install -y ca-certificates curl
  else
    err "Unsupported OS/package manager (apt-get not found). Install Docker manually."
    exit 1
  fi

  curl -fsSL https://get.docker.com | sh

  if have systemctl; then
    systemctl enable --now docker >/dev/null 2>&1 || true
  fi

  log "Docker installed: $(docker --version 2>/dev/null || echo 'installed')"
}

ensure_compose() {
  if docker compose version >/dev/null 2>&1; then
    info "Docker Compose plugin present: $(docker compose version 2>/dev/null || true)"
    return
  fi

  require_root
  info "Docker Compose plugin not found. Installing docker-compose-plugin..."

  if have apt-get; then
    apt-get update -y
    apt-get install -y docker-compose-plugin
  else
    err "Unsupported OS/package manager (apt-get not found). Install Docker Compose plugin manually."
    exit 1
  fi

  log "Docker Compose plugin installed: $(docker compose version 2>/dev/null || true)"
}

ensure_docker_daemon() {
  if docker info >/dev/null 2>&1; then
    return
  fi

  err "Docker daemon is not reachable."
  err "If Docker is installed, ensure the service is running (e.g. 'sudo systemctl start docker')"
  err "If you're not root, run this script with sudo or add your user to the docker group."
  exit 1
}

ensure_port_80_free() {
  local in_use=0

  if have ss; then
    if ss -ltnp 2>/dev/null | grep -qE 'LISTEN.+(:80\\s|\\[::\\]:80\\s|\\*:80\\s)'; then
      in_use=1
      err "Port 80 is already in use. Stop the service using it before starting the nginx container."
      ss -ltnp 2>/dev/null | grep -E 'LISTEN.+(:80\\s|\\[::\\]:80\\s|\\*:80\\s)' >&2 || true
    fi
  elif have lsof; then
    if lsof -nP -iTCP:80 -sTCP:LISTEN >/dev/null 2>&1; then
      in_use=1
      err "Port 80 is already in use. Stop the service using it before starting the nginx container."
      lsof -nP -iTCP:80 -sTCP:LISTEN >&2 || true
    fi
  else
    info "Neither 'ss' nor 'lsof' found; skipping port 80 check."
  fi

  if [ "$in_use" -ne 0 ]; then
    exit 1
  fi
}

main() {
  ensure_docker
  ensure_compose
  ensure_docker_daemon
  ensure_port_80_free
  log "Host is ready to run the nginx reverse-proxy container."
}

main "$@"
