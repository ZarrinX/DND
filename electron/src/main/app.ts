import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { readFile, writeFile } from 'fs/promises'
import { registerIpcHandlers } from './ipc'

const boundsFile = (): string => join(app.getPath('userData'), 'window-bounds.json')

async function loadBounds(): Promise<{ x: number; y: number; width: number; height: number } | null> {
  try {
    const data = await readFile(boundsFile(), 'utf-8')
    return JSON.parse(data)
  } catch {
    return null
  }
}

async function saveBounds(win: BrowserWindow): Promise<void> {
  if (win.isMaximized() || win.isMinimized()) return
  try {
    await writeFile(boundsFile(), JSON.stringify(win.getBounds()), 'utf-8')
  } catch { /* ignore */ }
}

let mainWindow: BrowserWindow | null = null

async function createWindow(): Promise<void> {
  const savedBounds = await loadBounds()

  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(__dirname, '../../resources/icon.png')

  mainWindow = new BrowserWindow({
    width: savedBounds?.width ?? 1200,
    height: savedBounds?.height ?? 800,
    x: savedBounds?.x,
    y: savedBounds?.y,
    minWidth: 800,
    minHeight: 600,
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.on('resize', () => { if (mainWindow) void saveBounds(mainWindow) })
  mainWindow.on('move', () => { if (mainWindow) void saveBounds(mainWindow) })

  // Dev: electron-vite starts a Vite dev server and sets this env var
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  registerIpcHandlers()
  await createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
