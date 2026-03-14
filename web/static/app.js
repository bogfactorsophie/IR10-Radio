var POSITIONS = 12;
var DIAL_RADIUS = 80;
var NUMBER_RADIUS = 100;
var THUMB_RADIUS = 132;

var library = [];
var libraryUrls = new Set();
var dial = {};
var radioStatus = {};
var selectedStationId = null;

// Drag state shared by HTML5 DnD and touch
var dragData = null; // { stationId, sourcePosition }
var touchDrag = null;
var touchDragJustEnded = false;

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

// --- Dial rendering ---

function renderDial() {
    var container = document.getElementById("dial-container");
    container.querySelectorAll(".dial-tick, .dial-number, .dial-thumb, .standby-dot")
        .forEach(function (el) { el.remove(); });

    for (var i = 0; i < POSITIONS; i++) {
        var angle = i * 30;

        // Tick mark
        var tick = document.createElement("div");
        tick.className = "dial-tick";
        var tp = positionOnCircle(angle, DIAL_RADIUS);
        tick.style.left = "calc(50% + " + tp.x + "px)";
        tick.style.top = "calc(50% + " + tp.y + "px)";
        tick.style.transform = "translate(-50%, -50%) rotate(" + angle + "deg)";
        container.appendChild(tick);

        if (i === 0) {
            // Standby: small muted orange dot instead of "0"
            var dot = document.createElement("div");
            dot.className = "standby-dot";
            placeElement(dot, angle, NUMBER_RADIUS);
            container.appendChild(dot);
        } else {
            // Number label
            var num = document.createElement("div");
            num.className = "dial-number";
            if (radioStatus.dial_position === i) num.classList.add("active");
            placeElement(num, angle, NUMBER_RADIUS);
            num.textContent = String(i);
            container.appendChild(num);

            // Thumbnail
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
        thumb.title = station.name + " (click to clear)";
        thumb.onclick = function () {
            if (touchDragJustEnded) return;
            clearPosition(position);
        };

        // Make assigned thumbs draggable (desktop)
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

        // Touch drag for assigned thumbs
        setupTouchDrag(thumb, station.id, position, station.name);
    } else {
        thumb.classList.add("empty");
        thumb.onclick = function () {
            if (touchDragJustEnded) return;
            assignSelected(position);
        };
    }

    // Drop target (accepts from library or other dial positions)
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

    // Update active number highlight
    document.querySelectorAll(".dial-number").forEach(function (el, i) {
        // Numbers start at position 1 (position 0 is the standby dot)
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
    selectedStationId = null;
    document.querySelectorAll(".library-item.selected")
        .forEach(function (el) { el.classList.remove("selected"); });
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

function assignSelected(position) {
    if (selectedStationId) assignStation(position, selectedStationId);
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
            // Only allow dragging/selecting for stations not already on dial
            item.draggable = true;

            item.onclick = function () {
                if (touchDragJustEnded) return;
                selectedStationId = selectedStationId === s.id ? null : s.id;
                document.querySelectorAll(".library-item").forEach(function (el) {
                    el.classList.toggle("selected", el.dataset.stationId === selectedStationId);
                });
            };

            item.addEventListener("dragstart", function (e) {
                dragData = { stationId: s.id, sourcePosition: null };
                e.dataTransfer.setData("text/plain", s.id);
                item.classList.add("dragging");
            });
            item.addEventListener("dragend", function () {
                item.classList.remove("dragging");
                dragData = null;
            });

            setupTouchDrag(item, s.id, null, s.name);
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

// --- Touch drag ---

function setupTouchDrag(el, stationId, sourcePosition, label) {
    el.addEventListener("touchstart", function (e) {
        var touch = e.touches[0];
        touchDrag = {
            stationId: stationId,
            sourcePosition: sourcePosition,
            label: label,
            startX: touch.clientX,
            startY: touch.clientY,
            active: false,
            clone: null,
            currentTarget: null
        };
    }, { passive: true });
}

document.addEventListener("touchmove", function (e) {
    if (!touchDrag) return;
    var touch = e.touches[0];
    var dx = touch.clientX - touchDrag.startX;
    var dy = touch.clientY - touchDrag.startY;

    if (!touchDrag.active) {
        if (Math.abs(dx) + Math.abs(dy) < 10) return;
        // Vertical movement = scroll, cancel drag
        if (Math.abs(dy) > Math.abs(dx)) {
            touchDrag = null;
            return;
        }
        touchDrag.active = true;
        var clone = document.createElement("div");
        clone.className = "drag-clone";
        clone.textContent = touchDrag.label;
        document.body.appendChild(clone);
        touchDrag.clone = clone;
    }

    e.preventDefault();
    touchDrag.clone.style.left = touch.clientX + "px";
    touchDrag.clone.style.top = touch.clientY + "px";

    // Detect drop target under finger
    touchDrag.clone.style.display = "none";
    var el = document.elementFromPoint(touch.clientX, touch.clientY);
    touchDrag.clone.style.display = "";

    var target = el ? (el.closest(".dial-thumb") || el.closest(".library-grid")) : null;
    if (touchDrag.currentTarget !== target) {
        if (touchDrag.currentTarget) touchDrag.currentTarget.classList.remove("drop-target");
        if (target) target.classList.add("drop-target");
        touchDrag.currentTarget = target;
    }
}, { passive: false });

document.addEventListener("touchend", function () {
    if (!touchDrag) return;
    if (!touchDrag.active) {
        touchDrag = null;
        return;
    }

    var target = touchDrag.currentTarget;
    if (target) {
        target.classList.remove("drop-target");
        if (target.classList.contains("dial-thumb")) {
            var pos = parseInt(target.dataset.position);
            if (touchDrag.sourcePosition !== null && touchDrag.sourcePosition !== undefined) {
                moveStation(touchDrag.sourcePosition, pos, touchDrag.stationId);
            } else {
                assignStation(pos, touchDrag.stationId);
            }
        } else if (target.classList.contains("library-grid") &&
                   touchDrag.sourcePosition !== null && touchDrag.sourcePosition !== undefined) {
            clearPosition(touchDrag.sourcePosition);
        }
    }

    if (touchDrag.clone) touchDrag.clone.remove();
    touchDrag = null;
    touchDragJustEnded = true;
    setTimeout(function () { touchDragJustEnded = false; }, 100);
});

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

// Library grid as drop target (drag back from dial = clear position)
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

// Deselect when clicking outside
document.addEventListener("click", function (e) {
    if (!e.target.closest(".library-item") && !e.target.closest(".dial-thumb")) {
        selectedStationId = null;
        document.querySelectorAll(".library-item.selected")
            .forEach(function (el) { el.classList.remove("selected"); });
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
