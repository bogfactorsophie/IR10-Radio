# Radio

This project builds a simple, beautiful, internet radio with a built in speaker and a simple interface.

The intention is to replicate the tactile user experience of 20th century FM radios reimagined for internet radio.

The device is intended to be small and be a part of the user's home environment, imagine a portable radio in a kitchen, office, or workshop.

## Tech

### Hardware Stack

The software will run on a Raspberry Pi Zero 2W, with an Pimoroni Audio Amp SHIM (3W Mono Amp) and Waveshare 2.23inch OLED Display HAT.

Full details are in: `docs\pi-zero-2w-components.md`

The hardware to be used will be iterated on over time, consideration should be taken to make versions of the software specific to each supported hardware stack.

### Software Stack

Open source software should be utilised when necessary. Do not implement a radio streamer, web server, or GPIO handlers where appropriately licensed FOSS software is available.

Applications should run in Docker for portability. Where appropriate, multiple Docker images and services can be used e.g.

* Web Server
* Radio Streamer
* I/O
* Display

### Radio Streaming

Only internet radio stations will be supported. There are no analogue (i.e. FM, AM) receivers in this device

Essential radio stations to play during initial development and testing are "EHFM", "NTS Radio 1", "NTS Radio 2", and "Worldwide FM" steam links for each of these can be found online.

A publicly available API with publicly available radio stations can be found at https://www.radio-browser.info/

When load balancing is available for the stream e.g.https://ehfm.out.airtime.pro/ehfm_a and https://ehfm.out.airtime.pro/ehfm_b then consider which stream to utilise before connecting.

Initial versions of the radio will be mono only - assume the left channel only is fine unless a mono version is available natively.

### Testing

### Deployment Process

The latest version of the code will be built with `docker build` and then the image sent to the Raspberry Pi and the service restarted using the latest tags.

This could be automated with a shell script or simple Ansible process.

### Coding Standards

* Code will be reviewed by a human
* Code should be self descriptive where possible
* Comments should be succinct
* Code should be lightweight, this means:
  * Low power consumption
  * Minimal disk space usage
  * Minimal CPU and memory usage

### Version Control

* Treat the `main` branch as protected at all times
* Generate commits for new features on feature branches
* Minimise number of new features added to each branch
* All code will be reviewed by hand through a PR process on GitHub

### Licensing

MIT License

All open source packages used should take this license into consideration.

## Design Principles

Full design principles are found at `docs\design-principles.md`

### User Interface

#### Pre-Config

This is the out of box experience for new users, or users who have reset the device

* Raspberry Pi's WiFi will be in broadcast mode
* The user will connect to its WiFi
* The user will enter their network's SSID and password
* The Raspberry Pi will the connect to their network

#### Device Configuration

* A web interface to configure the preset set of radio stations
* The web interface should be hosted on a `.local` web address available on any network

#### Normal Use

* The radio station will be selected with a button
* The OLED will display the current radio station for 30s after selecting it
* Otherwise the OLED wil diplay a graphic VU meter or frequency visualisation

#### Factory Reset

* Using a specific button combination, the user will be able to reset the device's WiFi settings

### Audio