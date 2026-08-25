/**
 * datetime — locale-aware date formatting tied to the active language.
 *
 * Replaces the hardcoded 'nl-NL' calls scattered through the candidate screens.
 * The locale follows ThemeContext/i18n, so a German user sees German month names.
 */
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { LOCALE_BY_LANG } from '../i18n'
// Re-exported so existing importers keep working; it lives in localDate because
// it needs no locale and this module's i18n import has an initialising side effect.
export { toLocalIsoDate, humanizeIsoDates } from './localDate'

type DateInput = string | number | Date | null | undefined

// Convert a Date to its LOCAL calendar-day 'YYYY-MM-DD' — never `d.toISOString().slice(0, 10)`
// for a user-picked date. `toISOString()` converts through UTC first, and Europe/Amsterdam
// is always ahead of UTC (UTC+1 winter / UTC+2 summer), so local midnight rolls back to the
// PREVIOUS day once converted — measured: picking 1 July 2026 saved as "2026-06-30", picking
// 15 January 2026 saved as "2026-01-14", year-round, winter and summer alike. Reading the
// Date's own LOCAL getters (getFullYear/getMonth/getDate) instead means the calendar day the
// user actually picked is the one that round-trips to the API.

// Non-hook formatters (heraudit I18N-2) re-exported from localDate — they live
// there because this module's i18n import has an initialising side effect.
export { formatDateOnly, formatDateTimeStr } from './localDate'

// House numeric shapes (DATUM-1): DD-MM-YYYY and HH:mm, built from date parts so no
// locale can reshape them; only the option set that asks for pure digits takes this path.
const NUMERIC_DATE: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' }
const pad2 = (n: number) => String(n).padStart(2, '0')
export const ddmmyyyy = (d: Date) => `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`
export const hhmm = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
const isNumericDate = (o: Intl.DateTimeFormatOptions) =>
  o.day === '2-digit' && o.month === '2-digit' && o.year === 'numeric' && !o.weekday && !o.hour && !o.minute && !o.era && !o.timeZoneName

export function useLocale(): string {
  const { i18n } = useTranslation()
  // Optional chaining: some tests stub react-i18next with a bare `{ t }` (no
  // `i18n`) — this keeps the house locale hook safe under those mocks instead
  // of throwing, falling back to the same nl-NL default as an unresolved language.
  return (LOCALE_BY_LANG as Record<string, string>)[i18n?.language ?? ''] ?? 'nl-NL'
}

export function useDateFormat() {
  const locale = useLocale()
  // Stable identities (audit item 7 fast-follow): these feed column-array memos —
  // a fresh closure per render silently defeated the candidates row memoization.
  // Default to numeric DD-MM-YYYY (the app-wide standard, see CLAUDE.md §3B).
  // DATUM-1: the numeric default is DD-MM-YYYY in EVERY language (measured 25-08: en-GB
  // rendered 25/08/2026, de-DE 25.08.2026). Only a caller asking for month names or a
  // weekday gets the locale's own wording; digits never change shape per language.
  const formatDate = useCallback((value: DateInput, opts: Intl.DateTimeFormatOptions = NUMERIC_DATE): string => {
    if (!value) return '—'
    const d = new Date(value)
    if (isNaN(d.getTime())) return String(value)
    return isNumericDate(opts) ? ddmmyyyy(d) : d.toLocaleDateString(locale, opts)
  }, [locale])
  // DD-MM-YYYY HH:mm — the app-wide standard for drill-downs / detail views (never raw ISO).
  const formatDateTime = useCallback((value: DateInput): string => {
    if (!value) return '—'
    const d = new Date(value)
    return isNaN(d.getTime()) ? String(value) : `${ddmmyyyy(d)} ${hhmm(d)}`
  }, [])
  // HH:mm only — for cells that already show the date separately (e.g. a date/time
  // split across two lines). Empty string (not '—') for missing/unparseable input,
  // matching every call site's own pre-existing fallback (never a visible change).
  const formatTime = useCallback((value: DateInput): string => {
    if (!value) return ''
    const d = new Date(value)
    return isNaN(d.getTime()) ? '' : hhmm(d)
  }, [])
  return useMemo(() => ({ locale, formatDate, formatDateTime, formatTime }), [locale, formatDate, formatDateTime, formatTime])
}

// Age in whole years from a birthdate; accounts for whether the birthday already
// passed this year. Null for a missing/unparseable/implausible value. `now` is
// injectable so the calculation is deterministically testable.
export function calcAge(dob: DateInput, now: Date = new Date()): number | null {
  if (!dob) return null
  const d = new Date(dob)
  if (isNaN(d.getTime())) return null
  let age = now.getFullYear() - d.getFullYear()
  const beforeBirthday = now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())
  if (beforeBirthday) age--
  return age >= 0 && age < 150 ? age : null
}

// Whole days until the next birthday (0 = today). Null for a missing/unparseable
// value. `now` is injectable for deterministic tests.
export function daysUntilBirthday(dob: DateInput, now: Date = new Date()): number | null {
  if (!dob) return null
  const d = new Date(dob)
  if (isNaN(d.getTime())) return null
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let next = new Date(today.getFullYear(), d.getMonth(), d.getDate())
  if (next < today) next = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate())
  return Math.round((next.getTime() - today.getTime()) / 86400000)
}

export type RelativeAgeUnit = 'days' | 'weeks' | 'months' | 'years'

// PDF-VACATURES point 4 (Danny 14-08): the age column shows a plain day count
// (no unit letter, no week/month/year bucketing) — whole days since `value`,
// or null for a missing/unparseable/future date. Pure + `now`-injectable.
export function daysSince(value: DateInput, now: Date = new Date()): number | null {
  if (!value) return null
  const d = new Date(value)
  if (isNaN(d.getTime())) return null
  const diffMs = now.getTime() - d.getTime()
  if (diffMs < 0) return null
  return Math.floor(diffMs / 86400000)
}

// V2 (vacatures-tabel-cluster): compact relative age (days → weeks → months →
// years), e.g. for "how old is this vacancy" columns. Pure + `now`-injectable
// for deterministic tests, mirrors calcAge/daysUntilBirthday above. Returns null
// for a missing/unparseable value or a future date (never a negative age).
export function relativeAge(value: DateInput, now: Date = new Date()): { value: number; unit: RelativeAgeUnit } | null {
  if (!value) return null
  const d = new Date(value)
  if (isNaN(d.getTime())) return null
  const diffMs = now.getTime() - d.getTime()
  if (diffMs < 0) return null
  const days = Math.floor(diffMs / 86400000)
  if (days < 7) return { value: days, unit: 'days' }
  if (days < 30) return { value: Math.floor(days / 7), unit: 'weeks' }
  if (days < 365) return { value: Math.floor(days / 30), unit: 'months' }
  return { value: Math.floor(days / 365), unit: 'years' }
}
