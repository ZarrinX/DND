import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'

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

contextBridge.exposeInMainWorld('macrosApi', {
  load: (): Promise<unknown[]> => ipcRenderer.invoke('macros:load'),
  save: (macros: unknown[]): Promise<void> => ipcRenderer.invoke('macros:save', macros),
})

contextBridge.exposeInMainWorld('serialApi', {
  listPorts: (): Promise<PortInfo[]> => ipcRenderer.invoke('serial:list-ports'),

  connect: (path: string, baudRate: number): Promise<void> =>
    ipcRenderer.invoke('serial:connect', path, baudRate),

  disconnect: (): Promise<void> => ipcRenderer.invoke('serial:disconnect'),

  send: (payload: object): Promise<void> => ipcRenderer.invoke('serial:send', payload),

  testSend: (): Promise<void> => ipcRenderer.invoke('serial:test-send'),

  onStatus: (callback: (event: SerialStatusEvent) => void): (() => void) => {
    const handler = (_: IpcRendererEvent, event: SerialStatusEvent): void => callback(event)
    ipcRenderer.on('serial:status', handler)
    return () => ipcRenderer.removeListener('serial:status', handler)
  },
})
