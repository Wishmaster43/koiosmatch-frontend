/**
 * Token-contrast gate (HUISSTIJL-1 fase 3): the WCAG ratios of the house token
 * pairs, computed from the REAL values in index.css — so a token edit that
 * breaks AA fails CI instead of surfacing on a tenant's screen (the AENF
 * lesson: 21 unreadable surfaces shipped because nothing measured this).
 * Light theme only: dark redefines the tokens and derives accent inks at
 * runtime (useTenantTheme), which unit scope can't resolve — the DEFAULTS are
 * what this file guards.
 */
import { describe, it, expect } from 'vitest'

// Vitest's css handling strips a `?raw` css import to '' and the repo ships no
// node typings, so this gate reads the file through a locally-typed require —
// the narrowest possible surface for the one capability it needs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const require: (m: string) => any
const { readFileSync } = require('fs') as { readFileSync: (p: string, e: string) => string }
const css: string = readFileSync('src/index.css', 'utf8')

// Vite's raw import — the house convention for reading repo assets in tests
// (see keysExist.test.ts): no node typings needed, same file the app ships.

// First (light/:root) definition of a token.
const token = (name: string): string => {
  const m = css.match(new RegExp(`--${name}:\\s*([^;]+);`))
  if (!m) throw new Error(`token --${name} niet gevonden`)
  return m[1].trim()
}
const lum = (hex: string): number => {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const ratio = (a: string, b: string): number => {
  const la = lum(a); const lb = lum(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

describe('house token pairs stay readable (defaults, light theme)', () => {
  it('text and muted text clear 4.5:1 on BOTH page grounds', () => {
    for (const fg of ['text', 'text-muted']) {
      for (const bg of ['bg', 'surface']) {
        expect(ratio(token(fg), token(bg)), `${fg} op ${bg}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('the default on-accent ink clears the audited 3:1 button floor on the default fill', () => {
    // Button labels are bold UI-component text; the runtime clamps tenant picks
    // at the same floor (ON_ACCENT_EXPLICIT_FLOOR) — the DEFAULT pair must too.
    expect(ratio(token('color-on-accent'), token('color-primary'))).toBeGreaterThanOrEqual(3)
  })

  it('the readable accent twin clears 4.5:1 as TEXT on both grounds', () => {
    for (const bg of ['bg', 'surface']) {
      expect(ratio(token('color-primary-text'), token(bg)), `twin op ${bg}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('on-danger and on-success match their audited fills', () => {
    expect(ratio(token('color-on-danger'), token('color-danger'))).toBeGreaterThanOrEqual(3)
    expect(ratio(token('color-on-success'), token('color-success'))).toBeGreaterThanOrEqual(4.5)
  })
})
