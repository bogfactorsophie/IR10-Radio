FROM alpine:3.19

RUN apk add --no-cache mpd mpc lame

RUN mkdir -p /var/lib/mpd/music /var/lib/mpd/playlists /var/log/mpd && \
    chown -R mpd:audio /var/lib/mpd /var/log/mpd

COPY mpd.conf /etc/mpd.conf
COPY stations.m3u /etc/mpd/stations.m3u
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 6600 8000

CMD ["/entrypoint.sh"]
