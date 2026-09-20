/**
 * useComposerFormatting — WA-COMPOSER-1: pure wrap/insert helpers behind the
 * composer's bold/italic/strikethrough toolbar and emoji picker.
 */
import { describe, it, expect } from 'vitest'
import { wrapSelection, insertAt } from './useComposerFormatting'

describe('wrapSelection', () => {
  it('wraps a selection with the marker on both sides', () => {
    const r = wrapSelection('hello world', 0, 5, '*')
    expect(r.text).toBe('*hello* world')
    expect([r.selectionStart, r.selectionEnd]).toEqual([1, 6])
  })

  it('toggles off (unwraps) when the selection is already wrapped', () => {
    const r = wrapSelection('*hello* world', 1, 6, '*')
    expect(r.text).toBe('hello world')
    expect([r.selectionStart, r.selectionEnd]).toEqual([0, 5])
  })

  it('inserts an empty marker pair with the caret between when nothing is selected', () => {
    const r = wrapSelection('hi ', 3, 3, '_')
    expect(r.text).toBe('hi __')
    expect(r.selectionStart).toBe(4)
    expect(r.selectionEnd).toBe(4)
  })
})

describe('insertAt', () => {
  it('inserts a snippet at the caret and places the caret after it', () => {
    const r = insertAt('hi ', 3, '😀')
    expect(r.text).toBe('hi 😀')
    expect(r.selectionStart).toBe(r.text.length)
    expect(r.selectionEnd).toBe(r.text.length)
  })

  it('inserts at the end of the text', () => {
    const r = insertAt('draft', 5, '!')
    expect(r.text).toBe('draft!')
  })
})
