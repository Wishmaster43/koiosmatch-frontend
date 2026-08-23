/**
 * textDiff — word-level LCS diff, covering identical text, full replacement,
 * a mid-text insertion, a removal, and the O(n*m) performance-guard cutoff.
 */
import { describe, it, expect } from 'vitest'
import { diffWords } from './textDiff'

describe('diffWords', () => {
  it('returns a single same segment for identical text', () => {
    const result = diffWords('hello world', 'hello world')
    expect(result).toEqual([{ type: 'same', text: 'hello world' }])
  })

  it('returns removed then added for a full replacement', () => {
    const result = diffWords('foo bar', 'baz qux')
    expect(result).toEqual([
      { type: 'removed', text: 'foo bar' },
      { type: 'added', text: 'baz qux' },
    ])
  })

  it('detects an addition inserted in the middle', () => {
    const result = diffWords('one two four', 'one two three four')
    expect(result).toEqual([
      { type: 'same', text: 'one two' },
      { type: 'added', text: 'three' },
      { type: 'same', text: 'four' },
    ])
  })

  it('detects a removal from the middle', () => {
    const result = diffWords('one two three four', 'one two four')
    expect(result).toEqual([
      { type: 'same', text: 'one two' },
      { type: 'removed', text: 'three' },
      { type: 'same', text: 'four' },
    ])
  })

  it('returns null above the 2500-word performance guard', () => {
    const long = Array.from({ length: 2501 }, (_, i) => `w${i}`).join(' ')
    expect(diffWords(long, 'short text')).toBeNull()
    expect(diffWords('short text', long)).toBeNull()
  })

  it('returns an empty array when both sides are empty', () => {
    expect(diffWords('', '')).toEqual([])
  })
})
