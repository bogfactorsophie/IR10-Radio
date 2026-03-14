#!/bin/bash
# setup-pi.sh — Provision a fresh Raspbian OS install for the radio project.
# Run as root or with sudo on the Raspberry Pi Zero 2W.

set -euo pipefail

echo "==> Updating system packages"
apt-get update

# --- I2S audio (Pimoroni Audio Amp SHIM / MAX98357A) ---
echo "==> Enabling I2S audio overlay"
if ! grep -q "^dtoverlay=hifiberry-dac" /boot/config.txt; then
    echo "dtoverlay=hifiberry-dac" >> /boot/config.txt
    echo "    Added hifiberry-dac overlay to /boot/config.txt"
else
    echo "    hifiberry-dac overlay already present"
fi

# Disable onboard audio so ALSA defaults to the I2S DAC
if ! grep -q "^dtparam=audio=off" /boot/config.txt; then
    sed -i 's/^dtparam=audio=on/dtparam=audio=off/' /boot/config.txt
    echo "    Disabled onboard audio"
fi

# --- SPI (Waveshare OLED HAT) ---
echo "==> Enabling SPI"
raspi-config nonint do_spi 0

# --- Docker ---
echo "==> Installing Docker"
if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sh
    apt-get install -y docker-compose-plugin
    echo "    Docker installed"
else
    echo "    Docker already installed"
fi

# Let the default 'pi' user run docker without sudo
usermod -aG docker "$(logname)" 2>/dev/null || true

# --- mDNS (Avahi) ---
echo "==> Installing Avahi for mDNS (radio.local)"
apt-get install -y avahi-daemon

echo "==> Setting hostname to 'radio'"
echo "radio" > /etc/hostname
sed -i 's/127\.0\.1\.1.*/127.0.1.1\tradio/' /etc/hosts
hostname radio

echo ""
echo "==> Setup complete. A reboot is required for hardware changes to take effect."
echo "    Run: sudo reboot"
echo "    Then load Docker images sent from the build machine."
