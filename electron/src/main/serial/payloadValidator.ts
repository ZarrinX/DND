import type { ArduinoPayload, CenterLeds, DisplayLines, LedConfig, LedAnimation } from '../../shared/types'

const VALID_EVENTS = new Set(['manual', 'macro', 'display', 'function'])
const VALID_ANIMATIONS = new Set<LedAnimation>(['solid', 'pulse', 'flash'])

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function validateAnimation(value: unknown, path: string): LedAnimation {
  if (!VALID_ANIMATIONS.has(value as LedAnimation)) {
    throw new Error(`Invalid animation "${value}" at ${path}; expected solid | pulse | flash`)
  }
  return value as LedAnimation
}

function validateBrightness(value: unknown, path: string): number {
  if (typeof value !== 'number' || value < 1 || value > 100) {
    throw new Error(`Invalid brightness "${value}" at ${path}; expected number 1–100`)
  }
  return value
}

function validateColor(value: unknown, path: string): string {
  if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    throw new Error(`Invalid color "${value}" at ${path}; expected hex string e.g. #ff0000`)
  }
  return value
}

function validateCenterLeds(raw: unknown): CenterLeds {
  if (!isRecord(raw)) throw new Error('leds.center must be an object')
  return {
    color: validateColor(raw['color'], 'leds.center.color'),
    animation: validateAnimation(raw['animation'], 'leds.center.animation'),
    brightness: validateBrightness(raw['brightness'], 'leds.center.brightness'),
    invertPhase: typeof raw['invertPhase'] === 'boolean' ? raw['invertPhase'] : false,
  }
}

function validateLedConfig(raw: unknown): LedConfig {
  if (!isRecord(raw)) throw new Error('leds must be an object')
  return {
    color: validateColor(raw['color'], 'leds.color'),
    animation: validateAnimation(raw['animation'], 'leds.animation'),
    brightness: validateBrightness(raw['brightness'], 'leds.brightness'),
    center: validateCenterLeds(raw['center']),
  }
}

function validateDisplayLines(raw: unknown): DisplayLines {
  if (!isRecord(raw)) throw new Error('display must be an object')
  const result: DisplayLines = {}
  for (const key of ['line1', 'line2', 'line3', 'line4', 'line5', 'line6'] as const) {
    if (key in raw) {
      if (typeof raw[key] !== 'string') throw new Error(`display.${key} must be a string`)
      result[key] = raw[key] as string
    }
  }
  return result
}

export function validatePayload(raw: unknown): ArduinoPayload {
  if (!isRecord(raw)) throw new Error('Payload must be a non-null object')

  const event = raw['event']
  if (typeof event !== 'string' || !VALID_EVENTS.has(event)) {
    throw new Error(`Invalid event "${event}"; expected manual | macro | display | function`)
  }

  switch (event) {
    case 'manual':
      return { event: 'manual', leds: validateLedConfig(raw['leds']) }

    case 'macro':
      return {
        event: 'macro',
        display: validateDisplayLines(raw['display']),
        ...(raw['scale'] === 2 ? { scale: 2 as const } : { scale: 1 as const }),
        displayAnimation: VALID_ANIMATIONS.has(raw['displayAnimation'] as LedAnimation)
          ? raw['displayAnimation'] as LedAnimation
          : 'solid',
        leds: validateLedConfig(raw['leds']),
      }

    case 'display':
      return {
        event: 'display',
        display: validateDisplayLines(raw['display']),
        ...(raw['scale'] === 2 ? { scale: 2 as const } : { scale: 1 as const }),
        displayAnimation: VALID_ANIMATIONS.has(raw['displayAnimation'] as LedAnimation)
          ? raw['displayAnimation'] as LedAnimation
          : 'solid',
      }

    case 'function': {
      const name = raw['name']
      if (typeof name !== 'string' || name.trim() === '') {
        throw new Error('function payload requires a non-empty "name" string')
      }
      return { event: 'function', name }
    }

    default:
      throw new Error(`Unhandled event type "${event}"`)
  }
}
