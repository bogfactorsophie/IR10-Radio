import json
from pathlib import Path

import httpx

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from mpd import MPDClient
from pydantic import BaseModel

from mpd_client import get_client

RADIO_BROWSER_API = "https://de1.api.radio-browser.info"

MAX_PRESETS = 6
STATIONS_FILE = Path("/data/stations.json")
DEFAULT_STATIONS_FILE = Path("default_stations.json")

app = FastAPI(title="IR10 Radio")
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.on_event("startup")
def startup_sync():
    """Sync station list to MPD queue on startup."""
    from mpd_client import get_client
    client_gen = get_client()
    client = next(client_gen)
    try:
        stations = read_stations()
        if not stations:
            stations = seed_default_stations()
        sync_to_mpd(client, stations)
    finally:
        try:
            next(client_gen)
        except StopIteration:
            pass


class StationIn(BaseModel):
    name: str
    url: str
    image: str = ""


def read_stations():
    if STATIONS_FILE.exists():
        return json.loads(STATIONS_FILE.read_text())
    return []


def write_stations(stations):
    STATIONS_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATIONS_FILE.write_text(json.dumps(stations, indent=2))


def sync_to_mpd(client, stations):
    """Replace MPD's queue with the current station list."""
    client.clear()
    for s in stations:
        client.add(s["url"])


def playing_position(client):
    """Return the currently playing queue position, or None."""
    status = client.status()
    if status.get("state") == "play":
        return int(status.get("song", -1))
    return None


def seed_default_stations():
    """On first run, copy default stations into the data volume."""
    stations = json.loads(DEFAULT_STATIONS_FILE.read_text())
    write_stations(stations)
    return stations


@app.get("/search")
async def search_stations(q: str = Query(min_length=1, max_length=100)):
    params = {
        "name": q,
        "limit": 20,
        "hidebroken": "true",
        "order": "clickcount",
        "reverse": "true",
    }
    url = f"{RADIO_BROWSER_API}/json/stations/search"
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            url, params=params, headers={"User-Agent": "IR10Radio/1.0"}, timeout=5
        )
        data = resp.json()
    return [
        {
            "name": s["name"],
            "url": s["url_resolved"] or s["url"],
            "country": s["country"],
            "tags": s["tags"],
            "bitrate": s["bitrate"],
            "image": s["favicon"],
        }
        for s in data
        if s.get("url_resolved") or s.get("url")
    ]


@app.get("/")
def index():
    return FileResponse("static/index.html")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/stations")
def list_stations():
    stations = read_stations()
    if not stations:
        stations = seed_default_stations()
    return [
        {"index": i, "name": s["name"], "url": s["url"]} for i, s in enumerate(stations)
    ]


@app.post("/stations")
def add_station(station: StationIn, client: MPDClient = Depends(get_client)):
    stations = read_stations()
    if len(stations) >= MAX_PRESETS:
        raise HTTPException(status_code=400, detail=f"Maximum of {MAX_PRESETS} presets reached")
    if any(s["url"] == station.url for s in stations):
        raise HTTPException(status_code=409, detail="Station already exists")
    entry = {"name": station.name, "url": station.url}
    if station.image:
        entry["image"] = station.image
    stations.append(entry)
    write_stations(stations)
    client.add(station.url)
    return {"status": "added", "name": station.name}


@app.post("/stations/{station_index}/move/{direction}")
def move_station(station_index: int, direction: str, client: MPDClient = Depends(get_client)):
    stations = read_stations()
    if station_index < 0 or station_index >= len(stations):
        raise HTTPException(status_code=404, detail="Station not found")
    if direction == "up" and station_index > 0:
        target = station_index - 1
    elif direction == "down" and station_index < len(stations) - 1:
        target = station_index + 1
    else:
        return {"status": "no change"}

    pos = playing_position(client)
    stations[station_index], stations[target] = stations[target], stations[station_index]
    write_stations(stations)
    client.move(station_index, target)

    # If the playing position now holds a different station, play the new one
    if pos is not None and (pos == station_index or pos == target):
        client.play(pos)

    return {"status": "moved"}


@app.delete("/stations/{station_index}")
def remove_station(station_index: int, client: MPDClient = Depends(get_client)):
    stations = read_stations()
    if station_index < 0 or station_index >= len(stations):
        raise HTTPException(status_code=404, detail="Station not found")

    pos = playing_position(client)
    removed = stations.pop(station_index)
    write_stations(stations)
    client.delete(station_index)

    if pos == station_index:
        client.stop()

    return {"status": "removed", "name": removed["name"]}


@app.post("/play/{station_index}")
def play_station(station_index: int, client: MPDClient = Depends(get_client)):
    stations = read_stations()
    if station_index < 0 or station_index >= len(stations):
        raise HTTPException(status_code=404, detail="Station not found")

    client.play(station_index)
    return {"playing": stations[station_index]["name"]}


@app.post("/stop")
def stop(client: MPDClient = Depends(get_client)):
    client.stop()
    return {"status": "stopped"}


@app.get("/now-playing")
def now_playing(client: MPDClient = Depends(get_client)):
    status = client.status()
    state = status.get("state", "unknown")

    if state == "play":
        song = client.currentsong()
        url = song.get("file", "")
        stations = read_stations()
        station = next((s for s in stations if s["url"] == url), None)
        name = station["name"] if station else url
        image = station.get("image", "") if station else ""
        show = song.get("title", "").strip(" -")
        if len(show) > 100:
            show = ""
        return {"state": state, "station": name, "show": show or None, "image": image or None}

    return {"state": state, "station": None}
