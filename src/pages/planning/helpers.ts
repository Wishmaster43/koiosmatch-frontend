// Locale-aware date helpers for the planning calendar. Monday-first weekday
// abbreviations (2024-01-01 was a Monday); month names follow the active locale.
// `locale` defaults to 'nl-NL' for existing call sites (views.tsx / PlanningPage.tsx /
// AddShiftModal.tsx, out of this file's scope) that don't yet pass one — mirrors
// lib/formatters.ts's own non-React default (§11: house pattern for a pure helper
// called outside a component). A caller with access to the active app locale
// (useLocale()/useDateFormat().locale) should pass it explicitly.
export const monthName = (i: number, locale: string = 'nl-NL') => new Date(2000, i, 1).toLocaleString(locale, { month: 'long' })

// Function form so a caller CAN pass a locale; WEEKDAYS_MON below stays the
// default-locale array for existing call sites that import it as a plain constant.
export const weekdaysMon = (locale: string = 'nl-NL') => Array.from({ length: 7 }, (_, i) =>
  new Date(2024, 0, 1 + i).toLocaleString(locale, { weekday: 'short' }))

export const WEEKDAYS_MON = weekdaysMon()

// True when two dates fall on the same calendar day.
export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// "12 januari 2026" — day + locale month + year.
export function formatDate(d: Date, locale: string = 'nl-NL') {
  return `${d.getDate()} ${monthName(d.getMonth(), locale)} ${d.getFullYear()}`
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
