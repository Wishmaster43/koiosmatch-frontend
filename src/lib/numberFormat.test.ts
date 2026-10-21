import { describe, it, expect } from 'vitest'
import { formatFileSizeMb, toFiniteNumber } from './numberFormat'

// GETALLEN-1 pure helpers with an explicit locale, importable without the i18n init.
describe('numberFormat', () => {
  it('coerces numeric strings and rejects blanks and non-numbers', () => {
    expect(toFiniteNumber('12.5')).toBe(12.5)
    expect(toFiniteNumber(3)).toBe(3)
    expect(toFiniteNumber('')).toBeNull()
    expect(toFiniteNumber(null)).toBeNull()
    expect(toFiniteNumber('abc')).toBeNull()
  })

  it('formats bytes as megabytes with the locale decimal mark and one decimal at most', () => {
    expect(formatFileSizeMb(10 * 1024 * 1024, 'nl-NL')).toBe('10')
    expect(formatFileSizeMb(2.5 * 1024 * 1024, 'nl-NL')).toBe('2,5')
    expect(formatFileSizeMb(2.5 * 1024 * 1024, 'en-GB')).toBe('2.5')
    expect(formatFileSizeMb(null)).toBe('—')
  })
})
