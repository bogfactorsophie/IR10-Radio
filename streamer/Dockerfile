FROM alpine:3.19

RUN apk add --no-cache mpd mpc

COPY mpd.conf /etc/mpd.conf
COPY stations.m3u /var/lib/mpd/playlists/stations.m3u

EXPOSE 6600

CMD ["mpd", "--no-daemon", "/etc/mpd.conf"]
