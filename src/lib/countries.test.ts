import { describe, it, expect } from 'vitest'
import { COUNTRY_CODES, getCountryName, getCountryOptions } from './countries'

// COUNTRY-1: the code list is fixed DATA, names resolve per-locale via Intl —
// covers the resolution, the NL/BE/DE priority ordering, and a graceful fallback.
describe('countries', () => {
  it('resolves a code to its localized display name', () => {
    expect(getCountryName('NL', 'nl')).toBe('Nederland')
    expect(getCountryName('NL', 'en')).toBe('Netherlands')
  })

  it('falls back to the bare code for a malformed value', () => {
    expect(getCountryName('ABC', 'nl')).toBe('ABC')
    expect(getCountryName('', 'nl')).toBe('')
  })

  it('lists NL/BE/DE first, then the rest alphabetically by localized label', () => {
    const options = getCountryOptions('nl')
    expect(options.slice(0, 3).map(o => o.value)).toEqual(['NL', 'BE', 'DE'])
    const restLabels = options.slice(3).map(o => o.label)
    const sorted = [...restLabels].sort((a, b) => a.localeCompare(b, 'nl-NL'))
    expect(restLabels).toEqual(sorted)
  })

  it('covers every country exactly once', () => {
    const options = getCountryOptions('en')
    expect(options).toHaveLength(COUNTRY_CODES.length)
    expect(new Set(options.map(o => o.value)).size).toBe(COUNTRY_CODES.length)
  })
})
