import { validatePayload } from '../src/main/serial/payloadValidator'

const validLeds = {
  color: '#ff0000',
  animation: 'pulse',
  brightness: 75,
  center: { color: '#00ff00', animation: 'solid', brightness: 50, invertPhase: false },
}

const validDisplay = { line1: 'Hello', line2: 'World' }

describe('validatePayload', () => {
  // ── manual ─────────────────────────────────────────────────────────────
  it('accepts a valid manual payload', () => {
    const result = validatePayload({ event: 'manual', leds: validLeds })
    expect(result).toMatchObject({ event: 'manual' })
  })

  // ── macro ──────────────────────────────────────────────────────────────
  it('accepts a valid macro payload', () => {
    const result = validatePayload({ event: 'macro', display: validDisplay, leds: validLeds })
    expect(result).toMatchObject({ event: 'macro' })
  })

  // ── display ────────────────────────────────────────────────────────────
  it('accepts a valid display payload', () => {
    const result = validatePayload({ event: 'display', display: validDisplay })
    expect(result).toMatchObject({ event: 'display' })
  })

  // ── function ───────────────────────────────────────────────────────────
  it('accepts a valid function payload', () => {
    const result = validatePayload({ event: 'function', name: 'roll_dice' })
    expect(result).toMatchObject({ event: 'function', name: 'roll_dice' })
  })

  it('rejects function payload with empty name', () => {
    expect(() => validatePayload({ event: 'function', name: '' })).toThrow()
  })

  it('rejects function payload with whitespace-only name', () => {
    expect(() => validatePayload({ event: 'function', name: '   ' })).toThrow()
  })

  it('rejects function payload missing name', () => {
    expect(() => validatePayload({ event: 'function' })).toThrow()
  })

  // ── event validation ───────────────────────────────────────────────────
  it('rejects payload with missing event', () => {
    expect(() => validatePayload({ leds: validLeds })).toThrow()
  })

  it('rejects payload with unknown event', () => {
    expect(() => validatePayload({ event: 'explode' })).toThrow()
  })

  it('rejects non-object payload', () => {
    expect(() => validatePayload('not an object')).toThrow()
    expect(() => validatePayload(null)).toThrow()
    expect(() => validatePayload(42)).toThrow()
  })

  // ── leds validation ────────────────────────────────────────────────────
  it('rejects invalid animation on leds', () => {
    expect(() =>
      validatePayload({ event: 'manual', leds: { ...validLeds, animation: 'strobe' } }),
    ).toThrow(/animation/)
  })

  it('rejects invalid animation on leds.center', () => {
    expect(() =>
      validatePayload({
        event: 'manual',
        leds: { ...validLeds, center: { ...validLeds.center, animation: 'blink' } },
      }),
    ).toThrow(/animation/)
  })

  it('rejects brightness below 1', () => {
    expect(() =>
      validatePayload({ event: 'manual', leds: { ...validLeds, brightness: 0 } }),
    ).toThrow(/brightness/)
  })

  it('rejects brightness above 100', () => {
    expect(() =>
      validatePayload({ event: 'manual', leds: { ...validLeds, brightness: 101 } }),
    ).toThrow(/brightness/)
  })

  it('rejects non-numeric brightness', () => {
    expect(() =>
      validatePayload({ event: 'manual', leds: { ...validLeds, brightness: '50' } }),
    ).toThrow(/brightness/)
  })

  it('rejects invalid hex color', () => {
    expect(() =>
      validatePayload({ event: 'manual', leds: { ...validLeds, color: 'red' } }),
    ).toThrow(/color/)
  })

  it('rejects color missing hash', () => {
    expect(() =>
      validatePayload({ event: 'manual', leds: { ...validLeds, color: 'ff0000' } }),
    ).toThrow(/color/)
  })

  it('rejects leds that is not an object', () => {
    expect(() => validatePayload({ event: 'manual', leds: null })).toThrow()
  })

  // ── display validation ─────────────────────────────────────────────────
  it('rejects display with non-string line value', () => {
    expect(() =>
      validatePayload({ event: 'display', display: { line1: 42 } }),
    ).toThrow(/line1/)
  })

  it('accepts display with only some lines present', () => {
    const result = validatePayload({ event: 'display', display: { line3: 'hi' } })
    expect(result).toMatchObject({ event: 'display', display: { line3: 'hi' } })
  })

  // ── invertPhase default ────────────────────────────────────────────────
  it('defaults invertPhase to false when missing', () => {
    const { center } = (validatePayload({
      event: 'manual',
      leds: { ...validLeds, center: { color: '#ffffff', animation: 'solid', brightness: 100 } },
    }) as { leds: { center: { invertPhase: boolean } } }).leds
    expect(center.invertPhase).toBe(false)
  })
})
