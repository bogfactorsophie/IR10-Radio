import json
import os
import uuid
from pathlib import Path

import httpx

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from mpd import MPDClient
from pydantic import BaseModel

from mpd_client import get_client

RADIO_BROWSER_API = "https://de1.api.radio-browser.info"

LIBRARY_FILE = Path("/data/library.json")
DIAL_FILE = Path("/data/dial.json")
STATIONS_FILE = Path("/data/stations.json")
DEFAULT_STATIONS_FILE = Path("default_stations.json")
DIAL_SLOTS = 11

DEFAULT_DIAL_POSITION = int(os.environ.get("DEFAULT_DIAL_POSITION") or "0")
DEFAULT_VOLUME = int(os.environ.get("DEFAULT_VOLUME") or "50")

# Runtime state
current_dial_position = 0
current_volume = DEFAULT_VOLUME

app = FastAPI(title="IR10 Radio")
app.mount("/static", StaticFiles(directory="static"), name="static")


# --- Data model ---


def read_library():
    if LIBRARY_FILE.exists():
        return json.loads(LIBRARY_FILE.read_text())
    return []


def write_library(library):
    LIBRARY_FILE.parent.mkdir(parents=True, exist_ok=True)
    LIBRARY_FILE.write_text(json.dumps(library, indent=2))


def read_dial():
    if DIAL_FILE.exists():
        return json.loads(DIAL_FILE.read_text())
    return {str(i): None for i in range(1, DIAL_SLOTS + 1)}


def write_dial(dial):
    DIAL_FILE.parent.mkdir(parents=True, exist_ok=True)
    DIAL_FILE.write_text(json.dumps(dial, indent=2))


def get_station_by_id(station_id):
    for s in read_library():
        if s["id"] == station_id:
            return s
    return None


def generate_id():
    return uuid.uuid4().hex[:8]


def migrate_from_stations():
    """One-time migration from stations.json to library.json + dial.json."""
    if LIBRARY_FILE.exists():
        return
    if STATIONS_FILE.exists():
        stations = json.loads(STATIONS_FILE.read_text())
    elif DEFAULT_STATIONS_FILE.exists():
        stations = json.loads(DEFAULT_STATIONS_FILE.read_text())
    else:
        stations = []

    library = []
    dial = {str(i): None for i in range(1, DIAL_SLOTS + 1)}

    for i, s in enumerate(stations):
        sid = generate_id()
        entry = {"id": sid, "name": s["name"], "url": s["url"]}
        if s.get("image"):
            entry["image"] = s["image"]
        library.append(entry)
        if i < DIAL_SLOTS:
            dial[str(i + 1)] = sid

    write_library(library)
    write_dial(dial)


# --- Startup ---


@app.on_event("startup")
def startup_sync():
    global current_volume
    import time

    migrate_from_stations()

    # Wait for MPD to be ready
    for attempt in range(30):
        try:
            client_gen = get_client()
            client = next(client_gen)
            break
        except Exception:
            time.sleep(1)
    else:
        return

    try:
        client.clear()
        client.setvol(current_volume)

        if DEFAULT_DIAL_POSITION > 0:
            _play_dial_position(client, DEFAULT_DIAL_POSITION)
    finally:
        try:
            next(client_gen)
        except StopIteration:
            pass


def _play_dial_position(client, position):
    """Play the station at a dial position, or static noise if empty."""
    global current_dial_position

    dial = read_dial()
    station_id = dial.get(str(position))
    station = get_station_by_id(station_id) if station_id else None

    client.clear()
    client.repeat(0)

    if station:
        client.add(station["url"])
    else:
        client.add("static.wav")
        client.repeat(1)

    client.play(0)
    current_dial_position = position


# --- Request models ---


class StationIn(BaseModel):
    name: str
    url: str
    image: str = ""


class DialAssign(BaseModel):
    station_id: str


# --- Library endpoints ---


@app.get("/library")
def list_library():
    return read_library()


@app.post("/library")
def add_to_library(station: StationIn):
    library = read_library()
    if any(s["url"] == station.url for s in library):
        raise HTTPException(status_code=409, detail="Station already in library")
    entry = {"id": generate_id(), "name": station.name, "url": station.url}
    if station.image:
        entry["image"] = station.image
    library.append(entry)
    write_library(library)
    return entry


@app.delete("/library/{station_id}")
def remove_from_library(station_id: str):
    library = read_library()
    entry = next((s for s in library if s["id"] == station_id), None)
    if not entry:
        raise HTTPException(status_code=404, detail="Station not found")

    library = [s for s in library if s["id"] != station_id]
    write_library(library)

    # Clear from any dial slots
    dial = read_dial()
    changed = False
    for pos in dial:
        if dial[pos] == station_id:
            dial[pos] = None
            changed = True
    if changed:
        write_dial(dial)

    return {"status": "removed", "name": entry["name"]}


# --- Dial endpoints ---


@app.get("/dial")
def get_dial():
    dial = read_dial()
    result = {}
    for pos, station_id in dial.items():
        if station_id:
            station = get_station_by_id(station_id)
            result[pos] = station
        else:
            result[pos] = None
    return result


@app.put("/dial/{position}")
def assign_dial(
    position: int, body: DialAssign, client: MPDClient = Depends(get_client)
):
    if position < 1 or position > DIAL_SLOTS:
        raise HTTPException(status_code=400, detail="Position must be 1-11")
    station = get_station_by_id(body.station_id)
    if not station:
        raise HTTPException(status_code=404, detail="Station not found in library")
    dial = read_dial()
    dial[str(position)] = body.station_id
    write_dial(dial)
    if position == current_dial_position:
        _play_dial_position(client, position)
    return {"status": "assigned", "position": position, "station": station}


@app.delete("/dial/{position}")
def clear_dial(position: int, client: MPDClient = Depends(get_client)):
    if position < 1 or position > DIAL_SLOTS:
        raise HTTPException(status_code=400, detail="Position must be 1-11")
    dial = read_dial()
    dial[str(position)] = None
    write_dial(dial)
    if position == current_dial_position:
        _play_dial_position(client, position)
    return {"status": "cleared", "position": position}


# --- Playback endpoints ---


@app.post("/dial/{position}/play")
def play_position(position: int, client: MPDClient = Depends(get_client)):
    if position < 1 or position > DIAL_SLOTS:
        raise HTTPException(status_code=400, detail="Position must be 1-11")
    _play_dial_position(client, position)
    return {"status": "playing", "position": position}


@app.post("/standby")
def standby(client: MPDClient = Depends(get_client)):
    global current_dial_position
    client.stop()
    client.clear()
    current_dial_position = 0
    return {"status": "standby"}


@app.post("/volume/{level}")
def set_volume(level: int, client: MPDClient = Depends(get_client)):
    global current_volume
    if level < 0 or level > 100:
        raise HTTPException(status_code=400, detail="Volume must be 0-100")
    client.setvol(level)
    current_volume = level
    return {"status": "ok", "volume": level}


@app.get("/status")
def get_status(client: MPDClient = Depends(get_client)):
    mpd_status = client.status()
    state = mpd_status.get("state", "stop")

    station = None
    show = None
    image = None

    if state == "play":
        song = client.currentsong()
        url = song.get("file", "")
        if url == "static.wav":
            station = "Static"
        else:
            lib = read_library()
            match = next((s for s in lib if s["url"] == url), None)
            if match:
                station = match["name"]
                image = match.get("image")
            else:
                station = url
        show = song.get("title", "").strip(" -") or None
        if show and len(show) > 100:
            show = None

    return {
        "state": state,
        "dial_position": current_dial_position,
        "station": station,
        "show": show,
        "image": image,
        "volume": current_volume,
    }


# --- Search (unchanged) ---


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


# --- Static routes ---


@app.get("/")
def index():
    return FileResponse("static/index.html")


@app.get("/health")
def health():
    return {"status": "ok"}
