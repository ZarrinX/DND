import { app, ipcMain } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { connect, disconnect, listPorts, sendPayload } from './serial/SerialManager'

const macrosPath = (): string => join(app.getPath('userData'), 'macros.json')

const TEST_PAYLOAD = {
  event: 'hp_change',
  display: {
    line1: 'DND Companion',
    line2: 'Serial OK',
  },
  leds: {
    color: '#00FF00',
    animation: 'pulse',
  },
}

export function registerIpcHandlers(): void {
  ipcMain.handle('serial:list-ports', () => listPorts())

  ipcMain.handle('serial:connect', (_event, path: string, baudRate: number) =>
    connect(path, baudRate),
  )

  ipcMain.handle('serial:disconnect', () => disconnect())

  ipcMain.handle('serial:send', (_event, payload: object) => sendPayload(payload))

  ipcMain.handle('serial:test-send', () => sendPayload(TEST_PAYLOAD))

  ipcMain.handle('macros:load', async () => {
    try {
      const data = await readFile(macrosPath(), 'utf-8')
      return JSON.parse(data)
    } catch {
      return []
    }
  })

  ipcMain.handle('macros:save', async (_event, macros: unknown[]) => {
    await writeFile(macrosPath(), JSON.stringify(macros, null, 2), 'utf-8')
  })
}
