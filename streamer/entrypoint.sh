#!/bin/sh
set -e

exec mpd --no-daemon /etc/mpd.conf
