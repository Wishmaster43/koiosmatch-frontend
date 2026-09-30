import { describe, it, expect } from 'vitest'
import { deriveMatchAdvice } from './matchAdvice'
import type { MatchRow } from '@/types/match'

const NOW = new Date('2026-08-04T12:00:00Z')

function makeMatch(overrides: Partial<MatchRow> = {}): MatchRow {
  return { id: 1, archived: false, endDate: '2026-08-20', ...overrides } as unknown as MatchRow
}

// Lens 2 (30-09): a `days` window that crosses the spring-forward DST change must fire
// exactly like the old day-granularity rule — floor on a boundary gap of N days minus an
// hour gave N-1 in Europe/Amsterdam. Passes in any runner timezone after the fix.
describe('deriveMatchAdvice · DST-proof days window', () => {
  it('fires on the last day of a 14-day window that crosses the March DST change', () => {
    const now = new Date('2026-03-20T12:00:00Z')
    const m = { id: 'm1', endDate: '2026-04-04', archived: false, status: 'active' } as unknown as Parameters<typeof deriveMatchAdvice>[0]
    expect(deriveMatchAdvice(m, { isClosed: false, renewWithinDays: 14, now }).action).toBe('renew')
    const later = { ...m, endDate: '2026-04-05' }
    expect(deriveMatchAdvice(later, { isClosed: false, renewWithinDays: 14, now }).action).toBe('none')
  })
})

describe('deriveMatchAdvice', () => {
  it('advises renew when the open match end date is within the renewal window', () => {
    const rule = deriveMatchAdvice(makeMatch({ endDate: '2026-08-15' }), { isClosed: false, renewWithinDays: 14, now: NOW })
    expect(rule.action).toBe('renew')
  })

  it('advises renew when the end date already passed while the match is still open', () => {
    const rule = deriveMatchAdvice(makeMatch({ endDate: '2026-08-01' }), { isClosed: false, renewWithinDays: 14, now: NOW })
    expect(rule.action).toBe('renew')
  })

  it('advises nothing when the end date is far in the future', () => {
    const rule = deriveMatchAdvice(makeMatch({ endDate: '2027-01-01' }), { isClosed: false, renewWithinDays: 14, now: NOW })
    expect(rule.action).toBe('none')
  })

  it('never advises on a closed match, even with an approaching end date', () => {
    const rule = deriveMatchAdvice(makeMatch({ endDate: '2026-08-10' }), { isClosed: true, renewWithinDays: 14, now: NOW })
    expect(rule.action).toBe('none')
  })

  it('never advises on an open-ended match (no end date)', () => {
    const rule = deriveMatchAdvice(makeMatch({ endDate: null }), { isClosed: false, renewWithinDays: 14, now: NOW })
    expect(rule.action).toBe('none')
  })

  it('never advises on an archived match', () => {
    const rule = deriveMatchAdvice(makeMatch({ archived: true, endDate: '2026-08-05' }), { isClosed: false, renewWithinDays: 14, now: NOW })
    expect(rule.action).toBe('none')
  })
})

describe('deriveMatchAdvice — window units (WINDOW-UNIT-READERS-1)', () => {
  it('months: a 1-month window on a fixed date', () => {
    const inside = deriveMatchAdvice(makeMatch({ endDate: '2026-09-01' }), { isClosed: false, renewWithinDays: 1, renewUnit: 'months', now: NOW })
    const outside = deriveMatchAdvice(makeMatch({ endDate: '2026-09-10' }), { isClosed: false, renewWithinDays: 1, renewUnit: 'months', now: NOW })
    expect(inside.action).toBe('renew') // NOW + 1 month = 2026-09-04, 09-01 is inside.
    expect(outside.action).toBe('none') // 09-10 is past the boundary.
  })

  it('weeks: a 2-week window', () => {
    const inside = deriveMatchAdvice(makeMatch({ endDate: '2026-08-15' }), { isClosed: false, renewWithinDays: 2, renewUnit: 'weeks', now: NOW })
    const outside = deriveMatchAdvice(makeMatch({ endDate: '2026-08-25' }), { isClosed: false, renewWithinDays: 2, renewUnit: 'weeks', now: NOW })
    expect(inside.action).toBe('renew') // NOW + 2 weeks = 2026-08-18.
    expect(outside.action).toBe('none')
  })

  it('workdays: a 5-workday window skips the weekend', () => {
    // NOW is Tuesday 2026-08-04; 5 workdays ahead lands on Tuesday 2026-08-11.
    // Midday UTC timestamps (not date-only strings) so the comparison never
    // flips on the local-timezone-vs-UTC boundary a test runner might sit in.
    const inside = deriveMatchAdvice(makeMatch({ endDate: '2026-08-10T12:00:00Z' }), { isClosed: false, renewWithinDays: 5, renewUnit: 'workdays', now: NOW })
    const outside = deriveMatchAdvice(makeMatch({ endDate: '2026-08-13T12:00:00Z' }), { isClosed: false, renewWithinDays: 5, renewUnit: 'workdays', now: NOW })
    expect(inside.action).toBe('renew')
    expect(outside.action).toBe('none')
  })

  it('days (default unit): unchanged behaviour', () => {
    const rule = deriveMatchAdvice(makeMatch({ endDate: '2026-08-15' }), { isClosed: false, renewWithinDays: 14, now: NOW })
    expect(rule.action).toBe('renew')
  })

  it('days: the last day of the window still fires (old day-granularity truth, not a millisecond boundary)', () => {
    const lastDay = deriveMatchAdvice(makeMatch({ endDate: '2026-08-19' }), { isClosed: false, renewWithinDays: 14, now: NOW })
    const pastWindow = deriveMatchAdvice(makeMatch({ endDate: '2026-08-20' }), { isClosed: false, renewWithinDays: 14, now: NOW })
    expect(lastDay.action).toBe('renew')
    expect(pastWindow.action).toBe('none')
  })
})
