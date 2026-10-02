/**
 * booleanField helpers — the condition-value text/list readers shared by the edge
 * filter control and the config-panel filters field (FILTER-VALUE-1 follow-up).
 */
import { describe, it, expect } from 'vitest'
import { textValue, listValueItems } from './booleanField'

describe('textValue', () => {
  it('returns a string as is and an empty string for undefined', () => {
    expect(textValue('now-90d')).toBe('now-90d')
    expect(textValue(undefined)).toBe('')
  })

  it('renders a boolean as its word', () => {
    expect(textValue(true)).toBe('true')
    expect(textValue(false)).toBe('false')
  })

  it('joins a seeded array with commas (never the raw array into an input)', () => {
    expect(textValue(['a', 'b', 'c'])).toBe('a,b,c')
    expect(textValue([])).toBe('')
  })
})

describe('listValueItems', () => {
  it('keeps a seeded array as its items', () => {
    expect(listValueItems(['a', 'b', 'c'])).toEqual(['a', 'b', 'c'])
  })

  it('splits a comma string, trims and drops empties', () => {
    expect(listValueItems(' a, b ,,c ')).toEqual(['a', 'b', 'c'])
    expect(listValueItems('')).toEqual([])
  })

  it('reads a stray boolean or undefined as an empty or single-word list', () => {
    expect(listValueItems(undefined)).toEqual([])
    expect(listValueItems(true)).toEqual(['true'])
  })
})
