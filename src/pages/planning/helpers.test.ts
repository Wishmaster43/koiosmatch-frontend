/**
 * planning/helpers — locale-aware formatting regression (FINISH audit, 2026-08).
 * monthName/formatDate/weekdaysMon used to hardcode 'nl-NL'; each now accepts an
 * explicit `locale` param (defaulting to 'nl-NL' for the existing call sites —
 * views.tsx / PlanningPage.tsx / AddShiftModal.tsx — that don't thread the active
 * locale through yet, mirroring lib/formatters.ts's own non-React default).
 * WEEKDAYS_MON stays the default-locale array for those same call sites; the new
 * weekdaysMon(locale) function is the locale-aware path.
 */
import { describe, it, expect } from 'vitest'
import { monthName, formatDate, weekdaysMon, WEEKDAYS_MON } from './helpers'

describe('monthName · locale param', () => {
  it('defaults to nl-NL (unchanged output for existing call sites)', () => {
    expect(monthName(0)).toBe('januari')
  })

  it('follows an explicit English locale', () => {
    expect(monthName(0, 'en-GB')).toBe('January')
  })
})

describe('formatDate · locale param', () => {
  it('defaults to nl-NL month names', () => {
    expect(formatDate(new Date(2026, 0, 12))).toBe('12 januari 2026')
  })

  it('follows an explicit English locale', () => {
    expect(formatDate(new Date(2026, 0, 12), 'en-GB')).toBe('12 January 2026')
  })
})

describe('weekdaysMon / WEEKDAYS_MON · locale param', () => {
  it('WEEKDAYS_MON (the plain-array export) stays the nl-NL default, Monday-first', () => {
    expect(WEEKDAYS_MON).toEqual(weekdaysMon())
    expect(WEEKDAYS_MON[0]).toBe('ma')
  })

  it('weekdaysMon(locale) follows an explicit English locale', () => {
    expect(weekdaysMon('en-GB')[0]).toBe('Mon')
    expect(weekdaysMon('en-GB')).toHaveLength(7)
  })
})
