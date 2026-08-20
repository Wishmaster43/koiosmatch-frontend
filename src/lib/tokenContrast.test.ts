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

  // The §4 "aan/gelukt" pair (success-bg fill + success border) carries TEXT via
  // its OWN ink token. The success colour itself reads only 3.0:1 on this bg — the
  // exact WCAG fail the Opus slotaudit review caught on 9 saved-buttons (20-08).
  it('on-success-bg clears 4.5:1 as text on the success-bg pastel', () => {
    expect(ratio(token('color-on-success-bg'), token('color-success-bg'))).toBeGreaterThanOrEqual(4.5)
  })

  // Same class, danger side (Opus r3.5): the danger colour itself reads 3.95:1
  // on its own pastel — error banners carry their own ink token.
  it('on-danger-bg clears 4.5:1 as text on the danger-bg pastel', () => {
    expect(ratio(token('color-on-danger-bg'), token('color-danger-bg'))).toBeGreaterThanOrEqual(4.5)
  })

  // chipInk (herhaal-slotaudit 20-08): every semantic token's TEXT on its own
  // 10% AND 16% tint, composited over both page grounds, must clear AA. The raw
  // colours measured 2.4-3.0:1 there (SoftChip app-wide); chipInk blends 45%
  // colour toward --text. This loop replicates that math from the REAL tokens,
  // so a token nudge or a TINT_INK change that breaks AA fails CI.
  it('chipInk clears 4.5:1 for every semantic token on its own tints', () => {
    const hex2rgb = (h: string): number[] => {
      const n = parseInt(h.slice(1), 16)
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    }
    const lumRgb = (rgb: number[]): number => {
      const c = rgb.map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) })
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    }
    const ratioRgb = (a: number[], b: number[]): number => {
      const la = lumRgb(a); const lb = lumRgb(b)
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
    }
    // color-mix(in srgb, C p%, X) — linear per-channel blend, same as the browser.
    const mixRgb = (a: number[], p: number, b: number[]): number[] => a.map((v, i) => p * v + (1 - p) * b[i])
    const text = hex2rgb(token('text'))
    const grounds = [hex2rgb(token('bg')), hex2rgb(token('surface'))]
    // The semantic set + the DATA-grey fallback SoftChip uses. Primary is NOT in
    // this loop: chipInk's primary branch returns --color-primary-text, a
    // different recipe, asserted separately below (Opus r3: testing the 45%-blend
    // for primary covered a branch that does not exist).
    const chipTokens = ['color-success', 'color-warning', 'color-danger', 'color-info',
      'color-secondary', 'color-violet', 'color-accent']
    // eslint-disable-next-line no-restricted-syntax -- DATA: SoftChip's own grey fallback constant, measured alongside the tokens
    for (const name of [...chipTokens.map(token), '#9CA3AF']) {
      const c = hex2rgb(name)
      const ink = mixRgb(c, 0.45, text)
      for (const ground of grounds) {
        for (const pct of [0.10, 0.16]) {
          const fill = mixRgb(c, pct, ground)
          expect(ratioRgb(ink, fill), `${name} @${pct * 100}%`).toBeGreaterThanOrEqual(4.5)
        }
      }
    }

    // chipInk's REAL primary branch: --color-primary-text on the primary tints.
    // The old #117089 default measured 4.47:1 at 16% over --bg — darkened to
    // #116E86 (r3). Static default only; useTenantTheme rederives per tenant.
    const primary = hex2rgb(token('color-primary'))
    const primaryInk = hex2rgb(token('color-primary-text'))
    for (const ground of grounds) {
      for (const pct of [0.10, 0.16]) {
        expect(ratioRgb(primaryInk, mixRgb(primary, pct, ground)), `primary-text @${pct * 100}%`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
})
