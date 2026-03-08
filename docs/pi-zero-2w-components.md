# Raspberry Pi Zero 2W — Component List

## Core Board

- **Raspberry Pi Zero 2W** (with pre-soldered headers)

## Audio

- **Pimoroni Audio Amp SHIM (3W Mono Amp)** — MAX98357A I2S DAC/amplifier
  - Uses: GPIO 18 (PCM_CLK), GPIO 19 (PCM_FS), GPIO 21 (PCM_DOUT), 3.3V, 5V, GND
  - Friction-fits directly onto GPIO pins, no soldering required
  - [Product page](https://shop.pimoroni.com/products/audio-amp-shim-3w-mono-amp)
- **Compatible speaker** — any unpowered speaker with tinned wire ends (max 0.75mm² / 18AWG)

## Display

- **Waveshare 2.23inch OLED Display HAT** — 128×32 pixels, SSD1305 driver, SPI (default)
  - Uses: GPIO 10 (MOSI), GPIO 11 (SCLK), GPIO 8 (CE0), GPIO 24 (DC), GPIO 25 (RST), 3.3V, GND
  - Comes with RPi screws pack (2 pieces)
  - [Product page](https://www.waveshare.com/2.23inch-oled-hat.htm)
  - [Wiki](https://www.waveshare.com/wiki/2.23inch_OLED_HAT)

## Connector

- **GPIO Riser Header** — 2x20 pin, 2.54mm spacing, 5mm pin length
  - Sits between the Audio Amp SHIM and the OLED HAT for clearance
  - [Product page](https://thepihut.com/products/gpio-riser-header-for-raspberry-pi)

## Pin Conflict Summary

| Board | Interface | GPIOs Used (BCM) |
|---|---|---|
| Audio Amp SHIM | I2S (PCM) | 18, 19, 21 |
| Waveshare OLED HAT | SPI0 + GPIO | 8, 10, 11, 24, 25 |

**No conflicts.** The two boards use entirely separate GPIO pins and peripheral buses.

## Physical Stack Order (bottom to top)

1. Raspberry Pi Zero 2W
2. Pimoroni Audio Amp SHIM (friction-fit onto GPIO pins)
3. GPIO Riser Header (plugged over SHIM onto pins)
4. Waveshare 2.23inch OLED HAT (plugged onto riser header)

## Software Configuration

Enable I2S audio by adding to `/boot/config.txt`:

```
dtoverlay=hifiberry-dac
```

Enable SPI for the OLED display:

```bash
sudo raspi-config
# Interfacing Options -> SPI -> Yes
```
