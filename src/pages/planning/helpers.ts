// Locale-aware date helpers for the planning calendar. Monday-first weekday
// abbreviations (2024-01-01 was a Monday); month names follow the active locale.
export const monthName = (i: number) => new Date(2000, i, 1).toLocaleString(undefined, { month: 'long' })

export const WEEKDAYS_MON = Array.from({ length: 7 }, (_, i) =>
  new Date(2024, 0, 1 + i).toLocaleString(undefined, { weekday: 'short' }))

// True when two dates fall on the same calendar day.
export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// "12 januari 2026" — day + locale month + year.
export function formatDate(d: Date) {
  return `${d.getDate()} ${monthName(d.getMonth())} ${d.getFullYear()}`
}
