import { app, ipcMain, dialog } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { connect, disconnect, listPorts, sendPayload } from './serial/SerialManager'

const macrosPath = (): string => join(app.getPath('userData'), 'macros.json')
const functionsPath = (): string => join(app.getPath('userData'), 'functions.json')

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

  ipcMain.handle('macros:exportToFile', async (_event, macros: unknown[]) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Macros',
      defaultPath: 'macros.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (!canceled && filePath) {
      await writeFile(filePath, JSON.stringify(macros, null, 2), 'utf-8')
    }
  })

  ipcMain.handle('macros:importFromFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import Macros',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    })
    if (!canceled && filePaths[0]) {
      const data = await readFile(filePaths[0], 'utf-8')
      return JSON.parse(data)
    }
    return null
  })

  ipcMain.handle('functions:load', async () => {
    try {
      const data = await readFile(functionsPath(), 'utf-8')
      return JSON.parse(data)
    } catch {
      return []
    }
  })

  ipcMain.handle('functions:save', async (_event, functions: unknown[]) => {
    await writeFile(functionsPath(), JSON.stringify(functions, null, 2), 'utf-8')
  })

  ipcMain.handle('functions:exportToFile', async (_event, functions: unknown[]) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Functions',
      defaultPath: 'functions.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (!canceled && filePath) {
      await writeFile(filePath, JSON.stringify(functions, null, 2), 'utf-8')
    }
  })

  ipcMain.handle('functions:importFromFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import Functions',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    })
    if (!canceled && filePaths[0]) {
      const data = await readFile(filePaths[0], 'utf-8')
      return JSON.parse(data)
    }
    return null
  })
}
