// yearTint — regression guard for the SM-2YR redesign: the most recent selected year
// must keep the plain series colour, every older year must mute the SAME hue via
// color-mix (never a second hardcoded palette).
import { describe, it, expect } from 'vitest'
import { yearTint, YEAR_OPACITY } from './shiftsChartsConfig'

describe('yearTint', () => {
  it('keeps the plain series colour for rank 0 (the most recent selected year)', () => {
    // eslint-disable-next-line no-restricted-syntax -- DATA: test fixture colour, not UI styling
    expect(yearTint('#1B60A9', 0)).toBe('#1B60A9')
  })

  it('mutes the same hue via color-mix for an older rank', () => {
    const pct = Math.round(YEAR_OPACITY[1] * 100)
    // eslint-disable-next-line no-restricted-syntax -- DATA: test fixture colour, not UI styling
    expect(yearTint('#1B60A9', 1)).toBe(`color-mix(in srgb, #1B60A9 ${pct}%, transparent)`)
  })

  it('never invents a different hue — the base colour always appears in the mix', () => {
    // eslint-disable-next-line no-restricted-syntax -- DATA: test fixture colour, not UI styling
    const tinted = yearTint('#10b981', 2)
    // eslint-disable-next-line no-restricted-syntax -- DATA: test fixture colour, not UI styling
    expect(tinted).toContain('#10b981')
    expect(tinted).toContain('color-mix')
  })
})
