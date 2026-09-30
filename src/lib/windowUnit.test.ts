import { describe, it, expect } from 'vitest'
import { windowDays, windowBoundaryAfter, windowBoundaryBefore, isWindowUnit } from './windowUnit'

// Fixed anchor so every case is deterministic: Friday 07-08-2026.
const FRI = new Date('2026-08-07T12:00:00Z')

describe('windowBoundaryAfter / windowBoundaryBefore', () => {
  it('days: plain calendar day arithmetic', () => {
    expect(windowBoundaryAfter(FRI, 5, 'days').toISOString().slice(0, 10)).toBe('2026-08-12')
    expect(windowBoundaryBefore(FRI, 5, 'days').toISOString().slice(0, 10)).toBe('2026-08-02')
  })

  it('weeks: 7x the amount in days', () => {
    expect(windowBoundaryAfter(FRI, 2, 'weeks').toISOString().slice(0, 10)).toBe('2026-08-21')
    expect(windowBoundaryBefore(FRI, 2, 'weeks').toISOString().slice(0, 10)).toBe('2026-07-24')
  })

  it('workdays: skips Saturday/Sunday — Friday + 1 workday lands on Monday, Monday - 1 workday lands on Friday', () => {
    const mon = windowBoundaryAfter(FRI, 1, 'workdays')
    expect(mon.getFullYear()).toBe(2026)
    expect(mon.getMonth()).toBe(7) // August, 0-indexed
    expect(mon.getDate()).toBe(10)
    const backToFri = windowBoundaryBefore(mon, 1, 'workdays')
    expect(backToFri.getDate()).toBe(7)
  })

  it('workdays: a longer walk still skips both weekend days each week', () => {
    const d = windowBoundaryAfter(FRI, 5, 'workdays')
    // Fri 07-08 + 5 workdays: Mon 10, Tue 11, Wed 12, Thu 13, Fri 14.
    expect(d.getDate()).toBe(14)
  })

  it('months: no overflow, mirrors Carbon add/subMonthsNoOverflow (31-01 + 1 month = 28/29-02)', () => {
    const jan31 = new Date('2026-01-31T12:00:00Z')
    const clamped = windowBoundaryAfter(jan31, 1, 'months')
    expect(clamped.getMonth()).toBe(1) // February, clamped — never rolls into March.
    expect(clamped.getDate()).toBe(28)
  })

  it('months: no overflow going backwards (31-03 - 1 month = 28-02)', () => {
    const mar31 = new Date('2026-03-31T12:00:00Z')
    const clamped = windowBoundaryBefore(mar31, 1, 'months')
    expect(clamped.getMonth()).toBe(1) // February
    expect(clamped.getDate()).toBe(28)
  })

  it('months: leap year clamps to 29-02 (31-03-2028 - 1 month)', () => {
    const mar31 = new Date('2028-03-31T12:00:00Z')
    const clamped = windowBoundaryBefore(mar31, 1, 'months')
    expect(clamped.getMonth()).toBe(1) // February
    expect(clamped.getDate()).toBe(29) // 2028 is a leap year.
  })

  it('months: plain case, no overflow', () => {
    expect(windowBoundaryAfter(FRI, 1, 'months').toISOString().slice(0, 10)).toBe('2026-09-07')
    expect(windowBoundaryBefore(FRI, 1, 'months').toISOString().slice(0, 10)).toBe('2026-07-07')
  })
})

describe('isWindowUnit', () => {
  it('accepts only the four known units', () => {
    expect(isWindowUnit('days')).toBe(true)
    expect(isWindowUnit('workdays')).toBe(true)
    expect(isWindowUnit('weeks')).toBe(true)
    expect(isWindowUnit('months')).toBe(true)
    expect(isWindowUnit('hours')).toBe(false)
    expect(isWindowUnit(undefined)).toBe(false)
    expect(isWindowUnit(null)).toBe(false)
  })
})

describe('windowDays', () => {
  it('returns the exact amount for days/weeks/months even across a DST hour, and floors the workdays walk', () => {
    const now = new Date('2026-03-20T12:00:00Z')
    expect(windowDays(now, windowBoundaryAfter(now, 14, 'days'), 'days')).toBe(14)
    expect(windowDays(now, windowBoundaryAfter(now, 2, 'weeks'), 'weeks')).toBe(14)
    expect(windowDays(now, windowBoundaryBefore(now, 1, 'months'), 'months')).toBe(28)
    // 5 workdays from a Friday noon land on the Friday after at start of day: 6 calendar days and a bit → 6.
    const fri = new Date('2026-03-20T12:00:00Z')
    expect(windowDays(fri, windowBoundaryAfter(fri, 5, 'workdays'), 'workdays')).toBe(6)
  })
})
