# Principles

 * The Web interface does not control the playback
 * All radio functions are controllable by physical switches and buttons
 * There is no digital display

# Controls 

* Master power on switch
* N=12 position rotary switch known as the "dial"
  * Free to rotate 360 degrees
  * Can switch from position N -> 0
  * One position is standby mode
* Volume slider (potentiometer)

# First boot

As the device won't know the user's WiFi it will need to be in broadcast mode

The user will have instructions on how to connect to the device, and a QR code linking to radio.local

An interface to connect to the user's WiFi and then switch into normal operating mode

# Normal power on

There should be a master off switch to the power system. The user expects some minimal boot time after turning this to on - as constrained by the Pi.

There should be a standby mode where the Pi is on but not playing, this is in position 0 on the dial

If the dial is in an active position (i.e. x != 0) the radio should boot and immediately start playing that preset

# Dial Selection

The dial has visual indicators of position on each of the N positions, including standby

There will be momentary gaps between positions where the software does not know which position the switch is in. The audio should stop during these periods.

If there is no preset on a dial position - a sample of static noise should play on a loop

# Volume

There is a linear potentiometer to control volume

# Web UI

The UI mimics the physical appearance of the device, particularly the dial.

On the outside of the preset positions, small thumbnails should indicate the station presets

No control of the radio functions are possible from the UI

The web UI should display current volume levels

The Web UI is primarily for configuration of the device, for example
  * Adding preset stations, primarily by search, advanced users can add by URL
  * Dragging stations to numbered slots
  * Dragging stations from a library into numbered slots

The Web UI should be mobile and desktop friendly, load quickly, and not consume unnecessary resources from the constrained Raspberry Pi