"""Rotary dial reader for IR10 Radio."""

import os
import time

import httpx

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
    if position <= 0:
        return

    client = httpx.Client(base_url=WEB_BASE, timeout=10)

    # Wait for web service
    for _ in range(30):
        try:
            r = client.get("/health")
            if r.status_code == 200:
                break
        except httpx.HTTPError:
            pass
        time.sleep(1)

    try:
        client.post(f"/dial/{position}/play")
    except httpx.HTTPError:
        pass

    # Idle forever
    while True:
        time.sleep(60)


def hardware_mode():
    """Read physical rotary switch and drive playback via web API."""
    from gpiozero import Button

    buttons = {}
    for position, pin in DIAL_PINS.items():
        buttons[position] = Button(pin, pull_up=True, bounce_time=None)

    client = httpx.Client(base_url=WEB_BASE, timeout=5)

    # Wait for web service
    for _ in range(30):
        try:
            r = client.get("/health")
            if r.status_code == 200:
                break
        except httpx.HTTPError:
            pass
        time.sleep(1)

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
                    client.post("/standby")
                else:
                    client.post(f"/dial/{stable_position}/play")
            except httpx.HTTPError:
                pass

        time.sleep(POLL_INTERVAL)


def main():
    try:
        import gpiozero  # noqa: F401

        hardware_mode()
    except ImportError:
        dev_mode()


if __name__ == "__main__":
    main()
