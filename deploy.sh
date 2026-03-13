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
    SERVICES=(streamer web)
else
    SERVICES=("$@")
fi

PLATFORM="linux/arm/v7"
PROJECT="radio"

# Build for ARM using buildx
for svc in "${SERVICES[@]}"; do
    echo "==> Building $svc for $PLATFORM"
    docker buildx build \
        --platform "$PLATFORM" \
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

echo "==> Deploy complete"
