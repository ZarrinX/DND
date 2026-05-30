# DND Companion — Arduino Agent Instructions

## Project Context

This is the Arduino firmware sub-project of the DND companion. It receives newline-terminated JSON payloads over USB serial from the Electron app and updates an OLED display and NeoPixel LED ring.

The Electron app lives in `../Electron/`. The workspace-level overview is in `../CLAUDE.md` and `../AGENTS.md`.

## Agent Guidelines

- This is an independent git repo. Commit only Arduino-specific changes here.
- The JSON protocol is a **shared contract** with the Electron sub-project. Never change the protocol unilaterally — update `../AGENTS.md`, `../CLAUDE.md`, `../Electron/AGENTS.md`, and `../Electron/CLAUDE.md` at the same time.
- Keep `CLAUDE.md` in this folder in sync with `AGENTS.md`. They describe the same project; CLAUDE.md is for Claude Code, AGENTS.md is for OpenAI-compatible agents.

## Sync Rules

| Change type | Files to update |
|---|---|
| JSON protocol field added/changed | This file + `CLAUDE.md` + all files in `../` and `../Electron/` |
| New event type | This file + `CLAUDE.md` + all files in `../` and `../Electron/` |
| Hardware or library change | This `AGENTS.md` + this `CLAUDE.md` only |

## Hardware

- **Board:** Arduino Nano
- **Display:** SSD1306 128×64 OLED (I2C)
- **LEDs:** 7-segment NeoPixel ring

## Key Libraries

- `Adafruit_SSD1306` + `Adafruit_GFX` — OLED display
- `Adafruit_NeoPixel` — LED ring
- `ArduinoJson` — JSON parsing

## JSON Protocol (shared contract)

Payloads are newline-terminated JSON received over USB serial.

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

| Field | Type | Description |
|---|---|---|
| `event` | string | Trigger type (e.g. `hp_change`, `spell_used`, `condition_added`) |
| `display.line1` | string | Top line of OLED display |
| `display.line2` | string | Bottom line of OLED display |
| `leds.color` | string | Hex color for NeoPixel ring |
| `leds.animation` | string | Animation type (`solid`, `pulse`, `flash`) |
