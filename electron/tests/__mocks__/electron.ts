// Minimal Electron mock for unit tests running in Node (not Electron)
export const ipcMain = {
  handle: jest.fn(),
  on: jest.fn(),
  removeHandler: jest.fn(),
}

export const BrowserWindow = {
  getAllWindows: jest.fn(() => []),
}

export const app = {
  whenReady: jest.fn(() => Promise.resolve()),
  on: jest.fn(),
  quit: jest.fn(),
}
