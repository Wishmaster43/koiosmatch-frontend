import { describe, it, expect } from 'vitest'
import { resolveScopedQuery } from './mentionScope'

describe('resolveScopedQuery', () => {
  // No active category at all — always out of scope.
  it('returns null when there is no active category', () => {
    expect(resolveScopedQuery('Vacatures ahmed', null)).toBeNull()
  })

  // Label typed but no space/query yet — still scoped, empty query.
  it('returns an empty query right after the label (no trailing space typed)', () => {
    expect(resolveScopedQuery('Vacatures', 'Vacatures')).toBe('')
  })

  // The normal case: label + space + query.
  it('returns the text after the label', () => {
    expect(resolveScopedQuery('Vacatures verpleegkundige', 'Vacatures')).toBe('verpleegkundige')
  })

  // Case-insensitive match on the label itself.
  it('matches the label case-insensitively', () => {
    expect(resolveScopedQuery('vacatures ahmed', 'Vacatures')).toBe('ahmed')
  })

  // The user backspaced past the label (or started a new "@") — exit scope.
  it('returns null once the tail no longer starts with the label', () => {
    expect(resolveScopedQuery('Vacat', 'Vacatures')).toBeNull()
    expect(resolveScopedQuery('Klanten ahmed', 'Vacatures')).toBeNull()
  })

  // A query that merely CONTAINS the label elsewhere doesn't count as scoped.
  it('requires the label as a prefix, not a substring', () => {
    expect(resolveScopedQuery('ahmed Vacatures', 'Vacatures')).toBeNull()
  })
})
