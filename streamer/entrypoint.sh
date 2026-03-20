#!/bin/sh
set -e

# Copy static noise into the volume (image COPY is hidden by the mount)
cp /static.wav /var/lib/mpd/music/static.wav

# Start MPD, trigger a database update, then wait for it
exec mpd --no-daemon /etc/mpd.conf &
MPD_PID=$!
sleep 1
mpc update --wait >/dev/null 2>&1 || true
wait $MPD_PID
