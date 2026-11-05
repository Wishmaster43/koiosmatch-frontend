import { describe, it, expect } from 'vitest'
import { rowGlyphButtonStyle } from './rowGlyphButton'

describe('rowGlyphButtonStyle', () => {
  it('returns the shared dense glyph face when unlocked, without opacity', () => {
    const s = rowGlyphButtonStyle()
    expect(s).toEqual({ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 3px', display: 'flex' })
    expect(s.opacity).toBeFalsy()
  })

  it('returns the locked face with not-allowed cursor and half opacity', () => {
    expect(rowGlyphButtonStyle(true)).toEqual({ background: 'none', border: 'none', cursor: 'not-allowed', color: 'var(--text-muted)', padding: '2px 3px', display: 'flex', opacity: 0.5 })
  })
})
