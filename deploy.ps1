# deploy.ps1 — Cross-build for ARM and deploy to the Raspberry Pi.
# Runs from PowerShell on Windows with Docker Desktop.
#
# Usage:
#   .\deploy.ps1 -PiHost radio.local
#   .\deploy.ps1 -PiHost radio.local -Services streamer
#   .\deploy.ps1 -PiHost 192.168.1.42 -Services streamer,web

param(
    [Parameter(Mandatory)]
    [string]$PiHost,

    [string[]]$Services = @("streamer", "web", "display", "io")
)

$ErrorActionPreference = "Stop"

$Platform = "linux/arm/v7"
$Project = "radio"

# Build for ARM using buildx
foreach ($svc in $Services) {
    Write-Host "==> Building $svc for $Platform"
    docker buildx build `
        --platform $Platform `
        --tag "${Project}-${svc}:latest" `
        --load `
        ".\$svc"
    if ($LASTEXITCODE -ne 0) { throw "Build failed for $svc" }
}

# Export, transfer, and load images on the Pi
foreach ($svc in $Services) {
    $image = "${Project}-${svc}:latest"
    Write-Host "==> Sending $image to $PiHost"
    docker save $image | ssh "pi@$PiHost" "docker load"
    if ($LASTEXITCODE -ne 0) { throw "Transfer failed for $image" }
}

# Copy compose file and restart services on the Pi
Write-Host "==> Restarting services on $PiHost"
scp docker-compose.yml "pi@${PiHost}:/opt/radio/docker-compose.yml"
ssh "pi@$PiHost" "cd /opt/radio && docker compose up -d $($Services -join ' ')"

Write-Host "==> Deploy complete"
