/**
 * dashboardFormat — locale-aware formatting regression (FINISH audit, 2026-08).
 * fmtWhen/eur used to hardcode 'nl-NL' in their Intl calls; both now accept an
 * explicit `locale` param (defaulting to 'nl-NL' for the one call site,
 * useDashboardViewModel, that doesn't thread the active locale through yet —
 * mirrors lib/formatters.ts's own non-React default). This covers both: the
 * default keeps a Dutch user's output identical, and an explicit locale changes it.
 */
import { describe, it, expect } from 'vitest'
import { fmtWhen, eur } from './dashboardFormat'

describe('fmtWhen · locale param', () => {
  const today = new Date()
  const todayIso = today.toISOString()

  it('defaults to nl-NL formatting when no locale is passed (unchanged output)', () => {
    const past = new Date(today.getFullYear() - 1, 0, 12).toISOString()
    expect(fmtWhen(past, 'nl-NL')).toBe('12 jan')
  })

  it('follows an explicit English locale for a past date', () => {
    const past = new Date(today.getFullYear() - 1, 0, 12).toISOString()
    expect(fmtWhen(past, 'en-GB')).toBe('12 Jan')
  })

  it("today's timestamp renders HH:mm regardless of locale (no month/day involved)", () => {
    // The time half is built from date parts, so it is byte-identical in every language.
    expect(fmtWhen(todayIso, 'nl-NL')).toMatch(/^\d{2}:\d{2}$/)
    expect(fmtWhen(todayIso, 'en-GB')).toBe(fmtWhen(todayIso, 'nl-NL'))
  })

  it('returns an empty string for missing/unparseable input', () => {
    expect(fmtWhen(undefined, 'nl-NL')).toBe('')
    expect(fmtWhen('not-a-date', 'nl-NL')).toBe('')
  })
})

describe('eur · locale param', () => {
  it('defaults to nl-NL grouping (dot thousands, comma-less symbol placement)', () => {
    expect(eur(12500)).toBe('€ 12.500')
  })

  it('follows an explicit English locale for grouping (currency stays EUR, not GBP)', () => {
    expect(eur(12500, 'en-GB')).toBe('€12,500')
  })

  it('treats a missing/invalid value as 0', () => {
    expect(eur(undefined)).toBe('€ 0')
  })
})
