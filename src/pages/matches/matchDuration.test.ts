/**
 * computeMatchDuration — M25 (duration label) / M26 (progress %) fixtures.
 * `now` is always a fixed date here, never `Date.now()` (§13).
 */
import { describe, it, expect } from 'vitest'
import { computeMatchDuration } from './matchDuration'

const NOW = new Date('2026-08-04T10:00:00')

describe('computeMatchDuration', () => {
  it('returns null when either date is missing', () => {
    expect(computeMatchDuration(null, '2026-09-01', NOW)).toBeNull()
    expect(computeMatchDuration('2026-08-01', null, NOW)).toBeNull()
    expect(computeMatchDuration(undefined, undefined, NOW)).toBeNull()
  })

  it('returns null for an unparseable date', () => {
    expect(computeMatchDuration('not-a-date', '2026-09-01', NOW)).toBeNull()
  })

  it('returns null when the end is not after the start', () => {
    expect(computeMatchDuration('2026-08-10', '2026-08-10', NOW)).toBeNull()
    expect(computeMatchDuration('2026-08-10', '2026-08-01', NOW)).toBeNull()
  })

  it('picks DAYS under a 14-day span', () => {
    const d = computeMatchDuration('2026-08-01', '2026-08-08', NOW)
    expect(d).toMatchObject({ unit: 'days', amount: 7, totalDays: 7 })
  })

  it('picks WEEKS between 14 and 60 days', () => {
    const d = computeMatchDuration('2026-08-01', '2026-09-26', NOW) // 56 days
    expect(d).toMatchObject({ unit: 'weeks', amount: 8, totalDays: 56 })
  })

  it('picks MONTHS at 60+ days', () => {
    const d = computeMatchDuration('2026-08-01', '2026-11-29', NOW) // 120 days
    expect(d).toMatchObject({ unit: 'months', amount: 4, totalDays: 120 })
  })

  it('computes elapsed/remaining percentage between start and end (the "nog X% te gaan" figure)', () => {
    // 2026-07-01 → 2026-09-29 is a 90-day window; "now" (08-04) is 34 days in.
    const d = computeMatchDuration('2026-07-01', '2026-09-29', NOW)
    expect(d?.elapsedPct).toBe(38) // round(34/90*100)
    expect(d?.remainingPct).toBe(62)
  })

  it('clamps to 0% before the start date', () => {
    const d = computeMatchDuration('2026-09-01', '2026-10-01', NOW)
    expect(d?.elapsedPct).toBe(0)
    expect(d?.remainingPct).toBe(100)
  })

  it('clamps to 100% after the end date (a still-open match whose window already passed)', () => {
    const d = computeMatchDuration('2026-01-01', '2026-02-01', NOW)
    expect(d?.elapsedPct).toBe(100)
    expect(d?.remainingPct).toBe(0)
  })
})
