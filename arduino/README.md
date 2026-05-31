# DND Companion — Arduino Firmware

Firmware for an Arduino Nano ESP32 that receives JSON payloads over USB serial from the [Electron app](../electron/README.md) and drives a 128×64 OLED display and a 7-pixel NeoPixel ring.

---

## Hardware

| Component | Part | Notes |
|---|---|---|
| Board | Arduino Nano ESP32 (ESP32-S3) | 3.3V logic |
| Display | SSD1306 128×64 OLED | I2C, address `0x3C` |
| LEDs | NeoPixel ring, 7 pixels | Pin D6 (physical pin 9); pixel 0 = center, pixels 1–6 = ring |

### Wiring

```
Arduino Nano ESP32 → SSD1306 OLED
  3.3V  → VCC
  GND   → GND
  A4    → SDA
  A5    → SCL

Arduino Nano ESP32 → NeoPixel ring
  D6    → DIN
  5V    → VCC   (or 3.3V — ring works at both)
  GND   → GND
```

---

## Required Libraries

Install all via **Arduino IDE → Tools → Manage Libraries**:

| Library | Version |
|---|---|
| Adafruit SSD1306 | latest |
| Adafruit GFX Library | latest (installed as dependency of SSD1306) |
| Adafruit NeoPixel | latest |
| ArduinoJson | **6.x** — do NOT use v5 or v7 |

---

## Flashing

1. Open `arduino/sketch.ino` in the Arduino IDE.
2. Select **Tools → Board → Arduino Nano ESP32**.
3. Select the correct COM/serial port.
4. Click **Upload**.
5. Open Serial Monitor at **115200 baud** to verify startup output.

---

## JSON Protocol

Payloads are newline-terminated JSON sent from the Electron app over USB serial at 115200 baud. The authoritative type definitions live in [`electron/src/shared/types.ts`](../electron/src/shared/types.ts).

### `display` — Update OLED only

```json
{
  "event": "display",
  "display": { "line1": "HP: 18/24", "line2": "Fighter Lv5" },
  "scale": 1
}
```

### `manual` — Update NeoPixels only

```json
{
  "event": "manual",
  "leds": {
    "color": "#ff0000",
    "animation": "pulse",
    "brightness": 75,
    "center": {
      "color": "#00ff00",
      "animation": "solid",
      "brightness": 50,
      "invertPhase": false
    }
  }
}
```

### `macro` — Update OLED + NeoPixels together

```json
{
  "event": "macro",
  "display": { "line1": "Fireball!", "line2": "3rd level" },
  "scale": 2,
  "leds": { "color": "#ff6600", "animation": "flash", "brightness": 100,
            "center": { "color": "#ff6600", "animation": "flash", "brightness": 100, "invertPhase": false } }
}
```

### `function` — Invoke a named function on the Arduino

```json
{ "event": "function", "name": "my_function" }
```

Handle incoming function names inside `dispatchFunction()` in `sketch.ino`.

### Field reference

| Field | Type | Values |
|---|---|---|
| `event` | string | `display`, `manual`, `macro`, `function` |
| `display.line1`–`line6` | string | Up to 21 chars at scale 1, 10 chars at scale 2 |
| `scale` | number | `1` or `2` — 2 renders larger text (3 lines max) |
| `leds.color` | string | Hex color, e.g. `#ff0000` |
| `leds.animation` | string | `solid`, `pulse`, `flash` |
| `leds.brightness` | number | 1–100 |
| `leds.center.invertPhase` | bool | Inverts pulse/flash phase relative to the ring |

### Display auto-scale

If the payload omits `scale`, the firmware infers it:
- ≤ 3 non-empty lines → `textSize 2` (large)
- 4–6 non-empty lines → `textSize 1` (small)

---

## Debug Sketches

Diagnostic sketches live in `arduino/debug/`:

| Sketch | Purpose |
|---|---|
| `basic_test/` | Minimal OLED + NeoPixel hardware check (RGB cycle + "OLED OK") |
| `i2c_scan/` | Scans I2C bus and prints all found addresses — use if OLED isn't detected |
| `oled_diag/` | Full-RAM OLED diagnostic matching the global layout of `sketch.ino` |
| `example/` | NeoPixel color-wipe demo with OLED readout |

Flash any of these the same way as the main sketch.

---

## Known Issues

- **Intermittent ~5 s serial stall** — the Arduino stops processing payloads for ~5 seconds at consistent intervals. Likely a USB-CDC flow control or RTOS scheduling issue on the ESP32-S3. Attempted mitigations include `port.drain()`, write queue caps, `StaticJsonDocument` size increases, and explicit WiFi/BT radio shutdown — none resolved it.
