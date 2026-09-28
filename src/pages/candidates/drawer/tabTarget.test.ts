import { describe, it, expect } from 'vitest'
import { parseTabTarget } from './tabTarget'

// Covers the shared deep-link contract: plain id, tab:sub, tab:sub:action,
// empty/null/undefined, extra colons, and unknown tabs (validation is the
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

  it('parses a tab:sub:action target (CONVERSATION-START-1)', () => {
    expect(parseTabTarget('communication:conversations:start')).toEqual({ tab: 'communication', sub: 'conversations', action: 'start' })
  })

  it('leaves a two-segment target unchanged', () => {
    expect(parseTabTarget('work:experience')).toEqual({ tab: 'work', sub: 'experience' })
  })

  it('folds extra colons beyond the third segment into action', () => {
    expect(parseTabTarget('work:matches:extra:more')).toEqual({ tab: 'work', sub: 'matches', action: 'extra:more' })
  })

  it('parses an unknown tab id unchanged (validation is the consumer\'s job)', () => {
    expect(parseTabTarget('unknownTab:unknownSub')).toEqual({ tab: 'unknownTab', sub: 'unknownSub' })
  })
})
