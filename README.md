# DND Companion

A tabletop RPG toolkit combining D&D Beyond campaign management with a physical Arduino companion device controlled via an Electron desktop app.

---

## Repository Structure

```
dnd/
├── nullshore_expanse/   # Campaign: The Nullshore Expanse
├── electron/            # Electron desktop app — control panel for the Arduino
└── arduino/             # Arduino firmware — OLED display + NeoPixel ring
```

---

## Components

### Campaigns (`nullshore_expanse/`)

D&D Beyond campaigns. Each campaign subfolder contains:

| File | Purpose |
|---|---|
| `lore.md` | World-building, factions, creatures, and mechanics — source of truth for continuity |
| `plot_structure.md` | Act structure, scenes, NPC rosters, and per-act todos |
| `nullshore_draft.md` | Quick-reference summary of core rules and concepts |
| `todo.md` | Campaign-wide outstanding work |

**Conventions:**
- Pacing target: 4 hours per session
- Platform: D&D Beyond — all stat blocks follow 5e structure; homebrew entries are flagged inline
- Always check `lore.md` before writing new content to preserve continuity

### Electron App (`electron/`)

Desktop control panel that connects to the Arduino over USB serial. Provides a UI for setting OLED display text, controlling NeoPixel colors/animations, running saved macros, invoking Arduino functions, and running a countdown timer.

See [electron/README.md](electron/README.md) for setup and usage.

### Arduino Firmware (`arduino/`)

Firmware for an Arduino Nano ESP32 that drives a 128×64 OLED display and a 7-pixel NeoPixel ring. Receives newline-terminated JSON payloads from the Electron app over USB serial.

See [arduino/README.md](arduino/README.md) for wiring and flashing instructions.

---

## JSON Protocol

Payloads are newline-terminated JSON sent from Electron → Arduino over USB serial. The authoritative type definitions live in [`electron/src/shared/types.ts`](electron/src/shared/types.ts).

```json
{ "event": "display", "display": { "line1": "HP: 18/24", "line2": "Fighter Lv5" }, "scale": 1 }
{ "event": "manual",  "leds": { "color": "#ff0000", "animation": "pulse", "brightness": 75,
                                 "center": { "color": "#00ff00", "animation": "solid", "brightness": 50, "invertPhase": false } } }
{ "event": "macro",   "display": { ... }, "leds": { ... } }
{ "event": "function","name": "my_function" }
```

| `event` value | Description |
|---|---|
| `display` | Update OLED only |
| `manual` | Update NeoPixels only |
| `macro` | Update OLED + NeoPixels together |
| `function` | Invoke a named function on the Arduino |
