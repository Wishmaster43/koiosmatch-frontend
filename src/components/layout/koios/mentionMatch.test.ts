import { describe, it, expect } from 'vitest'
import { matchMentionQuery } from './mentionMatch'

describe('matchMentionQuery', () => {
  // No "@" at all — never an active mention.
  it('returns null when there is no "@"', () => {
    expect(matchMentionQuery('hello world')).toBeNull()
  })

  // Typing "@" alone opens the menu with an empty query.
  it('returns an empty query right after typing "@"', () => {
    expect(matchMentionQuery('hi @')).toBe('')
  })

  // The historical bug: the old `/^\w*$/` regex stopped at the first space, so
  // "@ahmed vos" never reached the second word. A query may now contain spaces.
  it('keeps matching across a space (the space-stopping bug)', () => {
    expect(matchMentionQuery('@ahmed vos')).toBe('ahmed vos')
  })

  // Multiple internal spaces are still a valid (if odd) in-progress query.
  it('allows multiple spaces', () => {
    expect(matchMentionQuery('@ahmed   vos')).toBe('ahmed   vos')
  })

  // Digits are allowed (e.g. a candidate reference number typed after "@").
  it('allows digits', () => {
    expect(matchMentionQuery('@ahmed2 vos99')).toBe('ahmed2 vos99')
  })

  // Unicode letters (accents, other scripts) must not break the match.
  it('is unicode-safe', () => {
    expect(matchMentionQuery('@özlem müller')).toBe('özlem müller')
    expect(matchMentionQuery('@李 明')).toBe('李 明')
  })

  // Only the LAST "@" in the value counts (typing a second mention restarts it).
  it('matches from the last "@" onward', () => {
    expect(matchMentionQuery('@candidates hi @ahmed')).toBe('ahmed')
  })

  // A newline after "@" means the user moved on (Shift+Enter) — close the menu.
  it('closes the mention on a newline', () => {
    expect(matchMentionQuery('@ahmed\nvos')).toBeNull()
  })

  // Punctuation not in the allow-list closes the mention (e.g. an email-like paste).
  it('closes the mention on disallowed punctuation', () => {
    expect(matchMentionQuery('@ahmed.vos')).toBeNull()
    expect(matchMentionQuery('@ahmed!vos')).toBeNull()
  })

  // A runaway match is capped at 40 characters.
  it('caps the query length at 40 characters', () => {
    const long = 'a'.repeat(40)
    const tooLong = 'a'.repeat(41)
    expect(matchMentionQuery('@' + long)).toBe(long)
    expect(matchMentionQuery('@' + tooLong)).toBeNull()
  })
})
