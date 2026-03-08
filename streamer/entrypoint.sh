#!/bin/sh
set -e

# Copy playlist from image into the volume so updates are picked up on rebuild
cp /etc/mpd/stations.m3u /var/lib/mpd/playlists/stations.m3u

# Start MPD in the background
mpd --no-daemon /etc/mpd.conf &
MPD_PID=$!

# Wait for MPD to accept connections
until mpc -q status 2>/dev/null; do
    sleep 0.5
done

# Load stations playlist and start playing
mpc clear
mpc load stations
mpc play 1

# Hand control back to MPD
wait $MPD_PID
