/**
 * dashboardFormat — small pure formatting/extraction helpers shared by the dashboard
 * page, its view-model hook and its block components. Extracted from Dashboard.tsx
 * (§0.3 size split); behaviour identical to the original inline helpers.
 */

// Turn a backend slug (status/funnel/stage value) into a readable label.
export const humanize = (s?: unknown): string =>
  typeof s === 'string' && s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/[_-]/g, ' ') : (s == null ? '—' : String(s))

// Compact "when": today → HH:mm, otherwise a short locale-aware date (e.g. "12 jun").
// `locale` defaults to 'nl-NL' for the current call site (useDashboardViewModel,
// out of this file's scope) which doesn't yet thread the active locale through —
// mirrors lib/formatters.ts's own non-React default (§11: house pattern for a
// pure helper called outside a component). Pass the caller's useLocale()/
// useDateFormat().locale explicitly once that call site is updated.
export const fmtWhen = (iso?: string, locale: string = 'nl-NL') => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
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
