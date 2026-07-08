/**
 * datetime — locale-aware date formatting tied to the active language.
 *
 * Replaces the hardcoded 'nl-NL' calls scattered through the candidate screens.
 * The locale follows ThemeContext/i18n, so a German user sees German month names.
 */
import { useTranslation } from 'react-i18next'
import { LOCALE_BY_LANG } from '../i18n'

type DateInput = string | number | Date | null | undefined

export function useLocale(): string {
  const { i18n } = useTranslation()
  return (LOCALE_BY_LANG as Record<string, string>)[i18n.language] ?? 'nl-NL'
}

export function useDateFormat() {
  const locale = useLocale()
  // Default to numeric DD-MM-YYYY (the app-wide standard, see CLAUDE.md §3B).
  const formatDate = (value: DateInput, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' }): string => {
    if (!value) return '—'
    const d = new Date(value)
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString(locale, opts)
  }
  // DD-MM-YYYY HH:mm — the app-wide standard for drill-downs / detail views (never raw ISO).
  const formatDateTime = (value: DateInput): string => {
    if (!value) return '—'
    const d = new Date(value)
    return isNaN(d.getTime()) ? String(value)
      : d.toLocaleString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  return { locale, formatDate, formatDateTime }
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
