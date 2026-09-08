import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { formatNumber, formatNumberCompact, formatCurrency, formatPercent, formatRatio, formatDistanceKm, formatFileSizeMb, formatCoord, formatSeconds, useNumberFormat } from './formatters'

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

// FMT-PROCENT-1 — the bug that made this helper exist: a matches KPI printed
// "5,882%" because the value went through the plain number formatter.
describe('formatPercent / formatRatio', () => {
  it('caps a percentage at one decimal instead of printing three', () => {
    expect(formatPercent((2 / 34) * 100)).toBe('5,9%')
  })

  it('keeps a whole percentage whole', () => {
    expect(formatPercent(50)).toBe('50%')
  })

  it('turns a fraction of one into the same one-decimal percentage', () => {
    expect(formatRatio(2 / 34)).toBe('5,9%')
    expect(formatRatio(0.5)).toBe('50%')
  })

  it('renders the house dash for a missing value, never a fabricated 0%', () => {
    expect(formatPercent(null)).toBe('—')
    expect(formatPercent(undefined)).toBe('—')
    expect(formatRatio(null)).toBe('—')
  })

  it('follows the locale separator', () => {
    expect(formatPercent(5.882, 'en-GB')).toBe('5.9%')
  })
})

describe('formatDistanceKm / formatFileSizeMb / formatCoord / formatSeconds', () => {
  it('formats distance with max 1 decimal and locale grouping', () => {
    expect(formatDistanceKm(12.34)).toBe('12,3')
    expect(formatDistanceKm(12.34, 'en-GB')).toBe('12.3')
  })

  it('formats file size in MB with max 1 decimal', () => {
    expect(formatFileSizeMb(123.45 * 1024 * 1024)).toBe('123,5')
    expect(formatFileSizeMb(123.45 * 1024 * 1024, 'en-GB')).toBe('123.5')
  })

  it('formats coordinates with fixed 5 decimals, locale-independent', () => {
    expect(formatCoord(52.3667)).toBe('52.36670')
    expect(formatCoord(52.3667)).toBe('52.36670')
  })

  it('formats seconds from milliseconds with max 1 decimal', () => {
    expect(formatSeconds(1234)).toBe('1,2')
    expect(formatSeconds(1234, 'en-GB')).toBe('1.2')
  })

  it('returns dash for invalid/null input on all new formatters', () => {
    expect(formatDistanceKm(null)).toBe('—')
    expect(formatFileSizeMb(undefined)).toBe('—')
    expect(formatCoord('invalid')).toBe('—')
    expect(formatSeconds(NaN)).toBe('—')
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
