# Electron App — Todo

## Phase 1: Skeleton (rework for control panel pivot)

- [x] Initialize `package.json` with Electron, TypeScript, and `serialport` dependencies
- [x] Configure TypeScript (`tsconfig.json`) with strict settings and separate targets for main/preload/renderer
- [x] Set up build tooling — `electron-vite` chosen (handles main/preload/renderer targets cleanly)
- [x] Create `src/main/app.ts` — main process entry point, `contextIsolation: true`, `nodeIntegration: false`
- [x] Create `src/preload/index.ts` — exposes `window.serialApi` via `contextBridge` only; no Node.js APIs exposed
- [x] Create `src/main/ipc.ts` — IPC handlers for `serial:list-ports`, `serial:connect`, `serial:disconnect`, `serial:send`, `serial:test-send`
- [x] Add serial port listing in main process via `SerialPort.list()`
- [x] Add connect/disconnect logic in `SerialManager.ts` with write queue and drain loop
- [x] Verified `contextIsolation: true`, `nodeIntegration: false`, narrow IPC channels only
- [x] Remove `WebContentsView` D&D Beyond embed from `app.ts` — app is now a plain `BrowserWindow` with no embedded browser
- [x] Replace toolbar-only `App.tsx` with full-window control panel layout (connection bar + panels below)
- [ ] Smoke test: app opens, serial port list populates, test-send fires (manual — requires hardware)

## Phase 2: Control Panel UI

- [x] Build connection bar component: port picker, baud rate selector, connect/disconnect button, status indicator, refresh button
- [x] Build display control panel: 6-line textarea (OLED_LINES), 21-char/line limit, OLED preview (1x/2x scale), L/C/R text alignment, "Send" button
- [x] Build NeoPixel control panel: hex color input with visual swatch, animation selector (`solid` / `pulse` / `flash`) for ring (pixels 1–6) and center (pixel 0) independently, phase-invert toggle for center, live synchronized SVG animation preview, "Send" button
- [x] Build payload history log: scrollable list of recent sent payloads with timestamps, clear button
- [x] Wire all panels to `window.serialApi` IPC calls
- [x] Show all four serial states in the connection bar: disconnected, connecting, connected, error
- [x] Build macro system: save named macros (display text + LED config), load, update in-place, delete, drag-to-reorder, persist to `macros.json` via main process IPC
- [ ] Build script/command panel: free-text JSON textarea, send button, basic JSON validation hint

## Phase 3: Arduino Function Panel

- [x] Design payload schema for Arduino function invocation: `{ "event": "function", "name": "<name>" }`
- [x] Build Arduino function panel: list of saved entries (name + optional description), "Run" button per entry, add/remove controls
- [x] Persist saved function entries to `functions.json` via main process IPC
- [x] Add IPC handler `functions:load` and `functions:save` in `ipc.ts`
- [ ] Smoke test: add a function entry, click Run, verify correct payload appears in history log (manual — requires hardware)

## Phase 4: Payload Infrastructure

- [x] Define shared payload type in `src/shared/types.ts` matching the Arduino JSON protocol
- [x] Implement `src/main/serial/payloadValidator.ts` — validates payload shape before writing to serial
- [x] Write unit tests: `tests/payloadValidator.test.ts` (21 tests, all passing)
- [x] Ensure display control panel and NeoPixel panel each build valid payloads before sending (validator called in `SerialManager.sendPayload`)

## Known Bugs

- [ ] **Intermittent ~5 s serial stall** — all controls stop responding for ~5 seconds at consistent intervals. Payload history shows sends queuing correctly on the Electron side; the Arduino stops processing them. Root cause not yet confirmed. Attempted: `port.drain()` after each write, write queue cap, `draining` flag reset on close, `StaticJsonDocument` size increase, explicit WiFi/BT radio shutdown on ESP32-S3. None resolved it. Likely a USB-CDC flow control or RTOS scheduling issue on the ESP32-S3.

## Phase 5: Polish and Packaging

- [x] Persist last-selected serial port and baud rate across app restarts (localStorage)
- [x] Persist window size/position across restarts (userData/window-bounds.json)
- [x] Implement graceful reconnect on unplug/replug (SerialManager auto-retry every 3 s)
- [x] Add app icon from `icon.svg` — converted to PNG via `scripts/generate-icon.js` using `@resvg/resvg-js`; set on BrowserWindow and electron-builder config
- [x] Import/export macros to JSON file (via native file dialog)
- [x] Import/export functions to JSON file (via native file dialog)
- [x] Tooltip on Functions panel header explaining Arduino payload format
- [x] Package for Windows: `npm run build:win` → `dist/DND-Companion-win-x64.zip`
- [ ] Final manual test pass end-to-end on hardware

## Open Questions

- [ ] V1 packaging target: Windows-only or cross-platform?
- [x] Default Arduino baud rate — 115200
- [x] Physical NeoPixel ring count — 7 pixels (6 outer ring + 1 center)
- [x] Arduino function panel — name-only (fire-and-forget) for V1
