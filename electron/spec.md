# DND Companion Electron App Spec

## Purpose

The Electron app is a direct-control interface for the Arduino companion device. It provides a UI for manually setting OLED display text, controlling the NeoPixel ring color and animation, and sending commands or invoking functions on the Arduino over USB serial.

There is no embedded browser and no D&D Beyond integration. The user drives all output to the Arduino through the app's control panels.

## Current Findings

- The Electron skeleton (main process, preload, renderer, SerialManager) has been scaffolded.
- The shared Arduino/Electron JSON protocol is stable and should remain unchanged.
- The Arduino expects newline-terminated JSON over serial and controls a 128×64 OLED plus a NeoPixel ring.
- The previous D&D Beyond `WebContentsView` architecture is no longer needed and should be removed.

## Product Goals

- Provide a clean UI for directly controlling what appears on the Arduino's OLED display.
- Provide a color picker and animation selector for the NeoPixel ring.
- Allow the user to send raw serial commands (arbitrary JSON payloads).
- Allow the user to invoke named functions defined on the Arduino.
- Make serial connection state visible and recoverable.
- Keep the first version small enough to build and test quickly.

## Non-Goals For V1

- Automatic character sheet monitoring of any kind.
- Syncing to cloud services or storing campaign data remotely.
- Bidirectional Arduino control (reading back from Arduino).
- Changing the shared JSON protocol unless a real device limitation forces it.
- User accounts or authentication.

## User Experience

The app opens to a full-window control panel. There is no embedded browser. Suggested layout:

**Connection bar (top)**
- Serial port picker
- Baud rate selector (default 115200)
- Connect/disconnect button
- Connection status indicator
- Refresh ports button

**Display control panel**
- Text field for OLED line 1 (≤21 chars to fit 128×64 at default font)
- Text field for OLED line 2
- "Send to display" button that builds and sends the correct JSON payload

**NeoPixel control panel**
- Color picker (hex input + visual swatch)
- Animation selector: `solid`, `pulse`, `flash`
- "Send to LEDs" button

**Script / command panel**
- Text area for entering a raw JSON payload
- "Send" button
- Character count / validation hint

**Arduino function panel**
- A list of named functions available on the Arduino (user-defined or hardcoded presets)
- Each entry has a "Run" button that sends the appropriate invocation payload
- User can add/remove entries; they are persisted locally

**Payload history log (bottom or side panel)**
- Timestamp, direction (sent), and raw payload for recent messages
- Clear button

The user should be able to open the app, pick a serial port, connect, and immediately control the Arduino without editing any config files.

## Runtime Architecture

Use Electron's process boundaries deliberately:

- Main process:
  - Create and manage the main `BrowserWindow`
  - Own serialport access via `SerialManager`
  - Validate and write payloads to the Arduino
  - Persist local preferences (last port, baud rate, saved functions)
- Preload script:
  - Expose a narrow, safe IPC API via `contextBridge`
  - No raw Node.js APIs exposed to the renderer
- Renderer:
  - Render the full control panel UI
  - Build JSON payloads from user input
  - Display payload history and connection state

Recommended security defaults:

- `contextIsolation: true`
- `nodeIntegration: false`
- Narrow IPC channels only

## JSON Protocol (unchanged)

Payloads are newline-terminated JSON sent over USB serial.

```json
{
  "event": "manual",
  "display": {
    "line1": "Hello",
    "line2": "World"
  },
  "leds": {
    "color": "#FF0000",
    "animation": "pulse"
  }
}
```

The `event` field for manually triggered payloads should be `"manual"`. Arduino function invocations use a dedicated `"function"` event with a `"name"` field.

## Internal Event Model

The app can use a richer internal event shape than the Arduino protocol, then map it down to the shared payload at the serial boundary.

Example internal event:

```json
{
  "type": "hp_change",
  "character": {
    "name": "Kael",
    "summary": "Fighter Lv 5"
  },
  "previous": {
    "currentHp": 24,
    "maxHp": 24
  },
  "current": {
    "currentHp": 18,
    "maxHp": 24
  },
  "timestamp": "2026-05-27T18:30:00.000Z"
}
```

The serial adapter maps that internal event to the shared payload:

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

This keeps the shared Arduino protocol stable while letting the Electron app evolve.

## Shared JSON Protocol

Payloads are newline-terminated JSON sent from Electron to Arduino over USB serial.

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
| `event` | string | Trigger type, such as `hp_change`, `spell_used`, or `condition_added` |
| `display.line1` | string | Top line of OLED display |
| `display.line2` | string | Bottom line of OLED display |
| `leds.color` | string | Hex color for NeoPixel ring |
| `leds.animation` | string | Animation type: `solid`, `pulse`, or `flash` |

Any protocol field or event type changes must be reflected in all root, Electron, and Arduino `AGENTS.md` and `CLAUDE.md` files.

## Event Mapping Ideas

| D&D Beyond change | Event | Display | LED idea |
|---|---|---|---|
| HP decreases | `hp_change` | `HP: current / max` | red pulse |
| HP increases | `hp_change` | `HP: current / max` | green pulse |
| Low HP threshold | `hp_change` | `LOW HP: current / max` | red flash |
| Temporary HP changes | `hp_change` | `Temp HP: value` | blue pulse |
| Spell slot spent | `spell_used` | `Spell Slot Used` | purple flash |
| Condition added | `condition_added` | condition name | amber pulse |
| Character loaded | existing event TBD | name and class/level | white solid |

The final row intentionally avoids adding a new shared event yet. For V1, either reuse an existing event or defer startup messages until the protocol is intentionally expanded.

## Serial Connection

The app should use the `serialport` npm package from the main process.

Expected behavior:

- List available ports.
- Prefer the last successful port on startup.
- Let the user manually select a port.
- Show disconnected, connecting, connected, and error states.
- Reconnect gracefully after unplug/replug when possible.
- Append `\n` after every JSON payload.
- Rate-limit writes to avoid overwhelming the Arduino.
- Surface write errors in the diagnostics panel.

Useful test action:

```json
{
  "event": "hp_change",
  "display": {
    "line1": "DND Companion",
    "line2": "Serial OK"
  },
  "leds": {
    "color": "#00FF00",
    "animation": "pulse"
  }
}
```

## Suggested File Layout

```text
Electron/
├── package.json
├── spec.md
├── src/
│   ├── main/
│   │   ├── app.ts
│   │   ├── serial/
│   │   │   ├── SerialManager.ts
│   │   │   └── payloadValidator.ts
│   │   └── ipc.ts
│   ├── preload/
│   │   └── index.ts
│   └── renderer/
│       ├── App.tsx
│       ├── dndbeyond/
│       │   ├── observer.ts
│       │   ├── selectors.ts
│       │   └── snapshot.ts
│       └── events/
│           ├── mapToPayload.ts
│           └── types.ts
└── tests/
    ├── payloadValidator.test.ts
    └── mapToPayload.test.ts
```

TypeScript is recommended because the app has several boundaries where typed contracts will help: DOM snapshots, internal events, IPC messages, and serial payloads.

## Implementation Phases

### Phase 1: Skeleton

- Scaffold Electron with TypeScript.
- Add app shell with embedded D&D Beyond.
- Add secure preload and IPC baseline.
- Add serial port listing and manual connect/disconnect.
- Add a test-send button.

### Phase 2: Payload Pipeline

- Define internal event types.
- Add shared payload validation.
- Add mapping from internal events to Arduino payloads.
- Add recent payload log in the UI.
- Unit test payload validation and event mapping.

### Phase 3: D&D Beyond Observers

- Add selectors and snapshot reader for HP and character summary.
- Add `MutationObserver` plus polling fallback.
- Detect HP changes and send `hp_change` payloads.
- Add selector diagnostics.

### Phase 4: More Character Events

- Add spell slot tracking.
- Add condition tracking.
- Add threshold-based LED choices.
- Add local settings for event enable/disable preferences.

### Phase 5: Polish And Packaging

- Improve reconnect behavior.
- Persist window and serial preferences.
- Add app icon/name metadata.
- Package for Windows first, since the workspace appears to be on Windows via WSL paths.

## Testing Strategy

- Unit tests:
  - payload validation
  - internal event to shared payload mapping
  - snapshot diffing
- Manual tests:
  - Arduino unplugged
  - Arduino connected
  - invalid serial port
  - D&D Beyond logged out
  - D&D Beyond character page loaded
  - HP damage/healing changes
- Diagnostics:
  - payload log should show exactly what was sent
  - selector status should show whether expected values are detected

## Risks And Mitigations

| Risk | Mitigation |
|---|---|
| D&D Beyond DOM changes | Centralize selectors, show selector diagnostics, keep observer code small |
| Login/session complications | Use normal Electron browser session and avoid scraping credentials |
| Serial port ambiguity | Manual picker plus remembered last-good port |
| Arduino buffer overload | Newline framing, payload size discipline, write rate limiting |
| Shared protocol drift | Keep protocol mapping in one place and update all instruction docs for any protocol change |
| No physical hardware during development | Include test-send, payload log, and serial mock/unit tests |

## Open Questions

- Should the app use a full app shell with a `BrowserView`/`WebContentsView`, or should the D&D Beyond page itself occupy the main `BrowserWindow` with app controls in a separate window?
- Should V1 target Windows only, or be packaged cross-platform from the start?
- Which Arduino baud rate should be the default?
- Should the user be able to customize LED colors/animations per event?
- Should character detection support multiple open character sheets?
- What is the exact NeoPixel ring count on the hardware, and does the Arduino need payloads optimized for display timing?

## Recommended V1 Decision Set

- Use Electron + TypeScript.
- Keep serial access in the main process only.
- Start with HP monitoring and manual serial connection.
- Treat the existing JSON payload as stable.
- Add diagnostics early so DOM and serial problems are visible.
- Avoid adding new shared event types until the first end-to-end HP flow works on hardware.
