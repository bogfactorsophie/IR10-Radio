# Development

## Dependencies

* Docker Engine — provides `docker`, `docker compose`, and `docker buildx` for ARM cross-builds: [Install Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
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

## Test Web API

With the streamer and web services running (`docker compose up streamer web`):

```sh
curl http://localhost/health
curl http://localhost/stations
curl -X POST http://localhost/play/0
curl http://localhost/now-playing
curl -X POST http://localhost/stop
```

View the web interface at `http://localhost` in a browser, play/stop you can add/remove and view a list of stations

Listen to the stream at `http://localhost:8000` in a separate browser tab or media player to verify playback.

## Deploy to Pi

The Pi Zero 2W runs 32-bit Raspbian (`linux/arm/v7`). Images must be cross-built from x86 using `docker buildx`. Run from WSL2:

Deploy all services:

```sh
./deploy.sh radio
```

Deploy specific services:

```sh
./deploy.sh radio streamer web
```

The script cross-builds for ARM, transfers images over SSH, copies `docker-compose.yml`, and restarts services.

## SSH to Pi

```sh
ssh radio
```

## Logs

View streamer logs:

```sh
docker compose logs -f streamer
```
