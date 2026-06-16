/**
 * StatusBadge — shared colored status pill.
 *
 * Replaces the ~11 near-identical local StatusBadge copies across the report
 * tables/drawers. Pass a `map` to add or override colors/labels for statuses that
 * are specific to a screen (e.g. shift statuses); unknown statuses fall back to grey.
 */

// Common statuses shared across the app (candidates + active/inactive entities).
const DEFAULT_MAP = {
  actief:     { bg: '#F0FDF4', color: '#16A34A', label: 'Actief' },
  active:     { bg: '#F0FDF4', color: '#16A34A', label: 'Actief' },
  nietactief: { bg: '#FFF7ED', color: '#C2410C', label: 'Niet actief' },
  inactive:   { bg: '#FFF7ED', color: '#C2410C', label: 'Inactief' },
  extern:     { bg: '#EFF6FF', color: '#1D4ED8', label: 'Extern' },
}

export default function StatusBadge({ status, map = {}, size = 12 }) {
  const key = String(status ?? '').toLowerCase()
  const s = { ...DEFAULT_MAP, ...map }[key] ?? { bg: '#F9FAFB', color: '#6B7280' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', borderRadius: 20,
      padding: '2px 9px', fontSize: size, fontWeight: 500,
      background: s.bg, color: s.color, whiteSpace: 'nowrap',
    }}>
      {s.label ?? status ?? '—'}
    </span>
  )
}
