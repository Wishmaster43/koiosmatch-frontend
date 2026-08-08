/**
 * hasDescriptionText — regression coverage for the TipTap-empty-markup bug
 * (measured live, 08-08): an editor left empty emits '<p></p>', not '', so a
 * bare falsy/truthy check on the raw HTML string treats it as "has text".
 */
import { describe, it, expect } from 'vitest'
import { hasDescriptionText } from './descriptionText'

describe('hasDescriptionText', () => {
  it('is false for a genuinely empty string', () => {
    expect(hasDescriptionText('')).toBe(false)
  })

  it('is false for TipTap\'s empty-paragraph artifact', () => {
    expect(hasDescriptionText('<p></p>')).toBe(false)
  })

  it('is false for whitespace-only content wrapped in tags', () => {
    expect(hasDescriptionText('<p>   </p>')).toBe(false)
  })

  it('is true once real text is present', () => {
    expect(hasDescriptionText('<p>Belangrijke context</p>')).toBe(true)
  })

  it('is true for formatting-only content that still carries text', () => {
    expect(hasDescriptionText('<p><strong>Urgent</strong></p>')).toBe(true)
  })
})
