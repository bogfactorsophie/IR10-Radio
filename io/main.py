"""Rotary dial reader for IR10 Radio."""

import logging
import os
import time

import httpx

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("io")

WEB_BASE = "http://web"

# GPIO pins for 12-position rotary switch (0=standby, 1-11=presets)
DIAL_PINS = {
    0: 4,
    1: 5,
    2: 6,
    3: 12,
    4: 13,
    5: 16,
    6: 17,
    7: 22,
    8: 23,
    9: 24,
    10: 25,
    11: 26,
}

POLL_INTERVAL = 0.05
DEBOUNCE_TIME = 0.1


def dev_mode():
    """No GPIO — play default position once, then idle."""
    position = int(os.environ.get("DEFAULT_DIAL_POSITION") or "0")
    log.info("Dev mode, default position: %d", position)
    if position <= 0:
        return

    client = httpx.Client(base_url=WEB_BASE, timeout=10)

    # Wait for web service
    for attempt in range(30):
        try:
            r = client.get("/health")
            if r.status_code == 200:
                log.info("Web service ready")
                break
        except httpx.HTTPError:
            pass
        if attempt % 5 == 4:
            log.warning("Waiting for web service... (%ds)", attempt + 1)
        time.sleep(1)

    try:
        client.post(f"/dial/{position}/play")
        log.info("Playing preset %d", position)
    except httpx.HTTPError as e:
        log.error("Failed to play preset %d: %s", position, e)

    # Idle forever
    while True:
        time.sleep(60)


def hardware_mode():
    """Read physical rotary switch and drive playback via web API."""
    from gpiozero import Button

    log.info("Initialising GPIO pins...")
    buttons = {}
    for position, pin in DIAL_PINS.items():
        buttons[position] = Button(pin, pull_up=True, bounce_time=None)
    log.info("GPIO ready — %d pins configured", len(buttons))

    client = httpx.Client(base_url=WEB_BASE, timeout=5)

    # Wait for web service
    for attempt in range(30):
        try:
            r = client.get("/health")
            if r.status_code == 200:
                log.info("Web service ready")
                break
        except httpx.HTTPError:
            pass
        if attempt % 5 == 4:
            log.warning("Waiting for web service... (%ds)", attempt + 1)
        time.sleep(1)

    log.info("Polling dial...")
    last_position = None
    stable_position = None
    stable_since = 0

    while True:
        # Read current position (active-low: pressed = connected to ground)
        current = None
        for position, button in buttons.items():
            if button.is_pressed:
                current = position
                break

        # Debounce
        if current != stable_position:
            stable_position = current
            stable_since = time.monotonic()
        elif (
            stable_position != last_position
            and (time.monotonic() - stable_since) >= DEBOUNCE_TIME
        ):
            last_position = stable_position
            try:
                if stable_position is None or stable_position == 0:
                    log.info("Dial → standby")
                    client.post("/standby")
                else:
                    log.info("Dial → preset %d", stable_position)
                    client.post(f"/dial/{stable_position}/play")
            except httpx.HTTPError as e:
                log.error("API call failed: %s", e)

        time.sleep(POLL_INTERVAL)


def main():
    try:
        import gpiozero  # noqa: F401

        hardware_mode()
    except Exception as e:
        log.warning("GPIO unavailable (%s), entering dev mode", e)
        dev_mode()


if __name__ == "__main__":
    main()
