# Development

## Dependencies

### Windows (host)

* Docker Desktop — runs the Docker engine, provides `docker` and `docker compose` CLI, includes `docker buildx` for ARM cross-builds

### WSL2

* `mpc` — MPD client for controlling the streamer: `sudo apt install mpc`

## Build

Build all services:

```sh
docker compose build
```

Build a single service:

```sh
docker compose build streamer
```

## Run

Start all services:

```sh
docker compose up
```

Start the streamer only:

```sh
docker compose up streamer
```

## Test Playback

Check MPD status:

```sh
mpc -h localhost status
```

List loaded stations:

```sh
mpc -h localhost playlist
```

Cycle to the next station:

```sh
mpc -h localhost next
```

Listen to the HTTP stream (works on dev environments where ALSA is unavailable):

```
http://localhost:8000
```

## Deploy to Pi

The Pi Zero 2W runs 32-bit Raspbian (`linux/arm/v7`). Images must be cross-built from x86 using `docker buildx`. Run from PowerShell on Windows:

Deploy all services:

```powershell
.\deploy.ps1 -PiHost radio.local
```

Deploy specific services:

```powershell
.\deploy.ps1 -PiHost radio.local -Services streamer,web
```

The script cross-builds for ARM, transfers images over SSH, copies `docker-compose.yml`, and restarts services. Requires SSH access to `pi@<host>` (Windows OpenSSH client).

## Logs

View streamer logs:

```sh
docker compose logs -f streamer
```
