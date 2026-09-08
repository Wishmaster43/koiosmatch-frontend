/**
 * numberParse — locale-aware reading of typed numbers (the inverse of formatNumber).
 */
import { describe, it, expect } from 'vitest'
import { parseLocaleNumber, localeSeparators } from './numberParse'

describe('localeSeparators', () => {
  it('knows the Dutch and English separators', () => {
    expect(localeSeparators('nl-NL')).toEqual({ group: '.', decimal: ',' })
    expect(localeSeparators('en-GB')).toEqual({ group: ',', decimal: '.' })
  })
})

describe('parseLocaleNumber', () => {
  it('reads grouped and decimal Dutch input', () => {
    expect(parseLocaleNumber('1.250', 'nl-NL')).toBe(1250)
    expect(parseLocaleNumber('1.250,50', 'nl-NL')).toBe(1250.5)
    expect(parseLocaleNumber('99,00', 'nl-NL')).toBe(99)
    expect(parseLocaleNumber('1.000.000', 'nl-NL')).toBe(1000000)
  })

  it('reads English input the same way', () => {
    expect(parseLocaleNumber('1,250', 'en-GB')).toBe(1250)
    expect(parseLocaleNumber('1,250.50', 'en-GB')).toBe(1250.5)
    expect(parseLocaleNumber('0.05', 'en-GB')).toBe(0.05)
  })

  it('tolerates a pasted decimal written with the other separator', () => {
    expect(parseLocaleNumber('1250.5', 'nl-NL')).toBe(1250.5)
    expect(parseLocaleNumber('0.05', 'nl-NL')).toBe(0.05)
  })

  it('returns null for empty or unreadable text', () => {
    expect(parseLocaleNumber('', 'nl-NL')).toBeNull()
    expect(parseLocaleNumber('abc', 'nl-NL')).toBeNull()
    expect(parseLocaleNumber('-', 'nl-NL')).toBeNull()
  })

  it('reads plain digits and negatives', () => {
    expect(parseLocaleNumber('1250', 'nl-NL')).toBe(1250)
    expect(parseLocaleNumber('-12', 'nl-NL')).toBe(-12)
  })
})
