// Locale-aware date helpers for the planning calendar. Monday-first weekday
// abbreviations (2024-01-01 was a Monday); month/weekday names follow the
// active app locale. `locale` is REQUIRED (DATUM-1/LANE-B): a defaulted
// 'nl-NL' let a caller silently forget the argument and render Dutch names
// on a non-Dutch screen — every caller (views.tsx / PlanningPage.tsx /
// AddShiftModal.tsx) now passes useLocale()/useDateFormat().locale explicitly.
export const monthName = (locale: string, i: number) => new Date(2000, i, 1).toLocaleString(locale, { month: 'long' })

// Monday-first weekday abbreviations for the given locale. No plain-array
// export at the default locale any more (that was the silent-Dutch trap) —
// every caller computes its own memoised array via useMemo(() =>
// weekdaysMon(locale), [locale]).
export const weekdaysMon = (locale: string) => Array.from({ length: 7 }, (_, i) =>
  new Date(2024, 0, 1 + i).toLocaleString(locale, { weekday: 'short' }))

// True when two dates fall on the same calendar day.
export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// "12 januari 2026" — day + locale month + year.
export function formatDate(d: Date, locale: string) {
  return `${d.getDate()} ${monthName(locale, d.getMonth())} ${d.getFullYear()}`
}

// Local 'YYYY-MM-DD' for a Date — never toISOString (rolls back a day west of
// UTC, see lib/datetime.ts's own comment on the same trap).
export function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// The from/to window GET /planning/board needs to cover everything the active
// view can show, in local calendar days. Month is padded a week either side so
// the leading/trailing days MonthView's grid borrows from neighbouring months
// are covered too (a few extra days of overfetch, never a missing real shift);
// list has no date nav of its own, so it reuses month's window.
export function getViewRange(view: string, current: Date): { from: string; to: string } {
  if (view === 'week') {
    const dow = (current.getDay() + 6) % 7
    const start = new Date(current); start.setDate(current.getDate() - dow)
    const end = new Date(start); end.setDate(start.getDate() + 6)
    return { from: toIsoDate(start), to: toIsoDate(end) }
  }
  if (view === 'day') {
    return { from: toIsoDate(current), to: toIsoDate(current) }
  }
  // month + list
  const start = new Date(current.getFullYear(), current.getMonth(), 1)
  start.setDate(start.getDate() - 7)
  const end = new Date(current.getFullYear(), current.getMonth() + 1, 0)
  end.setDate(end.getDate() + 7)
  return { from: toIsoDate(start), to: toIsoDate(end) }
}
