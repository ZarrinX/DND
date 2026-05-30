export type LedAnimation = 'solid' | 'pulse' | 'flash'

export interface CenterLeds {
  color: string
  animation: LedAnimation
  brightness: number
  invertPhase: boolean
}

export interface LedConfig {
  color: string
  animation: LedAnimation
  brightness: number
  center: CenterLeds
}

export type DisplayLines = Partial<Record<'line1' | 'line2' | 'line3' | 'line4' | 'line5' | 'line6', string>>

export interface DisplayPayload {
  event: 'display'
  display: DisplayLines
  scale?: 1 | 2
  displayAnimation?: LedAnimation
}

export interface MacroPayload {
  event: 'macro'
  display: DisplayLines
  scale?: 1 | 2
  displayAnimation?: LedAnimation
  leds: LedConfig
}

export interface FunctionPayload {
  event: 'function'
  name: string
}

export type ArduinoPayload = ManualPayload | MacroPayload | DisplayPayload | FunctionPayload
