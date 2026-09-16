/**
 * constants — softPill (CHIP-TINT-1: a selected choice chip wears the active
 * tint, never a solid fill) and hasValue (real emptiness vs. mapCandidate's
 * truthy '-' display placeholder).
 */
import { describe, it, expect } from 'vitest'
import { softPill, hasValue } from './constants'

describe('softPill · CHIP-TINT-1 tint, never the solid button fill', () => {
  it('active state uses the tint recipe, not --button-fill/--button-ink', () => {
    const style = softPill(true)
    expect(style.background).not.toBe('var(--button-fill)')
    expect(style.color).not.toBe('var(--button-ink)')
    expect(String(style.background)).toContain('color-mix')
    expect(style.fontWeight).toBe(600)
  })

  it('inactive state stays transparent with muted text', () => {
    const style = softPill(false)
    expect(style.background).toBe('transparent')
    expect(style.color).toBe('var(--text-muted)')
    expect(style.fontWeight).toBe(400)
  })
})

describe('hasValue · real emptiness vs. the mapper\'s "-" placeholder', () => {
  it('treats the placeholder as empty', () => { expect(hasValue('-')).toBe(false) })
  it('treats the em-dash placeholder (archiveGuard.ts) as empty too — the shared predicate covers both mapper fallbacks', () => {
    expect(hasValue('—')).toBe(false)
  })
  it('treats undefined/null/empty as empty', () => {
    expect(hasValue(undefined)).toBe(false)
    expect(hasValue(null)).toBe(false)
    expect(hasValue('')).toBe(false)
  })
  it('treats a real value as non-empty', () => { expect(hasValue('+31612345678')).toBe(true) })
})
