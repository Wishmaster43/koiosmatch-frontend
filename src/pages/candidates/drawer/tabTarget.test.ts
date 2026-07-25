import { describe, it, expect } from 'vitest'
import { parseTabTarget } from './tabTarget'

// Covers the shared deep-link contract: plain id, tab:sub, empty/null/undefined,
// extra colons (split on first only), and unknown tabs (validation is the
// consumer's job, not the parser's).
describe('parseTabTarget', () => {
  it('parses a plain tab id (NAV-BACK-1 rememberedTab shape)', () => {
    expect(parseTabTarget('work')).toEqual({ tab: 'work' })
  })

  it('parses a tab:sub target', () => {
    expect(parseTabTarget('work:matches')).toEqual({ tab: 'work', sub: 'matches' })
  })

  it('parses a tab with no sub-tabs', () => {
    expect(parseTabTarget('preferences')).toEqual({ tab: 'preferences' })
  })

  it('returns null for empty string, null and undefined', () => {
    expect(parseTabTarget('')).toBeNull()
    expect(parseTabTarget(null)).toBeNull()
    expect(parseTabTarget(undefined)).toBeNull()
  })

  it('splits on the first colon only', () => {
    expect(parseTabTarget('work:matches:extra')).toEqual({ tab: 'work', sub: 'matches:extra' })
  })

  it('parses an unknown tab id unchanged (validation is the consumer\'s job)', () => {
    expect(parseTabTarget('unknownTab:unknownSub')).toEqual({ tab: 'unknownTab', sub: 'unknownSub' })
  })
})
