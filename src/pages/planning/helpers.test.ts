/**
 * planning/helpers — locale-aware formatting regression (FINISH audit, 2026-08).
 * monthName/formatDate/weekdaysMon require an explicit `locale` argument (LANE-B
 * fix round): a defaulted 'nl-NL' let a caller silently forget the argument and
 * render Dutch names on a non-Dutch screen, so the default was removed and every
 * call site now threads useLocale()/useDateFormat().locale through explicitly.
 */
import { describe, it, expect } from 'vitest'
import { monthName, formatDate, weekdaysMon, toIsoDate, getViewRange } from './helpers'

describe('monthName · locale param', () => {
  it('follows an explicit Dutch locale', () => {
    expect(monthName('nl-NL', 0)).toBe('januari')
  })

  it('follows an explicit English locale', () => {
    expect(monthName('en-GB', 0)).toBe('January')
  })
})

describe('formatDate · locale param', () => {
  it('follows an explicit Dutch locale', () => {
    expect(formatDate(new Date(2026, 0, 12), 'nl-NL')).toBe('12 januari 2026')
  })

  it('follows an explicit English locale', () => {
    expect(formatDate(new Date(2026, 0, 12), 'en-GB')).toBe('12 January 2026')
  })
})

describe('weekdaysMon · locale param', () => {
  it('follows an explicit Dutch locale, Monday-first', () => {
    expect(weekdaysMon('nl-NL')[0]).toBe('ma')
    expect(weekdaysMon('nl-NL')).toHaveLength(7)
  })

  it('follows an explicit English locale', () => {
    expect(weekdaysMon('en-GB')[0]).toBe('Mon')
    expect(weekdaysMon('en-GB')).toHaveLength(7)
  })
})

describe('toIsoDate · local calendar day, never toISOString', () => {
  it('renders the picked local day, not a UTC-shifted one', () => {
    expect(toIsoDate(new Date(2026, 0, 1))).toBe('2026-01-01')
    expect(toIsoDate(new Date(2026, 6, 31))).toBe('2026-07-31')
  })
})

describe('getViewRange · the window usePlanningBoard fetches for the active view', () => {
  it('week: the Monday–Sunday window containing `current`', () => {
    // 2026-08-14 is a Friday.
    expect(getViewRange('week', new Date(2026, 7, 14))).toEqual({ from: '2026-08-10', to: '2026-08-16' })
  })

  it('day: a single-day window', () => {
    expect(getViewRange('day', new Date(2026, 7, 14))).toEqual({ from: '2026-08-14', to: '2026-08-14' })
  })

  it('month/list: the calendar month padded a week either side (covers the grid\'s borrowed lead/trail days)', () => {
    expect(getViewRange('month', new Date(2026, 7, 14))).toEqual({ from: '2026-07-25', to: '2026-09-07' })
    expect(getViewRange('list', new Date(2026, 7, 14))).toEqual(getViewRange('month', new Date(2026, 7, 14)))
  })
})
