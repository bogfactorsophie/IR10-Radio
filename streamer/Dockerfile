FROM alpine:3.19

RUN apk add --no-cache mpd mpc lame

RUN mkdir -p /var/lib/mpd/music /var/lib/mpd/playlists /var/log/mpd && \
    chown -R mpd:audio /var/lib/mpd /var/log/mpd

COPY vinyl-crackling-11_150bpm.wav /static.wav
COPY mpd.conf /etc/mpd.conf
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 6600 8000

CMD ["/entrypoint.sh"]
