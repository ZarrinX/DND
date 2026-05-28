export {}

declare global {
  interface Window {
    macrosApi?: {
      load(): Promise<unknown[]>
      save(macros: unknown[]): Promise<void>
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
