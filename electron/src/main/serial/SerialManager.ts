import { SerialPort } from 'serialport'
import { BrowserWindow } from 'electron'
import { validatePayload } from './payloadValidator'

export type SerialStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface PortInfo {
  path: string
  manufacturer?: string
  serialNumber?: string
}

export interface SerialStatusEvent {
  status: SerialStatus
  port?: string
  error?: string
}

let activePort: SerialPort | null = null
let writeQueue: string[] = []
let draining = false
let drainingTimer: ReturnType<typeof setTimeout> | null = null

// Reconnect state
let lastPath: string | null = null
let lastBaudRate = 115200
let intentionalDisconnect = false
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

const WRITE_QUEUE_MAX = 3    // drop oldest if backlog grows — keep latest state
const WRITE_TIMEOUT_MS = 2000 // safety reset if drain() callback never fires
const RECONNECT_INTERVAL_MS = 3000

function broadcast(channel: string, payload: unknown): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send(channel, payload)
  })
}

export async function listPorts(): Promise<PortInfo[]> {
  const ports = await SerialPort.list()
  return ports.map((p) => ({
    path: p.path,
    manufacturer: p.manufacturer,
    serialNumber: p.serialNumber,
  }))
}

export async function connect(path: string, baudRate: number): Promise<void> {
  if (activePort?.isOpen) {
    await disconnect()
  }

  // Track for reconnect; cancel any pending reconnect attempt
  lastPath = path
  lastBaudRate = baudRate
  intentionalDisconnect = false
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }

  broadcast('serial:status', { status: 'connecting', port: path } satisfies SerialStatusEvent)

  return new Promise((resolve, reject) => {
    activePort = new SerialPort({ path, baudRate }, (err) => {
      if (err) {
        broadcast('serial:status', {
          status: 'error',
          port: path,
          error: err.message,
        } satisfies SerialStatusEvent)
        reject(err)
        return
      }
      broadcast('serial:status', { status: 'connected', port: path } satisfies SerialStatusEvent)
      resolve()
    })

    activePort.on('error', (err: Error) => {
      broadcast('serial:status', {
        status: 'error',
        port: path,
        error: err.message,
      } satisfies SerialStatusEvent)
    })

    activePort.on('close', () => {
      broadcast('serial:status', { status: 'disconnected' } satisfies SerialStatusEvent)
      activePort = null
      writeQueue = []
      draining = false
      if (drainingTimer) { clearTimeout(drainingTimer); drainingTimer = null }
      // Auto-reconnect if the port closed unexpectedly (e.g. USB unplug)
      if (!intentionalDisconnect) scheduleReconnect()
    })
  })
}

function scheduleReconnect(): void {
  if (intentionalDisconnect || !lastPath) return
  broadcast('serial:status', { status: 'connecting', port: lastPath } satisfies SerialStatusEvent)
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null
    if (intentionalDisconnect || !lastPath) return
    try {
      await connect(lastPath, lastBaudRate)
    } catch {
      scheduleReconnect() // keep retrying until user disconnects or plug-in succeeds
    }
  }, RECONNECT_INTERVAL_MS)
}

export async function disconnect(): Promise<void> {
  intentionalDisconnect = true
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
  if (!activePort?.isOpen) return
  return new Promise((resolve) => {
    activePort!.close(() => {
      activePort = null
      writeQueue = []
      resolve()
    })
  })
}

export function sendPayload(payload: object): void {
  if (!activePort?.isOpen) {
    throw new Error('Not connected to a serial port')
  }
  const validated = validatePayload(payload)
  const line = JSON.stringify(validated) + '\n'
  // Cap queue: drop oldest stale commands so the device always gets the latest state
  while (writeQueue.length >= WRITE_QUEUE_MAX) writeQueue.shift()
  writeQueue.push(line)
  drainQueue()
}

function drainQueue(): void {
  if (draining || writeQueue.length === 0 || !activePort?.isOpen) return
  draining = true

  // Safety net: if drain() never calls back (e.g. port silently broken), unblock after timeout
  drainingTimer = setTimeout(() => {
    drainingTimer = null
    draining = false
    drainQueue()
  }, WRITE_TIMEOUT_MS)

  const line = writeQueue.shift()!
  activePort!.write(line, (writeErr) => {
    if (writeErr) {
      if (drainingTimer) { clearTimeout(drainingTimer); drainingTimer = null }
      draining = false
      broadcast('serial:error', { error: writeErr.message })
      drainQueue()
      return
    }
    // Wait for OS to finish transmitting before starting the next write.
    // Without this, write() callbacks fire as soon as bytes hit the OS buffer,
    // allowing rapid sends to flood the Arduino's USB-CDC receive buffer.
    activePort!.drain((drainErr) => {
      if (drainingTimer) { clearTimeout(drainingTimer); drainingTimer = null }
      draining = false
      if (drainErr) broadcast('serial:error', { error: drainErr.message })
      drainQueue()
    })
  })
}
