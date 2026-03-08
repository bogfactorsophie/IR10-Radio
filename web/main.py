import json
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from mpd import MPDClient
from pydantic import BaseModel

from mpd_client import get_client

STATIONS_FILE = Path("/data/stations.json")
DEFAULT_STATIONS_FILE = Path("default_stations.json")

app = FastAPI(title="IR10 Radio")
app.mount("/static", StaticFiles(directory="static"), name="static")


class StationIn(BaseModel):
    name: str
    url: str


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


def seed_default_stations():
    """On first run, copy default stations into the data volume."""
    stations = json.loads(DEFAULT_STATIONS_FILE.read_text())
    write_stations(stations)
    return stations


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
        {"index": i, "name": s["name"]} for i, s in enumerate(stations)
    ]


@app.post("/stations")
def add_station(station: StationIn, client: MPDClient = Depends(get_client)):
    stations = read_stations()
    stations.append({"name": station.name, "url": station.url})
    write_stations(stations)
    sync_to_mpd(client, stations)
    return {"status": "added", "name": station.name}


@app.delete("/stations/{station_index}")
def remove_station(station_index: int, client: MPDClient = Depends(get_client)):
    stations = read_stations()
    if station_index < 0 or station_index >= len(stations):
        raise HTTPException(status_code=404, detail="Station not found")
    removed = stations.pop(station_index)
    write_stations(stations)
    sync_to_mpd(client, stations)
    return {"status": "removed", "name": removed["name"]}


@app.post("/play/{station_index}")
def play_station(station_index: int, client: MPDClient = Depends(get_client)):
    stations = read_stations()
    if station_index < 0 or station_index >= len(stations):
        raise HTTPException(status_code=404, detail="Station not found")

    sync_to_mpd(client, stations)
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
        name = next((s["name"] for s in stations if s["url"] == url), url)
        return {"state": state, "station": name}

    return {"state": state, "station": None}
