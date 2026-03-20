#!/usr/bin/env bash
# deploy.sh — Cross-build for ARM and deploy to the Raspberry Pi.
# Runs from bash on the WSL2 Ubuntu environment.
#
# Usage:
#   ./deploy.sh radio.local
#   ./deploy.sh radio.local streamer
#   ./deploy.sh 192.168.1.42 streamer web

set -euo pipefail

# Ensure QEMU binfmt handlers are registered for ARM cross-builds.
# Docker Desktop included this automatically; with Docker Engine in WSL2
# it must be set up explicitly. This is a no-op if already registered.
if ! docker buildx ls 2>/dev/null | grep -q "linux/arm/v7"; then
    echo "==> Registering QEMU binfmt handlers for ARM emulation"
    docker run --rm --privileged multiarch/qemu-user-static --reset -p yes
fi

PI_HOST="${1:?Usage: ./deploy.sh <pi-host> [service ...]}"
shift
if [[ $# -eq 0 ]]; then
    SERVICES=(streamer web io)
else
    SERVICES=("$@")
fi

PLATFORM="linux/arm/v7"
# io service needs arm64 for lgpio native extension
IO_PLATFORM="linux/arm64"
PROJECT="radio"

# Build for ARM using buildx
for svc in "${SERVICES[@]}"; do
    plat="$PLATFORM"
    [[ "$svc" == "io" ]] && plat="$IO_PLATFORM"
    echo "==> Building $svc for $plat"
    docker buildx build \
        --platform "$plat" \
        --tag "${PROJECT}-${svc}:latest" \
        --load \
        "./$svc"
done

# Export, transfer, and load images on the Pi
for svc in "${SERVICES[@]}"; do
    image="${PROJECT}-${svc}:latest"
    echo "==> Sending $image to $PI_HOST"
    docker save "$image" | ssh "${PI_HOST}" "docker load"
done

# Copy compose file and restart services on the Pi
echo "==> Restarting services on $PI_HOST"
ssh "${PI_HOST}" "mkdir -p ~/radio"
scp docker-compose.yml "${PI_HOST}:~/radio/docker-compose.yml"
ssh "${PI_HOST}" "cd ~/radio && docker compose up -d ${SERVICES[*]}"

# Basic smoke test — wait for web service to start
echo "==> Checking web endpoint..."
for i in 1 2 3 4 5; do
    if ssh "${PI_HOST}" "curl -sf http://localhost/health > /dev/null"; then
        echo "    Web service is up"
        break
    fi
    if [ "$i" -eq 5 ]; then
        echo "    WARNING: Web service not responding on /health"
    else
        echo "    Waiting for web service... (attempt $i/5)"
        sleep 5
    fi
done

echo "==> Deploy complete"
