import type { CSSProperties } from 'react'

// House-style exception: dense 12px row-action glyphs in a fixed grid column, where Button's 28px does not fit.
// This is the one face for every such glyph; locked = the action is blocked by the upload scan.
export function rowGlyphButtonStyle(locked = false): CSSProperties {
  return {
    background: 'none',
    border: 'none',
    cursor: locked ? 'not-allowed' : 'pointer',
    color: 'var(--text-muted)',
    padding: '2px 3px',
    display: 'flex',
    ...(locked ? { opacity: 0.5 } : {}),
  }
}
