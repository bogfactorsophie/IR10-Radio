# Raspberry Pi Zero 2W — Component List

## Core Board

- **Raspberry Pi Zero 2W** (with pre-soldered headers)

## Audio

- **Pimoroni Audio Amp SHIM (3W Mono Amp)** — MAX98357A I2S DAC/amplifier
  - Uses: GPIO 18 (PCM_CLK), GPIO 19 (PCM_FS), GPIO 21 (PCM_DOUT), 3.3V, 5V, GND
  - Friction-fits directly onto GPIO pins, no soldering required
  - [Product page](https://shop.pimoroni.com/products/audio-amp-shim-3w-mono-amp)
- **Compatible speaker** — any unpowered speaker with tinned wire ends (max 0.75mm² / 18AWG)

## Pin Usage

| Board | Interface | GPIOs Used (BCM) |
|---|---|---|
| Audio Amp SHIM | I2S (PCM) | 18, 19, 21 |

## Physical Stack Order (bottom to top)

1. Raspberry Pi Zero 2W
2. Pimoroni Audio Amp SHIM (friction-fit onto GPIO pins)

## Software Configuration

Enable I2S audio by adding to `/boot/config.txt`:

```
dtoverlay=hifiberry-dac
```
