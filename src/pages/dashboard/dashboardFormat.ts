/**
 * dashboardFormat — small pure formatting/extraction helpers shared by the dashboard
 * page, its view-model hook and its block components. Extracted from Dashboard.tsx
 * (§0.3 size split); behaviour identical to the original inline helpers.
 */

// Turn a backend slug (status/funnel/stage value) into a readable label.
export const humanize = (s?: unknown): string =>
  typeof s === 'string' && s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/[_-]/g, ' ') : (s == null ? '—' : String(s))

// Compact "when": today → HH:mm, otherwise a short nl-NL date (e.g. "12 jun").
export const fmtWhen = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

// Euro formatting for the pipeline-value KPI (nl-NL, no decimals).
export const eur = (v?: unknown) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(v) || 0)

// Extract the filter value from a clicked chart datum (sector or legend item).
export const fv = (d?: unknown) => {
  const x = d as { filterValue?: unknown; payload?: { filterValue?: unknown } } | null | undefined
  return (x && (x.filterValue ?? x.payload?.filterValue)) || undefined
}
