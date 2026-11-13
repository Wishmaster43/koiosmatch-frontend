// yearTint — regression guard for the SM-2YR redesign: the most recent selected year
// must keep the plain series colour, every older year must mute the SAME hue via
// color-mix (never a second hardcoded palette).
import { describe, it, expect } from 'vitest'
import { yearTint, YEAR_OPACITY, SERIES } from './shiftsChartsConfig'
import { tint } from '@/lib/tint'

describe('yearTint', () => {
  it('keeps the plain series colour for rank 0 (the most recent selected year)', () => {
    expect(yearTint(SERIES[0].color, 0)).toBe(SERIES[0].color)
  })

  it('mutes the same hue via color-mix for an older rank', () => {
    const pct = Math.round(YEAR_OPACITY[1] * 100)
    expect(yearTint(SERIES[0].color, 1)).toBe(tint(SERIES[0].color, pct))
  })

  it('never invents a different hue — the base colour always appears in the mix', () => {
    const tinted = yearTint(SERIES[4].color, 2)
    expect(tinted).toContain(SERIES[4].color)
    expect(tinted).toContain('color-mix')
  })
})

describe('SERIES', () => {
  it('carries the five English keys in order with unchanged colours', () => {
    expect(SERIES.map((s) => s.key)).toEqual(['total', 'unfilled', 'no_candidate', 'forecast', 'actual'])
    // eslint-disable-next-line no-restricted-syntax -- DATA: test fixture colours, not UI styling
    expect(SERIES.map((s) => s.color)).toEqual(['#1B60A9', '#F0AB00', '#ef4444', '#6366f1', '#10b981'])
  })
})
