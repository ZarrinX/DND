import React, { useCallback, useEffect, useRef, useState } from 'react'

const OLED_COLS = 21
const OLED_COLS_2X = 10  // 128px / 12px per char at textSize 2
const OLED_LINES = 6

function OledPreview({ text, scale, align }: { text: string; scale: 1 | 2; align: TextAlign }): React.ReactElement {
  const activeLines = OLED_LINES / scale
  const rawLines = text.split('\n')
  const cols = scale === 2 ? OLED_COLS_2X : OLED_COLS
  const lines = Array.from({ length: activeLines }, (_, i) =>
    (rawLines[i] ?? '').slice(0, cols),
  )
  return (
    <div className="oled-preview" style={{ fontSize: scale === 2 ? 24 : 12 }}>
      {lines.map((line, i) => (
        <div
          key={i}
          className={`oled-line${line === '' ? ' oled-line-empty' : ''}`}
          style={{ textAlign: align }}
        >
          {line || '\u00A0'}
        </div>
      ))}
    </div>
  )
}

const RING_RADIUS = 33
const PIXEL_R = 9
const CX = 50
const CY = 50

const PIXEL_ANIM_STYLE: Record<LedAnimation, React.CSSProperties> = {
  solid: {},
  pulse: { animation: 'neopixel-pulse 1.5s ease-in-out infinite' },
  flash: { animation: 'neopixel-flash 0.6s step-start infinite' },
}

const PIXEL_ANIM_STYLE_INV: Record<LedAnimation, React.CSSProperties> = {
  solid: {},
  pulse: { animation: 'neopixel-pulse-inv 1.5s ease-in-out infinite' },
  flash: { animation: 'neopixel-flash-inv 0.6s step-start infinite' },
}

function NeoPixelPreview({
  ringColor,
  ringAnimation,
  ringBrightness,
  centerColor,
  centerAnimation,
  centerBrightness,
  centerInvert,
}: {
  ringColor: string
  ringAnimation: LedAnimation
  ringBrightness: number
  centerColor: string
  centerAnimation: LedAnimation
  centerBrightness: number
  centerInvert: boolean
}): React.ReactElement {
  const centerStyle = centerInvert ? PIXEL_ANIM_STYLE_INV[centerAnimation] : PIXEL_ANIM_STYLE[centerAnimation]
  const outerPixels = Array.from({ length: 6 }, (_, i) => {
    const angle = (i * 60 - 90) * (Math.PI / 180)
    return { x: CX + RING_RADIUS * Math.cos(angle), y: CY + RING_RADIUS * Math.sin(angle) }
  })
  const syncKey = `${ringAnimation}-${centerAnimation}-${centerInvert ? 1 : 0}`
  return (
    <svg key={syncKey} viewBox="0 0 100 100" className="neopixel-preview" aria-label="NeoPixel ring preview">
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx={CX} cy={CY} r={48} fill="#080808" stroke="#1a1a1a" strokeWidth="1" />
      <g style={{ ...PIXEL_ANIM_STYLE[ringAnimation], opacity: ringBrightness / 100 }}>
        {outerPixels.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={PIXEL_R} fill={ringColor} filter="url(#glow)" />
        ))}
      </g>
      <g style={{ ...centerStyle, opacity: centerBrightness / 100 }}>
        <circle cx={CX} cy={CY} r={PIXEL_R} fill={centerColor} filter="url(#glow)" />
      </g>
    </svg>
  )
}

type SerialStatus = 'disconnected' | 'connecting' | 'connected' | 'error'
type LedAnimation = 'solid' | 'pulse' | 'flash'
type TextAlign = 'left' | 'center' | 'right'

interface PortInfo {
  path: string
  manufacturer?: string
}

interface HistoryEntry {
  id: number
  timestamp: string
  payload: object
}

interface Macro {
  id: string
  name: string
  displayText: string
  textScale: 1 | 2
  textAlign: TextAlign
  displayAnimation: LedAnimation
  ledColor: string
  ledAnimation: LedAnimation
  centerColor: string
  centerAnimation: LedAnimation
  centerBrightness: number
  centerInvert: boolean
  ringBrightness: number
}

interface ArduinoFunction {
  id: string
  name: string
  description: string
}

const BAUD_RATES = [9600, 19200, 38400, 57600, 115200]
const DEFAULT_BAUD = 115200
const ANIMATIONS: LedAnimation[] = ['solid', 'pulse', 'flash']

const STATUS_COLOR: Record<SerialStatus, string> = {
  disconnected: '#888',
  connecting: '#f0a500',
  connected: '#4caf50',
  error: '#f44336',
}

let historyIdCounter = 0

export default function App(): React.ReactElement {
  // Connection state
  const [ports, setPorts] = useState<PortInfo[]>([])
  const [selectedPort, setSelectedPort] = useState(() => localStorage.getItem('lastPort') ?? '')
  const [baudRate, setBaudRate] = useState<number>(() => {
    const saved = Number(localStorage.getItem('lastBaud'))
    return BAUD_RATES.includes(saved) ? saved : DEFAULT_BAUD
  })
  const [status, setStatus] = useState<SerialStatus>('disconnected')
  const [connectedPort, setConnectedPort] = useState<string | undefined>()
  const [errorMsg, setErrorMsg] = useState<string | undefined>()

  // Display panel state
  const [displayText, setDisplayText] = useState('')
  const [textScale, setTextScale] = useState<1 | 2>(1)
  const [textAlign, setTextAlign] = useState<TextAlign>('left')
  const [displayAnim, setDisplayAnim] = useState<LedAnimation>('solid')

  // NeoPixel panel state
  const [ledColor, setLedColor] = useState('#ff0000')
  const [ledAnimation, setLedAnimation] = useState<LedAnimation>('solid')
  const [ringBrightness, setRingBrightness] = useState(50)
  const [centerColor, setCenterColor] = useState('#ff0000')
  const [centerAnimation, setCenterAnimation] = useState<LedAnimation>('solid')
  const [centerBrightness, setCenterBrightness] = useState(50)
  const [invertCenter, setInvertCenter] = useState(false)

  // Macros
  const [macros, setMacros] = useState<Macro[]>([])
  const [loadedMacroId, setLoadedMacroId] = useState<string | null>(null)
  const [showSaveBar, setShowSaveBar] = useState(false)
  const dragIndex = useRef<number | null>(null)
  const dragOverIndex = useRef<number | null>(null)
  const [macroName, setMacroName] = useState('')

  // Arduino Functions
  const [arduinoFunctions, setArduinoFunctions] = useState<ArduinoFunction[]>([])
  const [showAddFunction, setShowAddFunction] = useState(false)
  const [newFnName, setNewFnName] = useState('')
  const [newFnDesc, setNewFnDesc] = useState('')

  // History
  const [history, setHistory] = useState<HistoryEntry[]>([])

  const addHistory = useCallback((payload: object) => {
    setHistory((prev) =>
      [{ id: ++historyIdCounter, timestamp: new Date().toLocaleTimeString(), payload }, ...prev].slice(0, 100),
    )
  }, [])

  const refreshPorts = useCallback(async () => {
    const list = await window.serialApi?.listPorts() ?? []
    setPorts(list)
    if (list.length > 0 && !selectedPort) {
      setSelectedPort(list[0].path)
    }
  }, [selectedPort])

  useEffect(() => {
    refreshPorts()
    window.macrosApi?.load().then((raw) => {
      setMacros(raw as Macro[])
    }).catch(() => {})
    window.functionsApi?.load().then((raw) => {
      setArduinoFunctions(raw as ArduinoFunction[])
    }).catch(() => {})
    const removeListener = window.serialApi?.onStatus((event) => {
      setStatus(event.status)
      if (event.port) setConnectedPort(event.port)
      if (event.error) setErrorMsg(event.error)
      if (event.status === 'disconnected') setConnectedPort(undefined)
    })
    return removeListener
  }, [refreshPorts])

  async function handleConnect(): Promise<void> {
    setErrorMsg(undefined)
    if (status === 'connected') {
      await window.serialApi?.disconnect()
    } else if (selectedPort) {
      localStorage.setItem('lastPort', selectedPort)
      localStorage.setItem('lastBaud', String(baudRate))
      await window.serialApi?.connect(selectedPort, baudRate)
    }
  }

  function applyAlign(line: string): string {
    const cols = textScale === 2 ? OLED_COLS_2X : OLED_COLS
    const trimmed = line.slice(0, cols)
    if (textAlign === 'left') return trimmed
    const pad = cols - trimmed.length
    if (textAlign === 'right') return ' '.repeat(pad) + trimmed
    // center
    const left = Math.floor(pad / 2)
    return ' '.repeat(left) + trimmed
  }

  function buildDisplayPayload(text: string): object {
    const activeLines = OLED_LINES / textScale
    const rawLines = text.split('\n').slice(0, activeLines)
    const display: Record<string, string> = {}
    rawLines.forEach((line, i) => {
      display[`line${i + 1}`] = applyAlign(line)
    })
    return { event: 'display', display, scale: textScale, displayAnimation: displayAnim }
  }

  async function handleSendDisplay(text = displayText): Promise<void> {
    const payload = buildDisplayPayload(text)
    try {
      await window.serialApi?.send(payload)
      addHistory(payload)
    } catch (e) {
      setErrorMsg(String(e))
    }
  }

  async function handleSendLeds(
    color = ledColor,
    animation = ledAnimation,
    brightness = ringBrightness,
    cColor = centerColor,
    cAnimation = centerAnimation,
    cBrightness = centerBrightness,
  ): Promise<void> {
    const payload = {
      event: 'manual',
      leds: { color, animation, brightness, center: { color: cColor, animation: cAnimation, brightness: cBrightness, invertPhase: invertCenter } },
    }
    try {
      await window.serialApi?.send(payload)
      addHistory(payload)
    } catch (e) {
      setErrorMsg(String(e))
    }
  }

  function buildMacroPayload(macro: Macro): object {
    const activeLines = OLED_LINES / macro.textScale
    const rawLines = macro.displayText.split('\n').slice(0, activeLines)
    const align = macro.textAlign ?? 'left'
    const display: Record<string, string> = {}
    rawLines.forEach((line, i) => {
      const cols = macro.textScale === 2 ? OLED_COLS_2X : OLED_COLS
      const trimmed = line.slice(0, cols)
      const pad = cols - trimmed.length
      display[`line${i + 1}`] =
        align === 'right'
          ? ' '.repeat(pad) + trimmed
          : align === 'center'
          ? ' '.repeat(Math.floor(pad / 2)) + trimmed
          : trimmed
    })
    return {
      event: 'macro',
      display,
      scale: macro.textScale,
      displayAnimation: macro.displayAnimation ?? 'solid',
      leds: {
        color: macro.ledColor,
        animation: macro.ledAnimation,
        brightness: macro.ringBrightness ?? 50,
        center: { color: macro.centerColor, animation: macro.centerAnimation, brightness: macro.centerBrightness ?? 50, invertPhase: macro.centerInvert ?? false },
      },
    }
  }

  async function handleSendMacro(macro: Macro): Promise<void> {
    const payload = buildMacroPayload(macro)
    try {
      await window.serialApi?.send(payload)
      addHistory(payload)
    } catch (e) {
      setErrorMsg(String(e))
    }
  }

  function handleLoadMacro(macro: Macro): void {
    setDisplayText(macro.displayText)
    setTextScale(macro.textScale)
    setTextAlign(macro.textAlign ?? 'left')
    setDisplayAnim(macro.displayAnimation ?? 'solid')
    setLedColor(macro.ledColor)
    setLedAnimation(macro.ledAnimation)
    setRingBrightness(macro.ringBrightness ?? 50)
    setCenterColor(macro.centerColor)
    setCenterAnimation(macro.centerAnimation)
    setCenterBrightness(macro.centerBrightness ?? 50)
    setInvertCenter(macro.centerInvert ?? false)
    setLoadedMacroId(macro.id)
    setShowSaveBar(false)
    setMacroName('')
  }

  async function handleUpdateMacro(): Promise<void> {
    if (!loadedMacroId) return
    const next = macros.map((m) =>
      m.id === loadedMacroId
        ? { ...m, displayText, textScale, textAlign, displayAnimation: displayAnim, ledColor, ledAnimation, ringBrightness, centerColor, centerAnimation, centerBrightness, centerInvert: invertCenter }
        : m,
    )
    setMacros(next)
    await window.macrosApi?.save(next)
  }

  async function handleSaveMacro(): Promise<void> {
    const name = macroName.trim()
    if (!name) return
    const macro: Macro = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      name,
      displayText,
      textScale,
      textAlign,
      displayAnimation: displayAnim,
      ledColor,
      ledAnimation,
      ringBrightness,
      centerColor,
      centerAnimation,
      centerBrightness,
      centerInvert: invertCenter,
    }
    const next = [...macros, macro]
    setMacros(next)
    await window.macrosApi?.save(next)
    setMacroName('')
    setShowSaveBar(false)
  }

  async function handleDeleteMacro(id: string): Promise<void> {
    const next = macros.filter((m) => m.id !== id)
    setMacros(next)
    await window.macrosApi?.save(next)
  }

  async function handleDragEnd(): Promise<void> {
    const from = dragIndex.current
    const to = dragOverIndex.current
    dragIndex.current = null
    dragOverIndex.current = null
    if (from === null || to === null || from === to) return
    const next = [...macros]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setMacros(next)
    await window.macrosApi?.save(next)
  }

  async function handleExportMacros(): Promise<void> {
    await window.macrosApi?.exportToFile(macros)
  }

  async function handleImportMacros(): Promise<void> {
    const imported = await window.macrosApi?.importFromFile()
    if (imported) {
      setMacros(imported as Macro[])
      await window.macrosApi?.save(imported)
    }
  }

  async function handleExportFunctions(): Promise<void> {
    await window.functionsApi?.exportToFile(arduinoFunctions)
  }

  async function handleImportFunctions(): Promise<void> {
    const imported = await window.functionsApi?.importFromFile()
    if (imported) {
      setArduinoFunctions(imported as ArduinoFunction[])
      await window.functionsApi?.save(imported)
    }
  }

  async function handleRunFunction(fn: ArduinoFunction): Promise<void> {
    const payload = { event: 'function', name: fn.name }
    await window.serialApi?.send(payload)
    addHistory(payload)
  }

  async function handleAddFunction(): Promise<void> {
    if (!newFnName.trim()) return
    const fn: ArduinoFunction = {
      id: crypto.randomUUID(),
      name: newFnName.trim(),
      description: newFnDesc.trim(),
    }
    const next = [...arduinoFunctions, fn]
    setArduinoFunctions(next)
    await window.functionsApi?.save(next)
    setNewFnName('')
    setNewFnDesc('')
    setShowAddFunction(false)
  }

  async function handleDeleteFunction(id: string): Promise<void> {
    const next = arduinoFunctions.filter((f) => f.id !== id)
    setArduinoFunctions(next)
    await window.functionsApi?.save(next)
  }

  const isConnected = status === 'connected'
  const isBusy = status === 'connecting'

  return (
    <div className="app">
      {/* Connection bar */}
      <div className="connection-bar">
        <span className="app-name">DND Companion</span>

        <div className="control-group">
          <select
            value={selectedPort}
            onChange={(e) => setSelectedPort(e.target.value)}
            disabled={isConnected || isBusy}
          >
            {ports.length === 0 ? (
              <option value="">No ports found</option>
            ) : (
              ports.map((p) => (
                <option key={p.path} value={p.path}>
                  {p.path}
                  {p.manufacturer ? ` (${p.manufacturer})` : ''}
                </option>
              ))
            )}
          </select>

          <select
            value={baudRate}
            onChange={(e) => setBaudRate(Number(e.target.value))}
            disabled={isConnected || isBusy}
          >
            {BAUD_RATES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <button onClick={refreshPorts} disabled={isBusy} title="Refresh port list">
            ↻
          </button>
        </div>

        <div className="control-group">
          <button
            onClick={handleConnect}
            disabled={isBusy || (!selectedPort && !isConnected)}
            className={isConnected ? 'btn-disconnect' : 'btn-connect'}
          >
            {isConnected ? 'Disconnect' : isBusy ? 'Connecting…' : 'Connect'}
          </button>
          <span className="status-dot" style={{ background: STATUS_COLOR[status] }} />
          <span className="status-label">{isConnected ? connectedPort : status}</span>
        </div>

        {errorMsg && <span className="error-msg">{errorMsg}</span>}
      </div>

      {/* Main panels */}
      <div className="panels">
        {/* Display panel */}
        <section className="panel">
          <h2 className="panel-title">Display</h2>

          <div className="display-control-row">
            <span className="display-control-label">Scale</span>
            <div className="scale-radio-group">
              {([1, 2] as const).map((s) => (
                <label key={s} className={`scale-radio${textScale === s ? ' active' : ''}`}>
                  <input
                    type="radio"
                    name="textScale"
                    value={s}
                    checked={textScale === s}
                    onChange={() => {
                      setTextScale(s)
                      if (s === 2) {
                        // Truncate to 3 lines when switching to 2x
                        setDisplayText((prev) =>
                          prev.split('\n').slice(0, OLED_LINES / 2).join('\n'),
                        )
                      }
                    }}
                  />
                  {s}x
                </label>
              ))}
            </div>
          </div>

          <div className="display-control-row">
            <span className="display-control-label">Align</span>
            <div className="align-btn-group">
              {(['left', 'center', 'right'] as TextAlign[]).map((a) => (
                <button
                  key={a}
                  className={`btn-align${textAlign === a ? ' active' : ''}`}
                  onClick={() => setTextAlign(a)}
                >
                  {a[0].toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="display-control-row">
            <span className="display-control-label">Anim</span>
            <div className="animation-row">
              {ANIMATIONS.map((a) => (
                <button
                  key={a}
                  className={`btn-animation${displayAnim === a ? ' active' : ''}`}
                  onClick={() => setDisplayAnim(a)}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <label className="field-label">
            Text
            <span className="char-count">21 chars/line</span>
          </label>
          <OledPreview text={displayText} scale={textScale} align={textAlign} />

          <textarea
            className="display-textarea"
            rows={OLED_LINES / textScale}
            value={displayText}
            onChange={(e) => {
              const lines = e.target.value.split('\n')
              if (lines.length <= OLED_LINES / textScale) setDisplayText(e.target.value)
            }}
            placeholder={Array.from({ length: OLED_LINES / textScale }, (_, i) => `Line ${i + 1}`).join('\n')}
            spellCheck={false}
          />

          <div className="btn-row">
            <button className="btn-send" onClick={() => handleSendDisplay()} disabled={!isConnected}>
              Send
            </button>
          </div>
        </section>

        {/* NeoPixel panel */}
        <section className="panel">
          <h2 className="panel-title">NeoPixel</h2>

          <NeoPixelPreview ringColor={ledColor} ringAnimation={ledAnimation} ringBrightness={ringBrightness} centerColor={centerColor} centerAnimation={centerAnimation} centerBrightness={centerBrightness} centerInvert={invertCenter} />

          <label className="field-label">Ring (pixels 1–6)</label>
          <div className="color-row">
            <input
              type="color"
              className="color-picker"
              value={ledColor}
              onChange={(e) => setLedColor(e.target.value)}
            />
            <input
              type="text"
              className="text-input color-hex"
              value={ledColor}
              maxLength={7}
              onChange={(e) => setLedColor(e.target.value)}
            />
          </div>
          <div className="animation-row">
            {ANIMATIONS.map((a) => (
              <button
                key={a}
                className={`btn-animation${ledAnimation === a ? ' active' : ''}`}
                onClick={() => setLedAnimation(a)}
              >
                {a}
              </button>
            ))}
          </div>
          <div className="brightness-row">
            <label className="brightness-label">Brightness</label>
            <input
              type="range" min={1} max={100} value={ringBrightness}
              className="brightness-slider"
              onChange={(e) => setRingBrightness(Number(e.target.value))}
            />
            <span className="brightness-value">{ringBrightness}%</span>
          </div>

          <label className="field-label" style={{ marginTop: 8 }}>Center (pixel 0)</label>
          <div className="color-row">
            <input
              type="color"
              className="color-picker"
              value={centerColor}
              onChange={(e) => setCenterColor(e.target.value)}
            />
            <input
              type="text"
              className="text-input color-hex"
              value={centerColor}
              maxLength={7}
              onChange={(e) => setCenterColor(e.target.value)}
            />
          </div>
          <div className="animation-row">
            {ANIMATIONS.map((a) => (
              <button
                key={a}
                className={`btn-animation${centerAnimation === a ? ' active' : ''}`}
                onClick={() => setCenterAnimation(a)}
              >
                {a}
              </button>
            ))}
            <button
              className={`btn-animation btn-invert${invertCenter ? ' active' : ''}`}
              onClick={() => setInvertCenter((v) => !v)}
              title="Invert phase relative to ring"
            >
              inv
            </button>
          </div>
          <div className="brightness-row">
            <label className="brightness-label">Brightness</label>
            <input
              type="range" min={1} max={100} value={centerBrightness}
              className="brightness-slider"
              onChange={(e) => setCenterBrightness(Number(e.target.value))}
            />
            <span className="brightness-value">{centerBrightness}%</span>
          </div>

          <div className="btn-row">
            <button className="btn-send" onClick={() => handleSendLeds()} disabled={!isConnected}>
              Send
            </button>
          </div>
        </section>

        {/* Macros panel */}
        <section className="panel panel-macros">
          <div className="panel-header">
            <h2 className="panel-title">Macros</h2>
            <div className="panel-header-actions">
              <button className="btn-panel-action" onClick={handleImportMacros} title="Import macros from JSON file">Import</button>
              <button className="btn-panel-action" onClick={handleExportMacros} title="Export macros to JSON file">Export</button>
            </div>
          </div>
          {macros.length === 0 ? (
            <p className="macros-empty">No macros saved yet. Configure the panels and click Save Macro.</p>
          ) : (
            <div className="macro-list">
              {macros.map((macro, idx) => (
                <div
                  key={macro.id}
                  className="macro-entry"
                  draggable
                  onDragStart={() => { dragIndex.current = idx }}
                  onDragEnter={() => { dragOverIndex.current = idx }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnd={handleDragEnd}
                >
                  <div className="macro-entry-top">
                    <span className="macro-name">{macro.name}</span>
                    <div className="macro-actions">
                      <button
                        className="btn-saved-send"
                        onClick={() => handleSendMacro(macro)}
                        disabled={!isConnected}
                      >
                        Send
                      </button>
                      <button
                        className="btn-macro-load"
                        onClick={() => handleLoadMacro(macro)}
                        title="Load into panels"
                      >
                        Load
                      </button>
                      <button className="btn-saved-delete" onClick={() => handleDeleteMacro(macro.id)}>
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="macro-entry-detail">
                    <span className="macro-display-preview">
                      {macro.displayText.split('\n')[0] || '—'}
                    </span>
                    <div className="macro-swatches">
                      <span className="saved-led-swatch" style={{ background: macro.ledColor }} title={`Ring: ${macro.ledColor}`} />
                      <span className="saved-led-swatch" style={{ background: macro.centerColor }} title={`Center: ${macro.centerColor}`} />
                      <span className="macro-anim-label">{macro.ledAnimation}/{macro.centerAnimation}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Arduino Functions panel */}
        <section className="panel panel-functions">
          <div className="panel-header">
            <h2 className="panel-title">Functions</h2>
            <span
              className="panel-help-icon"
              title={'Sends {"event":"function","name":"<name>"} to the Arduino.\nHandle each name in dispatchFunction() in sketch.ino.'}
            >?</span>
            <div className="panel-header-actions">
              <button className="btn-panel-action" onClick={handleImportFunctions} title="Import functions from JSON file">Import</button>
              <button className="btn-panel-action" onClick={handleExportFunctions} title="Export functions to JSON file">Export</button>
            </div>
          </div>
          {arduinoFunctions.length === 0 && !showAddFunction ? (
            <p className="functions-empty">No functions saved yet. Click + to add one.</p>
          ) : (
            <div className="function-list">
              {arduinoFunctions.map((fn) => (
                <div key={fn.id} className="function-entry">
                  <div className="function-entry-top">
                    <span className="function-name">{fn.name}</span>
                    <div className="function-actions">
                      <button
                        className="btn-fn-run"
                        onClick={() => handleRunFunction(fn)}
                        disabled={!isConnected}
                      >
                        Run
                      </button>
                      <button
                        className="btn-saved-delete"
                        onClick={() => handleDeleteFunction(fn.id)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  {fn.description && (
                    <p className="function-desc">{fn.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          {showAddFunction ? (
            <div className="function-add-form">
              <input
                className="text-input function-name-input"
                value={newFnName}
                onChange={(e) => setNewFnName(e.target.value)}
                placeholder="Function name…"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddFunction()
                  if (e.key === 'Escape') { setShowAddFunction(false); setNewFnName(''); setNewFnDesc('') }
                }}
              />
              <input
                className="text-input function-desc-input"
                value={newFnDesc}
                onChange={(e) => setNewFnDesc(e.target.value)}
                placeholder="Description (optional)…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddFunction()
                  if (e.key === 'Escape') { setShowAddFunction(false); setNewFnName(''); setNewFnDesc('') }
                }}
              />
              <div className="btn-row">
                <button className="btn-save" onClick={handleAddFunction} disabled={!newFnName.trim()}>
                  Add
                </button>
                <button className="btn-clear" onClick={() => { setShowAddFunction(false); setNewFnName(''); setNewFnDesc('') }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button className="btn-fn-add" onClick={() => setShowAddFunction(true)}>+ Add Function</button>
          )}
        </section>
      </div>

      {/* Save macro bar */}
      <div className="save-bar">
        {showSaveBar ? (
          <>
            <input
              className="text-input macro-name-input"
              value={macroName}
              onChange={(e) => setMacroName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveMacro()
                if (e.key === 'Escape') { setShowSaveBar(false); setMacroName('') }
              }}
              placeholder="Macro name…"
              autoFocus
            />
            <button className="btn-save" onClick={handleSaveMacro} disabled={!macroName.trim()}>
              Save
            </button>
            <button className="btn-clear" onClick={() => { setShowSaveBar(false); setMacroName('') }}>
              Cancel
            </button>
          </>
        ) : (
          <>
            {loadedMacroId && (() => {
              const loaded = macros.find((m) => m.id === loadedMacroId)
              return loaded ? (
                <button className="btn-update-macro" onClick={handleUpdateMacro}>
                  Update “{loaded.name}”
                </button>
              ) : null
            })()}
            <button className="btn-save-macro" onClick={() => setShowSaveBar(true)}>
              {loadedMacroId ? 'Save as New…' : 'Save Macro'}
            </button>
          </>
        )}
      </div>

      {/* Payload history */}
      <div className="history">
        <div className="history-header">
          <span className="panel-title">Payload History</span>
          <button className="btn-clear" onClick={() => setHistory([])}>
            Clear
          </button>
        </div>
        <div className="history-log">
          {history.length === 0 ? (
            <span className="history-empty">No payloads sent yet.</span>
          ) : (
            history.map((entry) => (
              <div key={entry.id} className="history-entry">
                <span className="history-ts">{entry.timestamp}</span>
                <code className="history-payload">{JSON.stringify(entry.payload)}</code>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
