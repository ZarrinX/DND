# DND Companion — Electron Agent Instructions

## Project Context

This is the Electron app sub-project of the DND companion. It loads dndbeyond.com, monitors DOM elements for value changes, and sends formatted JSON payloads to an Arduino over USB serial.

The Arduino firmware lives in `../Arduino/`. The workspace-level overview is in `../CLAUDE.md` and `../AGENTS.md`.

## Agent Guidelines

- This is an independent git repo. Commit only Electron-specific changes here.
- The JSON protocol is a **shared contract** with the Arduino sub-project. Never change the protocol unilaterally — update `../AGENTS.md`, `../CLAUDE.md`, `../Arduino/AGENTS.md`, and `../Arduino/CLAUDE.md` at the same time.
- Keep `CLAUDE.md` in this folder in sync with `AGENTS.md`. They describe the same project; CLAUDE.md is for Claude Code, AGENTS.md is for OpenAI-compatible agents.
- D&D Beyond loads dynamic content — prefer `MutationObserver` or polling over one-shot DOM reads for tracking value changes.

## Sync Rules

| Change type | Files to update |
|---|---|
| JSON protocol field added/changed | This file + `CLAUDE.md` + all files in `../` and `../Arduino/` |
| New event type | This file + `CLAUDE.md` + all files in `../` and `../Arduino/` |
| DOM selector or serial config change | This `AGENTS.md` + this `CLAUDE.md` only |

## Tech Stack

- **Electron** — desktop shell
- **Node.js** — serial communication and DOM interaction
- **serialport** (npm) — USB serial communication with Arduino

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

## JSON Protocol (shared contract)

Payloads are newline-terminated JSON sent over USB serial.

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
