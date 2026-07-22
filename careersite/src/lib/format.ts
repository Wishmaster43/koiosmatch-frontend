import type { HoursRange, SalaryRange } from '../types'
import { strings } from '../strings'

// Locale-aware number formatting for the Dutch market (CLAUDE.md §5) — never
// manual string concatenation for currency/number output.
const currencyFormatters = new Map<string, Intl.NumberFormat>()

// Cached per-currency formatter — building a new Intl.NumberFormat per render is wasteful.
function getCurrencyFormatter(currency: string): Intl.NumberFormat {
  let formatter = currencyFormatters.get(currency)
  if (!formatter) {
    formatter = new Intl.NumberFormat('nl-NL', { style: 'currency', currency, maximumFractionDigits: 0 })
    currencyFormatters.set(currency, formatter)
  }
  return formatter
}

// Renders a salary range as "€2.400 - €2.800 per maand", or the "in overleg" fallback when absent.
export function formatSalary(salary: SalaryRange | null): string {
  if (!salary) return strings.list.salaryUnknown
  const formatter = getCurrencyFormatter(salary.currency)
  return `${formatter.format(salary.from)} - ${formatter.format(salary.to)} ${salary.period}`
}

// Renders an hours range as "24-32 uur p/w"; collapses to one number when from === to.
export function formatHours(hours: HoursRange): string {
  const range = hours.from === hours.to ? `${hours.from}` : `${hours.from}-${hours.to}`
  return `${range} ${strings.list.hoursSuffix}`
}
