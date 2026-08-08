/**
 * useTenantTheme — the accent-readability contract, pinned with real WCAG maths.
 *
 * This is the regression that kept coming back (Danny reported unreadable text on a
 * yellow/orange brand six times on 08-08): a light tenant brand was used BOTH as a
 * fill (white label on yellow) and AS text (yellow label on a white sidebar), and
 * both are unreadable. The theme layer now answers two different questions with two
 * different tokens, so these tests assert the MEASURED ratio, never a colour literal
 * — a future tweak to the mixing rule stays free as long as the text stays legible.
 */
import { describe, it, expect } from 'vitest'
import { contrastRatio, readableOn } from './useTenantTheme'

// WCAG AA for normal-size text. Anything below this is a finding, not a taste call.
const AA = 4.5

// The brands that actually broke: AENF's yellow and Yesway's orange, plus a dark
// brand to prove the rule is not simply "always pick dark".
const BRANDS = {
  aenfYellow: '#ffde00',
  yeswayOrange: '#ff5c39',
  deepBlue: '#1D4ED8',
}

describe('contrastRatio', () => {
  it('matches the WCAG reference values at both extremes', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1)
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5)
  })

  it('is symmetric — the order of the two colours never changes the ratio', () => {
    expect(contrastRatio(BRANDS.aenfYellow, '#FFFFFF'))
      .toBeCloseTo(contrastRatio('#FFFFFF', BRANDS.aenfYellow), 5)
  })
})

describe('readableOn — text ON an accent fill', () => {
  it('picks the higher-contrast option for every brand, never a fixed white', () => {
    for (const [name, brand] of Object.entries(BRANDS)) {
      const picked = readableOn(brand)
      const other = picked === '#FFFFFF' ? '#1F2937' : '#FFFFFF'
      expect(contrastRatio(picked, brand), `${name}: picked the worse of the two`)
        .toBeGreaterThanOrEqual(contrastRatio(other, brand))
    }
  })

  it('clears AA on the two brands that were reported unreadable', () => {
    expect(contrastRatio(readableOn(BRANDS.aenfYellow), BRANDS.aenfYellow)).toBeGreaterThanOrEqual(AA)
    expect(contrastRatio(readableOn(BRANDS.yeswayOrange), BRANDS.yeswayOrange)).toBeGreaterThanOrEqual(AA)
  })

  it('still chooses white on a dark brand (the rule is contrast, not "always dark")', () => {
    expect(readableOn(BRANDS.deepBlue)).toBe('#FFFFFF')
  })

  // The exact bug: a luminance THRESHOLD kept white on orange at 2.80:1 because the
  // brand sat just under the cut-off. Comparing the two real ratios has no threshold
  // to mistune, so this pins the outcome the old rule got wrong.
  it('does not fall back to white on a mid-luminance brand', () => {
    expect(readableOn(BRANDS.yeswayOrange)).toBe('#1F2937')
  })
})

describe('accent AS text — why --color-primary-text exists', () => {
  // These two ratios are the whole reason the second token exists: the raw brand is
  // fine as a FILL but invisible as TEXT on the near-white sidebar. If someone ever
  // points a label back at --color-primary, this is the number that indicts it.
  it('proves the raw brand is unreadable as text on the white sidebar', () => {
    expect(contrastRatio(BRANDS.aenfYellow, '#FFFFFF')).toBeLessThan(AA)
    expect(contrastRatio(BRANDS.yeswayOrange, '#FFFFFF')).toBeLessThan(AA)
  })

  it('proves the sidebar resting label now clears AA in both themes', () => {
    // The token values from src/index.css (--sidebar-muted on --sidebar-bg).
    expect(contrastRatio('#6B7280', '#FFFFFF')).toBeGreaterThanOrEqual(AA)
    expect(contrastRatio('#8A93A3', '#1C1C2E')).toBeGreaterThanOrEqual(AA)
  })
})
