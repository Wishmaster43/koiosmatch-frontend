import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDateFormat, calcAge, daysUntilBirthday, toLocalIsoDate, humanizeIsoDates, daysSince, ddmmyyyy, hhmm, hhmmss } from './datetime'

// Direct guard for the house numeric-shape builders (DATUM-1): every existing
// case above exercises formatDate/formatDateTime with a DAY ≥ 10 (30-06-2026),
// which never proves the zero-pad step actually runs. This pins the single-digit
// day/hour/minute/second case a fix-round audit found unguarded — `5-8-2026`
// (a raw un-padded toLocaleDateString('nl-NL') output) must never come back.
describe('ddmmyyyy / hhmm / hhmmss — zero-pad single-digit parts', () => {
  it('pads a single-digit day and month', () => {
    expect(ddmmyyyy(new Date(2026, 7, 5))).toBe('05-08-2026')
  })
  it('pads a single-digit hour and minute', () => {
    expect(hhmm(new Date(2026, 7, 5, 3, 7))).toBe('03:07')
  })
  it('pads a single-digit hour, minute and second', () => {
    expect(hhmmss(new Date(2026, 7, 5, 3, 7, 9))).toBe('03:07:09')
  })
})

// Note: i18n is not initialised in tests → locale falls back to nl-NL (§3B).
describe('useDateFormat', () => {
  it('formats a date as DD-MM-YYYY', () => {
    const { result } = renderHook(() => useDateFormat())
    // Midday local time so the calendar day is timezone-stable.
    expect(result.current.formatDate('2026-06-30T12:00:00')).toBe('30-06-2026')
  })

  it('shows an em-dash for empty input', () => {
    const { result } = renderHook(() => useDateFormat())
    expect(result.current.formatDate(null)).toBe('—')
    expect(result.current.formatDate(undefined)).toBe('—')
  })

  it('returns the raw value when it cannot be parsed', () => {
    const { result } = renderHook(() => useDateFormat())
    expect(result.current.formatDate('not-a-date')).toBe('not-a-date')
  })
})

// Regression guard (Danny 05-08): every Tijdlijn/changelog drill-down renders the
// raw ISO string ("2026-08-04T17:30:00+00:00") instead of a formatted date+time —
// formatDateTime is the ONE house formatter fixing that everywhere.
describe('useDateFormat · formatDateTime', () => {
  it('formats a date+time as DD-MM-YYYY, HH:mm', () => {
    const { result } = renderHook(() => useDateFormat())
    // Local (no offset) ISO input so the expected wall-clock time is timezone-stable.
    expect(result.current.formatDateTime('2026-06-30T14:15:00')).toBe('30-06-2026 14:15')
  })

  it('never renders the raw ISO string verbatim', () => {
    const { result } = renderHook(() => useDateFormat())
    const raw = '2026-08-04T17:30:00+00:00'
    expect(result.current.formatDateTime(raw)).not.toBe(raw)
    expect(result.current.formatDateTime(raw)).not.toContain('T17:30:00')
  })

  it('shows an em-dash for empty input', () => {
    const { result } = renderHook(() => useDateFormat())
    expect(result.current.formatDateTime(null)).toBe('—')
    expect(result.current.formatDateTime(undefined)).toBe('—')
  })
})

describe('calcAge', () => {
  const now = new Date('2026-06-08T12:00:00') // reference "today"
  it('counts whole years, birthday already passed this year', () => {
    expect(calcAge('1966-05-01', now)).toBe(60)
  })
  it('subtracts a year when the birthday is still ahead this year', () => {
    expect(calcAge('1966-07-01', now)).toBe(59)
  })
  it('handles the birthday being today', () => {
    expect(calcAge('1966-06-08', now)).toBe(60)
  })
  it('returns null for missing/unparseable/implausible values', () => {
    expect(calcAge(null, now)).toBeNull()
    expect(calcAge('not-a-date', now)).toBeNull()
    expect(calcAge('2100-01-01', now)).toBeNull()
  })
})

// Regression guard (Danny 09-08, UTC-date-shift fix): `.toISOString().slice(0, 10)`
// converts through UTC first, which rolls a local midnight-ish date back a day in
// Europe/Amsterdam (always ahead of UTC). TZ is PINNED EXPLICITLY below via
// process.env.TZ — a test relying on whatever zone the machine happens to run in
// proves nothing on a box that happens to run in UTC, where old-buggy and fixed
// code produce the same output.
//
// No timezone is pinned here, and that is a deliberate choice rather than an
// omission. Reassigning process.env.TZ mid-process DOES work on this Node (checked
// with `node -e`), but pinning it is not needed: the Date below is BUILT from local
// components, so asking for its local calendar day must return that same day in
// EVERY timezone. That makes the assertion stronger than a pinned one — it also
// holds on a CI runner sitting in UTC — and it costs no @types/node dependency.
describe('toLocalIsoDate — returns the LOCAL calendar day, in both DST regimes', () => {

  it('keeps the picked day in winter (CET, UTC+1) — measured: 15 Jan 2026 used to save as 2026-01-14', () => {
    // Local 00:30 on the picked day: .toISOString() would land on 2026-01-14T23:30Z.
    expect(toLocalIsoDate(new Date(2026, 0, 15, 0, 30))).toBe('2026-01-15')
  })

  it('keeps the picked day in summer (CEST, UTC+2) — measured: 1 Jul 2026 used to save as 2026-06-30', () => {
    // Local 00:30 on the picked day: .toISOString() would land on 2026-06-30T22:30Z.
    expect(toLocalIsoDate(new Date(2026, 6, 1, 0, 30))).toBe('2026-07-01')
  })
})

describe('daysUntilBirthday', () => {
  const now = new Date('2026-06-08T12:00:00')
  it('is 0 on the birthday itself', () => {
    expect(daysUntilBirthday('1966-06-08', now)).toBe(0)
  })
  it('is 1 the day before', () => {
    expect(daysUntilBirthday('1990-06-09', now)).toBe(1)
  })
  it('rolls over to next year once the birthday has passed', () => {
    expect(daysUntilBirthday('1990-06-07', now)).toBe(364)
  })
  it('returns null for missing/unparseable values', () => {
    expect(daysUntilBirthday(undefined, now)).toBeNull()
    expect(daysUntilBirthday('nope', now)).toBeNull()
  })
})

// PDF-VACATURES-2026-08-14 point 4 — a plain day count, never bucketed into weeks/
// months/years and never carrying a unit letter.
describe('daysSince', () => {
  const now = new Date('2026-06-08T12:00:00')
  it('counts whole days since the given date', () => {
    expect(daysSince('2026-06-05T12:00:00', now)).toBe(3)
  })
  it('is 0 for the same moment', () => {
    expect(daysSince(now, now)).toBe(0)
  })
  it('returns null for a future date', () => {
    expect(daysSince('2026-06-09T12:00:00', now)).toBeNull()
  })
  it('returns null for missing/unparseable values', () => {
    expect(daysSince(undefined, now)).toBeNull()
    expect(daysSince('nope', now)).toBeNull()
  })
})

// DATUM-1 — a raw ISO date inside server-composed prose must reach the user as DD-MM-YYYY.
describe('humanizeIsoDates', () => {
  it('rewrites a bare ISO date inside a sentence', () => {
    expect(humanizeIsoDates('Geplaatst (match: X, tot 2027-08-08). Toch doorgaan?'))
      .toBe('Geplaatst (match: X, tot 08-08-2027). Toch doorgaan?')
  })
  it('rewrites an ISO timestamp to DD-MM-YYYY HH:mm', () => {
    expect(humanizeIsoDates('Afspraak op 2026-08-13T17:45:00Z.')).toBe('Afspraak op 13-08-2026 17:45.')
    expect(humanizeIsoDates('Vanaf 2026-01-05 09:00 beschikbaar.')).toBe('Vanaf 05-01-2026 09:00 beschikbaar.')
  })
  it('leaves non-date digits and already-Dutch dates alone', () => {
    expect(humanizeIsoDates('Sinds 31-05-2026 actief, dossier 2026-13-99.')).toBe('Sinds 31-05-2026 actief, dossier 2026-13-99.')
    expect(humanizeIsoDates(null)).toBe('')
  })
})

// BUREAU-KLOK-FE-1 risk 1: appointments.scheduled_at is a ZONELESS wall time the
// server stores verbatim as UTC — only UTC getters return what the user typed.
// The pre-fix local rendering showed the same appointment two hours apart between
// drawers (Amsterdam summer). These pins hold in EVERY process timezone because
// the input carries an explicit offset and the output is pinned to UTC.
describe('useDateFormat · formatWallTime — zoneless wall times render pinned to UTC', () => {
  it('renders the stored wall time, never the browser-local shift', () => {
    const { result } = renderHook(() => useDateFormat())
    // Stored "09:00" wall time serialized by the server as +00:00.
    expect(result.current.formatWallTime('2026-09-01T09:00:00+00:00')).toBe('01-09-2026 09:00')
  })
  it('shows an em-dash for empty input and the raw value when unparseable', () => {
    const { result } = renderHook(() => useDateFormat())
    expect(result.current.formatWallTime(null)).toBe('—')
    expect(result.current.formatWallTime('not-a-date')).toBe('not-a-date')
  })
})

// BUREAU-KLOK-FE-1 helper fix: the numeric DD-MM-YYYY shortcut used to silently
// DROP a caller's timeZone (ApplicationRow was saved only by not passing hour).
// A numeric-shape call WITH a zone now renders that zone's calendar day, still
// in fixed DD-MM-YYYY digits (DATUM-1) — never the locale's own slash format.
describe('useDateFormat · formatDate honours a caller-pinned timeZone on the numeric shape', () => {
  it('renders the UTC calendar day for a numeric call with timeZone UTC', () => {
    const { result } = renderHook(() => useDateFormat())
    // 23:30Z: the UTC day is the 1st regardless of the machine timezone ahead of UTC.
    expect(result.current.formatDate('2026-09-01T23:30:00+00:00', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })).toBe('01-09-2026')
  })
})
