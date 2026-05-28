# DND Companion — Electron

## Overview

Electron desktop app for the DND companion project. Automatically loads dndbeyond.com, monitors DOM elements for value changes, and sends formatted JSON payloads to an Arduino over USB serial.

---

## Tech Stack

- **Electron** — desktop shell
- **Node.js** — serial communication and DOM interaction
- **serialport** (npm) — USB serial communication with Arduino

---

## Responsibilities

- Automatically load `dndbeyond.com` in an Electron `BrowserWindow`
- Inject scripts or use `webContents` to monitor specific DOM elements for value changes (e.g. HP, spell slots, conditions)
- On detected change, serialize the relevant data into a JSON payload
- Send the JSON payload to the Arduino over USB serial

---

## Communication Flow

```
dndbeyond.com DOM
      │  (value change detected)
      ▼
Electron main/renderer process
      │  (build JSON payload)
      ▼
USB Serial (serialport)
      │
      ▼
Arduino Nano
```

---

## JSON Protocol

Payloads are newline-terminated JSON sent over USB serial.

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
