# Web API Reference

The web service (FastAPI) exposes the following HTTP API. The IO service and web UI are both consumers of this API.

## Data Model

**Library** (`/data/library.json`) — array of saved stations, each with a unique ID:
```json
[{"id": "a1b2c3d4", "name": "EHFM", "url": "https://...", "image": "https://..."}]
```

**Dial** (`/data/dial.json`) — 11 slots (positions 1–11), each holding a station ID or null:
```json
{"1": "a1b2c3d4", "2": null, ...}
```

Dial position 0 represents standby (no playback). Empty dial slots play static noise when selected.

## Endpoints

### Library

| Method | Path | Description |
|--------|------|-------------|
| GET | `/library` | List all saved stations |
| POST | `/library` | Add a station. Body: `{"name": "...", "url": "...", "image": "..."}` (image optional). Returns 409 if URL already exists. |
| DELETE | `/library/{station_id}` | Remove station from library and clear it from any dial slots |

### Dial

| Method | Path | Description |
|--------|------|-------------|
| GET | `/dial` | Return all 11 slots with resolved station info or null |
| PUT | `/dial/{position}` | Assign a station to a slot. Body: `{"station_id": "..."}`. Position 1–11. |
| DELETE | `/dial/{position}` | Clear a slot. Position 1–11. |

### Playback

| Method | Path | Description |
|--------|------|-------------|
| POST | `/dial/{position}/play` | Play station at position (1–11). Empty slots play static noise on loop. |
| POST | `/standby` | Stop playback, clear queue (dial position 0) |
| POST | `/volume/{level}` | Set MPD volume (0–100) |

### Status

| Method | Path | Description |
|--------|------|-------------|
| GET | `/status` | Returns `{state, dial_position, station, show, image, volume}` |
| GET | `/health` | Returns `{"status": "ok"}` |

### Search

| Method | Path | Description |
|--------|------|-------------|
| GET | `/search?q={query}` | Search Radio Browser directory. Returns up to 20 results with name, url, country, tags, bitrate, image. |

### UI

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Serves the web UI (`static/index.html`) |
