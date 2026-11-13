import { describe, it, expect } from 'vitest'
import { EMAIL_CONTEXTS, toLegacyEmailContext, toCanonicalEmailContext } from './emailContexts'

// Wire-token pairs the BE routes and the OAuth callback still use.
const PAIRS: Array<[string, string]> = [
  ['customers', 'klanten'],
  ['candidates', 'kandidaten'],
  ['planning', 'planning'],
]

describe('emailContexts', () => {
  it('lists exactly the three canonical contexts', () => {
    expect([...EMAIL_CONTEXTS]).toEqual(['customers', 'candidates', 'planning'])
  })

  it.each(PAIRS)('maps canonical %s to the wire token %s', (canonical, legacy) => {
    expect(toLegacyEmailContext(canonical)).toBe(legacy)
  })

  // Reversed pair order so the title names the wire token first, as the assertion does.
  it.each(PAIRS.map(([canonical, legacy]) => [legacy, canonical]))('maps the wire token %s back to canonical %s', (legacy, canonical) => {
    expect(toCanonicalEmailContext(legacy)).toBe(canonical)
    expect(toCanonicalEmailContext(canonical)).toBe(canonical)
  })

  it('passes an unknown value through both ways', () => {
    expect(toLegacyEmailContext('other')).toBe('other')
    expect(toCanonicalEmailContext('other')).toBe('other')
  })
})
