/** windowUnitOptions — effectiveWindowMax picks the ceiling of the chosen unit. */
import { describe, it, expect } from 'vitest'
import { effectiveWindowMax } from './windowUnitOptions'

describe('effectiveWindowMax', () => {
  it('prefers the catalogue per-unit table when present', () => {
    expect(effectiveWindowMax({ maxPerUnit: { weeks: 40 } }, 'weeks')).toBe(40)
  })
  it('falls back to the FE table when the catalogue has none', () => {
    expect(effectiveWindowMax({}, 'weeks')).toBe(52)
  })
  it('lets a smaller literal max tighten the ceiling', () => {
    expect(effectiveWindowMax({ max: 30 }, 'days')).toBe(30)
  })
  it('returns the literal max (or undefined) for an unknown unit', () => {
    expect(effectiveWindowMax({ max: 9 }, 'fortnights')).toBe(9)
    expect(effectiveWindowMax({}, 'fortnights')).toBeUndefined()
  })
})
