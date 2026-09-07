import { describe, it, expect } from 'vitest'
import type { TFunction } from 'i18next'
import { postcodePlaceholder } from './postcode'

const t = ((key: string) => `<${key}>`) as unknown as TFunction

describe('postcodePlaceholder (X-I18N-3)', () => {
  it('returns the market example for a known ISO-2 country, case-insensitively', () => {
    expect(postcodePlaceholder('NL', t)).toBe('1234 AB')
    expect(postcodePlaceholder('gb', t)).toBe('SW1A 1AA')
    expect(postcodePlaceholder('PT', t)).toBe('1000-001')
  })
  it('falls back to the locale placeholder key for an unknown, empty or named country', () => {
    expect(postcodePlaceholder('XX', t)).toBe('<common:placeholders.postcodeExample>')
    expect(postcodePlaceholder('', t)).toBe('<common:placeholders.postcodeExample>')
    expect(postcodePlaceholder('Nederland', t)).toBe('<common:placeholders.postcodeExample>')
  })
})
