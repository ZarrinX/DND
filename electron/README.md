# DND Companion — Electron App

Desktop control panel for the DND Arduino companion device. Connects over USB serial and provides a full UI for driving the OLED display, NeoPixel ring, macros, countdown timer, and Arduino function invocations.

---

## Requirements

- **Node.js** 20+
- **npm** 9+
- Linux or Windows (macOS untested)

---

## Setup

```bash
cd electron
npm install
```

> `postinstall` automatically runs `electron-rebuild` to compile native serial port bindings for your local Electron version.

---

## Development

```bash
npm run dev
```

Opens the app in development mode with hot-reload. Requires a connected Arduino on a USB serial port to test serial features; the UI is fully usable without one.

---

## Testing

```bash
npm test          # run Jest unit tests (payloadValidator)
npm run typecheck # TypeScript type-check without emitting
```

---

## Building

### Development build (all platforms)

```bash
npm run build
```

Output goes to `out/`.

### Windows deployable zip

```bash
npm run build:win
```

Produces `dist/DND-Companion-win-x64.zip`. Unzip and run `DND Companion.exe` — no installer required.

---

## Project Structure

```
electron/
├── src/
│   ├── main/
│   │   ├── app.ts                  # BrowserWindow creation, window bounds persistence
│   │   ├── ipc.ts                  # IPC channel handlers (serial, macros, functions)
│   │   └── serial/
│   │       ├── SerialManager.ts    # Serial port lifecycle, write queue, auto-reconnect
│   │       └── payloadValidator.ts # Validates payload shape before writing to serial
│   ├── preload/
│   │   └── index.ts                # contextBridge — exposes serialApi, macrosApi, functionsApi
│   ├── renderer/
│   │   ├── App.tsx                 # Full control panel UI
│   │   └── App.css                 # Dark theme styles
│   └── shared/
│       └── types.ts                # Shared payload types (ArduinoPayload, LedConfig, etc.)
├── tests/
│   └── payloadValidator.test.ts    # 21 unit tests for payload validation
├── resources/
│   └── icon.png                    # App icon (generated from icon.svg)
└── scripts/
    └── generate-icon.js            # Converts icon.svg → resources/icon.png via @resvg/resvg-js
```

---

## UI Panels

| Panel | Description |
|---|---|
| **Connection bar** | Port picker, baud rate selector (default 115200), connect/disconnect, status indicator, refresh |
| **Display** | 6-line textarea, 21-char/line limit, 1x/2x scale toggle, L/C/R alignment, animation selector, live OLED preview |
| **NeoPixel** | Hex color + swatch for ring (pixels 1–6) and center (pixel 0), animation selector, brightness slider, phase-invert toggle, live SVG preview |
| **Timer** | Countdown timer with 5-min increments up to 60 min; sends `display` payloads at 2x scale each second |
| **Macros** | Save/load/delete/reorder named macros (display + LED config); import/export to JSON file |
| **Functions** | Fire-and-forget named Arduino function invocations; import/export to JSON file |
| **Payload history** | Scrollable log of all sent payloads with timestamps |

---

## Persistence

| Data | Location |
|---|---|
| Last port / baud rate | `localStorage` |
| Window size / position | `{userData}/window-bounds.json` |
| Macros | `{userData}/macros.json` |
| Arduino functions | `{userData}/functions.json` |

---

## Security

- `contextIsolation: true`, `nodeIntegration: false`
- Renderer has no direct access to Node.js APIs
- All serial access is gated through narrow IPC channels (`serial:connect`, `serial:disconnect`, `serial:send`, `serial:list-ports`)
- Payloads are validated by `payloadValidator.ts` before being written to serial

---

## Known Issues

- **Intermittent ~5 s serial stall** — the Arduino stops processing payloads for ~5 seconds at consistent intervals. Likely a USB-CDC flow control or RTOS scheduling issue on the ESP32-S3. See `todo.md` for attempted mitigations.
