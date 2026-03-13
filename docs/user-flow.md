# User Interface

## Pre-Config

This is the out of box experience for new users, or users who have reset the device

* Raspberry Pi's WiFi will be in broadcast mode
* The user will connect to its WiFi
* The user will enter their network's SSID and password
* The Raspberry Pi will the connect to their network
* The webpage will guide the user towards the Device Configuration stage

## Device Configuration

* The web interface should be hosted on a `.local` web address available on any network
* A web interface to configure the preset set of radio stations
* Stations should be added via search or manually via URL
* There should be N preset positions available - and N positions on the dial
* The order of these presets matters

## Normal Use

* When the device is switched on it should be playing by default
* A dial is used to select the preset number
* Whichever preset is in that position should be playing
* Volume control will be via a potentiometer (not implemented yet)
  * Default volume should be 50%

## Display (optional)

* The OLED will display the current radio station for 30s after selecting it
* After 30s the OLED wil diplay a graphic VU meter

## Factory Reset

* Using a specific button combination, the user will be able to reset the device's WiFi settings

## Glossary

* "Dial": N Position Rotary Selector Switch