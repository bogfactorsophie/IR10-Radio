const DIAL_SLOTS = 11;
let library = [];
let libraryUrls = new Set();
let dial = {};
let lastSearchResults = null;

async function loadLibrary() {
    const res = await fetch("/library");
    library = await res.json();
    libraryUrls = new Set(library.map(s => s.url));
    renderLibrary();
    if (lastSearchResults) renderSearchResults(lastSearchResults);
}

function renderLibrary() {
    const list = document.getElementById("library-list");
    list.innerHTML = "";
    library.forEach(s => {
        const li = document.createElement("li");
        li.textContent = s.name + " ";

        const removeBtn = document.createElement("button");
        removeBtn.textContent = "Remove";
        removeBtn.onclick = async () => {
            await fetch(`/library/${s.id}`, { method: "DELETE" });
            loadLibrary();
            loadDial();
        };
        li.appendChild(removeBtn);
        list.appendChild(li);
    });
}

async function loadDial() {
    const res = await fetch("/dial");
    dial = await res.json();
    renderDial();
}

function renderDial() {
    const list = document.getElementById("dial-list");
    list.innerHTML = "";
    for (let i = 1; i <= DIAL_SLOTS; i++) {
        const slot = dial[String(i)];
        const li = document.createElement("li");

        const label = document.createElement("strong");
        label.textContent = `${i}: `;
        li.appendChild(label);

        if (slot) {
            li.appendChild(document.createTextNode(slot.name + " "));
            const clearBtn = document.createElement("button");
            clearBtn.textContent = "Clear";
            clearBtn.onclick = async () => {
                await fetch(`/dial/${i}`, { method: "DELETE" });
                loadDial();
            };
            li.appendChild(clearBtn);
        } else {
            // Dropdown to assign a station
            const select = document.createElement("select");
            const emptyOpt = document.createElement("option");
            emptyOpt.value = "";
            emptyOpt.textContent = "(empty)";
            select.appendChild(emptyOpt);
            library.forEach(s => {
                const opt = document.createElement("option");
                opt.value = s.id;
                opt.textContent = s.name;
                select.appendChild(opt);
            });
            select.onchange = async () => {
                if (!select.value) return;
                await fetch(`/dial/${i}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ station_id: select.value })
                });
                loadDial();
            };
            li.appendChild(select);
        }
        list.appendChild(li);
    }
}

async function loadStatus() {
    const res = await fetch("/status");
    const data = await res.json();
    const el = document.getElementById("status");
    const img = document.getElementById("station-image");
    if (data.state === "play" && data.station) {
        el.textContent = data.show ? `${data.station} — ${data.show}` : data.station;
        img.src = data.image || "";
    } else {
        el.textContent = data.dial_position === 0 ? "Standby" : "Stopped";
        img.src = "";
    }
}

async function goStandby() {
    await fetch("/standby", { method: "POST" });
    loadStatus();
}

function toggleAddUrl() {
    const section = document.getElementById("add-url-section");
    section.style.display = section.style.display === "none" ? "" : "none";
}

async function addStation(e) {
    e.preventDefault();
    const name = document.getElementById("add-name").value;
    const url = document.getElementById("add-url").value;
    await fetch("/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, url })
    });
    document.getElementById("add-name").value = "";
    document.getElementById("add-url").value = "";
    loadLibrary();
    loadDial();
}

function renderSearchResults(results) {
    const list = document.getElementById("search-results");
    list.innerHTML = "";
    if (results.length === 0) {
        list.innerHTML = "<li>No stations found</li>";
        return;
    }
    results.forEach(s => {
        const li = document.createElement("li");
        let label = s.name;
        const details = [s.country, s.tags, s.bitrate ? `${s.bitrate}kbps` : ""].filter(Boolean);
        if (details.length) label += ` (${details.join(" · ")})`;
        li.textContent = label + " ";
        const addBtn = document.createElement("button");
        if (libraryUrls.has(s.url)) {
            addBtn.textContent = "Added";
            addBtn.disabled = true;
        } else {
            addBtn.textContent = "Add";
        }
        addBtn.onclick = async () => {
            await fetch("/library", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: s.name, url: s.url, image: s.image })
            });
            addBtn.textContent = "Added";
            addBtn.disabled = true;
            loadLibrary();
            loadDial();
        };
        li.appendChild(addBtn);
        list.appendChild(li);
    });
}

async function searchStations(e) {
    e.preventDefault();
    const query = document.getElementById("search-query").value;
    document.getElementById("search-results").innerHTML = "<li>Searching...</li>";
    const res = await fetch(`/search?q=${encodeURIComponent(query)}`);
    lastSearchResults = await res.json();
    renderSearchResults(lastSearchResults);
}

loadLibrary();
loadDial();
loadStatus();
setInterval(loadStatus, 10000);
