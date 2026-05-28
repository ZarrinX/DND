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

- [ ] Build connection bar component: port picker, baud rate selector, connect/disconnect button, status indicator, refresh button
- [ ] Build display control panel: two text inputs (line1 / line2), character count hints, "Send to display" button
- [ ] Build NeoPixel control panel: hex color input with visual swatch, animation selector (`solid` / `pulse` / `flash`), "Send to LEDs" button
- [ ] Build script/command panel: free-text JSON textarea, send button, basic JSON validation hint
- [ ] Build payload history log: scrollable list of recent sent payloads with timestamps, clear button
- [ ] Wire all panels to `window.serialApi` IPC calls
- [ ] Show all four serial states in the connection bar: disconnected, connecting, connected, error

## Phase 3: Arduino Function Panel

- [ ] Design payload schema for Arduino function invocation: `{ "event": "function", "name": "<name>" }`
- [ ] Build Arduino function panel: list of saved entries (name + optional description), "Run" button per entry, add/remove controls
- [ ] Persist saved function entries to local storage or a JSON file via main process IPC
- [ ] Add IPC handler `functions:load` and `functions:save` in `ipc.ts`
- [ ] Smoke test: add a function entry, click Run, verify correct payload appears in history log

## Phase 4: Payload Infrastructure

- [ ] Define shared payload type in `src/shared/types.ts` matching the Arduino JSON protocol
- [ ] Implement `src/main/serial/payloadValidator.ts` — validates payload shape before writing to serial
- [ ] Write unit tests: `tests/payloadValidator.test.ts`
- [ ] Ensure display control panel and NeoPixel panel each build valid payloads before sending (use validator)

## Phase 5: Polish and Packaging

- [ ] Persist last-selected serial port and baud rate across app restarts
- [ ] Persist window size/position across restarts
- [ ] Implement graceful reconnect on unplug/replug
- [ ] Add app icon and name metadata to `package.json` and `electron-builder` config
- [ ] Package for target platform
- [ ] Final manual test pass end-to-end on hardware

## Open Questions

- [ ] V1 packaging target: Windows-only or cross-platform?
- [x] Default Arduino baud rate — 115200
- [ ] Physical NeoPixel ring count (affects whether Arduino needs payload timing optimization)
- [ ] Should the Arduino function panel support passing arguments, or name-only for V1?
