export {}

declare global {
  interface Window {
    macrosApi?: {
      load(): Promise<unknown[]>
      save(macros: unknown[]): Promise<void>
      exportToFile(macros: unknown[]): Promise<void>
      importFromFile(): Promise<unknown[] | null>
    }
    functionsApi?: {
      load(): Promise<unknown[]>
      save(functions: unknown[]): Promise<void>
      exportToFile(functions: unknown[]): Promise<void>
      importFromFile(): Promise<unknown[] | null>
    }
    serialApi?: {
      listPorts(): Promise<Array<{ path: string; manufacturer?: string; serialNumber?: string }>>
      connect(path: string, baudRate: number): Promise<void>
      disconnect(): Promise<void>
      send(payload: object): Promise<void>
      testSend(): Promise<void>
      onStatus(
        callback: (event: {
          status: 'disconnected' | 'connecting' | 'connected' | 'error'
          port?: string
          error?: string
        }) => void,
      ): () => void
    }
  }
}
