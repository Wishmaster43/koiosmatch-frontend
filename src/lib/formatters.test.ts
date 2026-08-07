import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { formatNumber, formatNumberCompact, formatCurrency, useNumberFormat } from './formatters'

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

describe('formatCurrency', () => {
  // RTL/Intl inserts a non-breaking space after the symbol in nl-NL — normalize
  // it to a regular space so the assertion doesn't depend on that detail.
  const norm = (s: string) => s.replace(/\u00A0/g, ' ')

  it('formats EUR by default in the nl-NL grouping/symbol order', () => {
    expect(norm(formatCurrency(5.12))).toBe('€ 5,12')
  })

  it('follows an explicit currency + locale', () => {
    expect(formatCurrency(5.12, 'USD', 'en-US')).toBe('$5.12')
  })

  it('shows an em-dash for missing/unparseable input', () => {
    expect(formatCurrency(null)).toBe('—')
    expect(formatCurrency(undefined)).toBe('—')
    expect(formatCurrency('not-a-number')).toBe('—')
  })
})

// Note: i18n is not initialised in tests → locale falls back to nl-NL (§3B), same as datetime.test.ts.
describe('useNumberFormat', () => {
  it('binds formatNumber/formatNumberCompact/formatCurrency to the active locale', () => {
    const { result } = renderHook(() => useNumberFormat())
    expect(result.current.formatNumber(99968)).toBe('99.968')
    expect(result.current.formatNumberCompact(99968).toLowerCase()).toContain('k')
    expect(result.current.formatCurrency(5.12).replace(/\u00A0/g, ' ')).toBe('€ 5,12')
  })
})
