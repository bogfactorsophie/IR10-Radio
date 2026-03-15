var POSITIONS = 12;
var DIAL_RADIUS = 80;
var NUMBER_RADIUS = 100;
var THUMB_RADIUS = 132;

var library = [];
var libraryUrls = new Set();
var dial = {};
var radioStatus = {};

// Selection state: either a library station or a dial position
var selection = null; // { stationId, sourcePosition } or null

// Desktop drag state (HTML5 DnD only, not used on touch)
var dragData = null;

// --- API ---

async function loadLibrary() {
    var res = await fetch("/library");
    library = await res.json();
    libraryUrls = new Set(library.map(function (s) { return s.url; }));
    renderLibrary();
}

async function loadDial() {
    var res = await fetch("/dial");
    dial = await res.json();
    renderDial();
    renderLibrary();
}

async function loadStatus() {
    var res = await fetch("/status");
    radioStatus = await res.json();
    updateStatus();
    updatePointer();
}

// --- Helpers ---

function getDialStationIds() {
    var ids = new Set();
    for (var pos in dial) {
        if (dial[pos] && dial[pos].id) ids.add(dial[pos].id);
    }
    return ids;
}

function positionOnCircle(angle, radius) {
    var rad = angle * Math.PI / 180;
    return { x: Math.sin(rad) * radius, y: -Math.cos(rad) * radius };
}

function placeElement(el, angle, radius) {
    var pos = positionOnCircle(angle, radius);
    el.style.left = "calc(50% + " + pos.x + "px)";
    el.style.top = "calc(50% + " + pos.y + "px)";
    el.style.transform = "translate(-50%, -50%)";
}

// --- Selection ---

function clearSelection() {
    selection = null;
    document.querySelectorAll(".library-item.selected")
        .forEach(function (el) { el.classList.remove("selected"); });
    document.querySelectorAll(".dial-thumb.selected")
        .forEach(function (el) { el.classList.remove("selected"); });
    updateHint("");
}

function selectLibraryStation(stationId) {
    if (selection && !selection.sourcePosition && selection.stationId === stationId) {
        clearSelection();
        return;
    }
    clearSelection();
    selection = { stationId: stationId, sourcePosition: null };
    document.querySelectorAll(".library-item").forEach(function (el) {
        el.classList.toggle("selected", el.dataset.stationId === stationId);
    });
    updateHint("tap a preset to assign");
}

function selectDialPosition(position, stationId) {
    if (selection && selection.sourcePosition === position) {
        clearSelection();
        return;
    }
    clearSelection();
    selection = { stationId: stationId, sourcePosition: position };
    document.querySelectorAll(".dial-thumb").forEach(function (el) {
        el.classList.toggle("selected", parseInt(el.dataset.position) === position);
    });
    updateHint("tap a preset to move, or tap again to clear");
}

function updateHint(text) {
    var hint = document.getElementById("selection-hint");
    hint.textContent = text;
}

// --- Dial rendering ---

function renderDial() {
    var container = document.getElementById("dial-container");
    container.querySelectorAll(".dial-tick, .dial-number, .dial-thumb, .standby-dot")
        .forEach(function (el) { el.remove(); });

    for (var i = 0; i < POSITIONS; i++) {
        var angle = i * 30;

        var tick = document.createElement("div");
        tick.className = "dial-tick";
        var tp = positionOnCircle(angle, DIAL_RADIUS);
        tick.style.left = "calc(50% + " + tp.x + "px)";
        tick.style.top = "calc(50% + " + tp.y + "px)";
        tick.style.transform = "translate(-50%, -50%) rotate(" + angle + "deg)";
        container.appendChild(tick);

        if (i === 0) {
            var dot = document.createElement("div");
            dot.className = "standby-dot";
            placeElement(dot, angle, NUMBER_RADIUS);
            container.appendChild(dot);
        } else {
            var num = document.createElement("div");
            num.className = "dial-number";
            if (radioStatus.dial_position === i) num.classList.add("active");
            placeElement(num, angle, NUMBER_RADIUS);
            num.textContent = String(i);
            container.appendChild(num);

            var thumb = createThumb(i, angle);
            container.appendChild(thumb);
        }
    }
}

function createThumb(position, angle) {
    var station = dial[String(position)];
    var thumb = document.createElement("div");
    thumb.className = "dial-thumb";
    thumb.dataset.position = position;
    placeElement(thumb, angle, THUMB_RADIUS);

    if (station) {
        thumb.classList.add("assigned");
        if (station.image) {
            var img = document.createElement("img");
            img.src = station.image;
            img.alt = station.name;
            img.onerror = function () {
                img.remove();
                var letter = document.createElement("span");
                letter.className = "thumb-letter";
                letter.textContent = station.name[0];
                thumb.appendChild(letter);
            };
            thumb.appendChild(img);
        } else {
            var letter = document.createElement("span");
            letter.className = "thumb-letter";
            letter.textContent = station.name[0];
            thumb.appendChild(letter);
        }
        thumb.title = station.name;

        // Tap: if something is selected, act on it; otherwise select this thumb
        thumb.onclick = function (e) {
            e.stopPropagation();
            if (selection) {
                if (selection.sourcePosition === position) {
                    // Tapped the same selected thumb — clear it
                    clearPosition(position);
                    clearSelection();
                } else if (selection.sourcePosition !== null) {
                    // Moving from another dial position — swap
                    moveStation(selection.sourcePosition, position, selection.stationId);
                    clearSelection();
                } else {
                    // Assigning from library — replace
                    assignStation(position, selection.stationId);
                    clearSelection();
                }
            } else {
                selectDialPosition(position, station.id);
            }
        };

        // Desktop drag (HTML5 DnD)
        thumb.draggable = true;
        thumb.addEventListener("dragstart", function (e) {
            dragData = { stationId: station.id, sourcePosition: position };
            e.dataTransfer.setData("text/plain", station.id);
            thumb.classList.add("dragging");
        });
        thumb.addEventListener("dragend", function () {
            thumb.classList.remove("dragging");
            dragData = null;
        });
    } else {
        thumb.classList.add("empty");
        thumb.onclick = function (e) {
            e.stopPropagation();
            if (selection) {
                if (selection.sourcePosition !== null) {
                    // Moving from dial to empty slot
                    moveStation(selection.sourcePosition, position, selection.stationId);
                } else {
                    // Assigning from library
                    assignStation(position, selection.stationId);
                }
                clearSelection();
            }
        };
    }

    // Desktop drop target
    thumb.addEventListener("dragover", function (e) {
        e.preventDefault();
        thumb.classList.add("drop-target");
    });
    thumb.addEventListener("dragleave", function () {
        thumb.classList.remove("drop-target");
    });
    thumb.addEventListener("drop", function (e) {
        e.preventDefault();
        thumb.classList.remove("drop-target");
        if (dragData) {
            if (dragData.sourcePosition !== null && dragData.sourcePosition !== undefined) {
                moveStation(dragData.sourcePosition, position, dragData.stationId);
            } else {
                assignStation(position, dragData.stationId);
            }
        }
    });

    return thumb;
}

function updatePointer() {
    var pointer = document.getElementById("dial-pointer");
    var angle = (radioStatus.dial_position || 0) * 30;
    pointer.style.transform = "rotate(" + angle + "deg)";
}

function updateStatus() {
    var stationEl = document.getElementById("status-station");
    var showEl = document.getElementById("status-show");

    if (radioStatus.state === "play" && radioStatus.station) {
        stationEl.textContent = radioStatus.station;
        showEl.textContent = radioStatus.show || "";
    } else {
        stationEl.textContent = radioStatus.dial_position === 0 ? "standby" : "";
        showEl.textContent = "";
    }

    document.querySelectorAll(".dial-number").forEach(function (el, i) {
        el.classList.toggle("active", (i + 1) === radioStatus.dial_position);
    });
}

// --- Dial interactions ---

async function assignStation(position, stationId) {
    await fetch("/dial/" + position, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ station_id: stationId })
    });
    await loadDial();
}

async function clearPosition(position) {
    await fetch("/dial/" + position, { method: "DELETE" });
    await loadDial();
}

async function moveStation(fromPos, toPos, stationId) {
    if (fromPos === toPos) return;
    var targetStation = dial[String(toPos)];
    await fetch("/dial/" + fromPos, { method: "DELETE" });
    await fetch("/dial/" + toPos, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ station_id: stationId })
    });
    if (targetStation && targetStation.id) {
        await fetch("/dial/" + fromPos, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ station_id: targetStation.id })
        });
    }
    await loadDial();
}

// --- Library ---

function renderLibrary() {
    var list = document.getElementById("library-list");
    list.innerHTML = "";
    var onDial = getDialStationIds();

    if (library.length === 0) {
        list.innerHTML = '<p class="empty-message">no stations saved</p>';
        return;
    }

    library.forEach(function (s) {
        var isOnDial = onDial.has(s.id);
        var item = document.createElement("div");
        item.className = "library-item";
        if (isOnDial) item.classList.add("on-dial");
        item.dataset.stationId = s.id;

        var name = document.createElement("span");
        name.textContent = s.name;
        item.appendChild(name);

        var remove = document.createElement("button");
        remove.className = "remove";
        remove.textContent = "\u00d7";
        remove.title = "remove from library";
        remove.onclick = async function (e) {
            e.stopPropagation();
            await fetch("/library/" + s.id, { method: "DELETE" });
            await Promise.all([loadLibrary(), loadDial()]);
        };
        item.appendChild(remove);

        if (!isOnDial) {
            item.onclick = function (e) {
                e.stopPropagation();
                selectLibraryStation(s.id);
            };

            // Desktop drag
            item.draggable = true;
            item.addEventListener("dragstart", function (e) {
                dragData = { stationId: s.id, sourcePosition: null };
                e.dataTransfer.setData("text/plain", s.id);
                item.classList.add("dragging");
            });
            item.addEventListener("dragend", function () {
                item.classList.remove("dragging");
                dragData = null;
            });
        }

        list.appendChild(item);
    });
}

// --- Search ---

function renderSearchResults(results) {
    var container = document.getElementById("search-results");
    container.innerHTML = "";

    if (results.length === 0) {
        container.innerHTML = '<p class="empty-message">no results</p>';
        return;
    }

    results.forEach(function (s) {
        var item = document.createElement("div");
        item.className = "search-result";

        var info = document.createElement("div");
        info.className = "result-info";

        var rname = document.createElement("div");
        rname.className = "result-name";
        rname.textContent = s.name;
        info.appendChild(rname);

        var parts = [s.country, s.tags, s.bitrate ? s.bitrate + "kbps" : ""]
            .filter(Boolean);
        if (parts.length) {
            var detail = document.createElement("div");
            detail.className = "result-detail";
            detail.textContent = parts.join(" \u00b7 ");
            info.appendChild(detail);
        }

        item.appendChild(info);

        var btn = document.createElement("button");
        if (libraryUrls.has(s.url)) {
            btn.textContent = "added";
            btn.disabled = true;
        } else {
            btn.textContent = "add";
            btn.onclick = async function () {
                await fetch("/library", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: s.name, url: s.url, image: s.image })
                });
                btn.textContent = "added";
                btn.disabled = true;
                await loadLibrary();
            };
        }
        item.appendChild(btn);
        container.appendChild(item);
    });
}

// --- Event listeners ---

var searchTimer = null;

async function doSearch(query) {
    var container = document.getElementById("search-results");
    if (!query || query.length < 2) {
        container.innerHTML = "";
        return;
    }
    container.innerHTML = '<p class="empty-message">searching\u2026</p>';
    try {
        var res = await fetch("/search?q=" + encodeURIComponent(query));
        renderSearchResults(await res.json());
    } catch (_) {
        container.innerHTML = '<p class="empty-message">search failed</p>';
    }
}

document.getElementById("search-query").addEventListener("input", function () {
    clearTimeout(searchTimer);
    var query = this.value.trim();
    if (!query) {
        document.getElementById("search-results").innerHTML = "";
        return;
    }
    searchTimer = setTimeout(function () { doSearch(query); }, 350);
});

document.getElementById("add-url-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var nameInput = document.getElementById("add-name");
    var urlInput = document.getElementById("add-url");
    await fetch("/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameInput.value, url: urlInput.value })
    });
    nameInput.value = "";
    urlInput.value = "";
    await loadLibrary();
});

// Library grid as desktop drop target (drag from dial = clear position)
var libraryGrid = document.getElementById("library-list");
libraryGrid.addEventListener("dragover", function (e) {
    if (dragData && dragData.sourcePosition !== null) {
        e.preventDefault();
        libraryGrid.classList.add("drop-target");
    }
});
libraryGrid.addEventListener("dragleave", function () {
    libraryGrid.classList.remove("drop-target");
});
libraryGrid.addEventListener("drop", function (e) {
    e.preventDefault();
    libraryGrid.classList.remove("drop-target");
    if (dragData && dragData.sourcePosition !== null) {
        clearPosition(dragData.sourcePosition);
    }
});

// Deselect when clicking outside interactive elements
document.addEventListener("click", function (e) {
    if (!e.target.closest(".library-item") && !e.target.closest(".dial-thumb")) {
        clearSelection();
    }
});

// --- Listen button ---

var listenAudio = null;

function stopListen() {
    var btn = document.getElementById("listen-btn");
    if (listenAudio) {
        listenAudio.pause();
        listenAudio.removeAttribute("src");
        listenAudio.load();
        listenAudio = null;
    }
    btn.textContent = "listen here";
    btn.classList.remove("active");
}

function toggleListen() {
    var btn = document.getElementById("listen-btn");
    if (listenAudio) {
        stopListen();
    } else {
        var streamUrl = location.protocol + "//" + location.hostname + ":8000?t=" + Date.now();
        listenAudio = new Audio(streamUrl);
        listenAudio.addEventListener("error", stopListen);
        listenAudio.play().then(function () {
            btn.textContent = "stop";
            btn.classList.add("active");
        }).catch(function (err) {
            console.error("Listen failed:", err);
            listenAudio = null;
        });
    }
}

// --- Init ---

Promise.all([loadLibrary(), loadDial(), loadStatus()]);
setInterval(loadStatus, 3000);
setInterval(function () { loadLibrary(); loadDial(); }, 10000);
