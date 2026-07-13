import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { formatNumber, formatNumberCompact, useNumberFormat } from './formatters'

describe('formatNumber', () => {
  it('groups thousands with the nl-NL separator by default', () => {
    expect(formatNumber(99968)).toBe('99.968')
  })

  it('follows an explicit locale', () => {
    expect(formatNumber(99968, 'en-GB')).toBe('99,968')
  })

  it('shows an em-dash for missing/unparseable input', () => {
    expect(formatNumber(null)).toBe('—')
    expect(formatNumber(undefined)).toBe('—')
    expect(formatNumber('not-a-number')).toBe('—')
  })

  it('accepts a numeric string', () => {
    expect(formatNumber('1501')).toBe('1.501')
  })
})

describe('formatNumberCompact', () => {
  it('keeps values under the threshold fully grouped', () => {
    expect(formatNumberCompact(9999)).toBe('9.999')
  })

  it('switches to compact notation once the threshold is exceeded', () => {
    const compact = formatNumberCompact(99968)
    expect(compact.toLowerCase()).toContain('k')
  })

  it('respects a custom threshold', () => {
    expect(formatNumberCompact(1234, 'nl-NL', 1000).toLowerCase()).toContain('k')
  })
})

// Note: i18n is not initialised in tests → locale falls back to nl-NL (§3B), same as datetime.test.ts.
describe('useNumberFormat', () => {
  it('binds formatNumber/formatNumberCompact to the active locale', () => {
    const { result } = renderHook(() => useNumberFormat())
    expect(result.current.formatNumber(99968)).toBe('99.968')
    expect(result.current.formatNumberCompact(99968).toLowerCase()).toContain('k')
  })
})
