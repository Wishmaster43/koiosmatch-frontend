/**
 * dashboardFormat — small pure formatting/extraction helpers shared by the dashboard
 * page, its view-model hook and its block components. Extracted from Dashboard.tsx
 * (§0.3 size split); behaviour identical to the original inline helpers.
 */
import { hhmm } from '@/lib/localDate'

// Turn a backend slug (status/funnel/stage value) into a readable label.
export const humanize = (s?: unknown): string =>
  typeof s === 'string' && s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/[_-]/g, ' ') : (s == null ? '—' : String(s))

// Compact "when": today → HH:mm, otherwise a short date with the month name ("12 jun").
// Two halves, two rules: the TIME is numeric, so it is built from date parts and reads
// the same in every language (DATUM-1); the DATE carries a month NAME, so it follows the
// app language. `locale` is therefore required — a default would silently render Dutch
// month names on an English screen, which is exactly what it did before 25-08.
export const fmtWhen = (iso: string | undefined, locale: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toDateString() === new Date().toDateString()
    ? hhmm(d)
    : d.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
}

// Euro formatting for the pipeline-value KPI (no decimals). Same locale-default
// convention as fmtWhen above — EUR stays the fixed currency (tenant's business
// currency, not language-dependent); only the grouping/decimal separator follows locale.
export const eur = (v?: unknown, locale: string = 'nl-NL') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(v) || 0)

// Extract the filter value from a clicked chart datum (sector or legend item).
export const fv = (d?: unknown) => {
  const x = d as { filterValue?: unknown; payload?: { filterValue?: unknown } } | null | undefined
  return (x && (x.filterValue ?? x.payload?.filterValue)) || undefined
}
