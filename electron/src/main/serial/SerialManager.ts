import { SerialPort } from 'serialport'
import { BrowserWindow } from 'electron'

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
    })
  })
}

export async function disconnect(): Promise<void> {
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
  const line = JSON.stringify(payload) + '\n'
  writeQueue.push(line)
  drainQueue()
}

function drainQueue(): void {
  if (draining || writeQueue.length === 0 || !activePort?.isOpen) return
  draining = true
  const line = writeQueue.shift()!
  activePort!.write(line, (err) => {
    draining = false
    if (err) {
      broadcast('serial:error', { error: err.message })
    }
    drainQueue()
  })
}
