// Converts an <input type="month"> value ('YYYY-MM') to the full date string the
// backend's `date` validation rule reliably parses ('YYYY-MM-01'). Empty stays empty.
export function monthToDate(month: string): string {
  return month ? `${month}-01` : ''
}

// Converts a stored 'YYYY-MM-DD' date back to the 'YYYY-MM' shape <input type="month">
// expects when re-opening an entry for edit. Empty stays empty.
export function dateToMonth(date: string): string {
  return date ? date.slice(0, 7) : ''
}
