/**
 * computeMatchExpiry — Danny's point 6: warning within 30 days, danger once
 * the end date has passed, nothing for a closed/archived match or a match
 * with no end date. `now` is always a fixed fixture date here (never
 * `Date.now()`), so these assertions never depend on the day the suite runs.
 */
import { describe, it, expect } from 'vitest'
import { computeMatchExpiry } from './matchExpiry'

const NOW = new Date('2026-08-03T10:00:00')

describe('computeMatchExpiry', () => {
  it('returns null when there is no end date', () => {
    expect(computeMatchExpiry(null, { now: NOW })).toBeNull()
    expect(computeMatchExpiry(undefined, { now: NOW })).toBeNull()
  })

  it('returns null for an end date more than 30 days out', () => {
    expect(computeMatchExpiry('2026-09-15', { now: NOW })).toBeNull() // 43 days out
  })

  it('returns a warning within the 30-day window', () => {
    expect(computeMatchExpiry('2026-08-20', { now: NOW })).toEqual({ kind: 'warning', days: 17 })
  })

  it('flags EXACTLY 30 days out as a warning (boundary, inclusive)', () => {
    expect(computeMatchExpiry('2026-09-02', { now: NOW })).toEqual({ kind: 'warning', days: 30 })
  })

  it('flags today (day 0) as expired, not a warning', () => {
    expect(computeMatchExpiry('2026-08-03', { now: NOW })).toEqual({ kind: 'expired', days: 0 })
  })

  it('flags a past end date as expired', () => {
    expect(computeMatchExpiry('2026-07-20', { now: NOW })).toEqual({ kind: 'expired', days: -14 })
  })

  it('never flags a closed match, even with an end date in the window', () => {
    expect(computeMatchExpiry('2026-08-10', { now: NOW, closed: true })).toBeNull()
  })

  it('returns null for an unparseable end date', () => {
    expect(computeMatchExpiry('not-a-date', { now: NOW })).toBeNull()
  })
})
