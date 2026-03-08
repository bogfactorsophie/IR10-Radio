"""MPD client helper for connecting to the streamer service."""

from mpd import MPDClient, ConnectionError as MPDConnectionError


MPD_HOST = "streamer"
MPD_PORT = 6600


def get_client():
    """Connect to MPD and yield a client. Closes connection after use."""
    client = MPDClient()
    client.timeout = 5
    try:
        client.connect(MPD_HOST, MPD_PORT)
        yield client
    finally:
        try:
            client.close()
            client.disconnect()
        except MPDConnectionError:
            pass
