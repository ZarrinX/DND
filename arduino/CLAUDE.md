# DND Companion — Arduino

## Overview

Arduino firmware for the DND companion project. Receives formatted JSON payloads over USB serial from the Electron app and updates an OLED display and NeoPixel LED ring to reflect in-game events.

---

## Hardware

- **Board:** Arduino Nano
- **Display:** SSD1306 128×64 OLED (I2C)
- **LEDs:** 7-segment NeoPixel ring

---

## Responsibilities

- Listen on USB serial for incoming newline-terminated JSON messages
- Parse JSON and update the OLED display with relevant character data
- Set NeoPixel colors and animations based on triggered events (e.g. taking damage, leveling up, low HP)

---

## Key Libraries

- `Adafruit_SSD1306` + `Adafruit_GFX` — OLED display
- `Adafruit_NeoPixel` — LED ring
- `ArduinoJson` — JSON parsing

---

## JSON Protocol

Payloads are newline-terminated JSON received over USB serial.

### Example Payload

```json
{
  "event": "hp_change",
  "display": {
    "line1": "HP: 18 / 24",
    "line2": "Fighter Lv 5"
  },
  "leds": {
    "color": "#FF0000",
    "animation": "pulse"
  }
}
```

### Fields

| Field | Type | Description |
|---|---|---|
| `event` | string | Trigger type (e.g. `hp_change`, `spell_used`, `condition_added`) |
| `display.line1` | string | Top line of OLED display |
| `display.line2` | string | Bottom line of OLED display |
| `leds.color` | string | Hex color for NeoPixel ring |
| `leds.animation` | string | Animation type (`solid`, `pulse`, `flash`) |
