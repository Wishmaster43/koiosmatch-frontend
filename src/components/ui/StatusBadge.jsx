/**
 * StatusBadge — shared colored status pill.
 *
 * Replaces the ~11 near-identical local StatusBadge copies across the report
 * tables/drawers. Pass a `map` to add or override colors/labels for statuses that
 * are specific to a screen (e.g. shift statuses); unknown statuses fall back to grey.
 * Default labels come from i18n (common.status.*); a `map` override can supply its own.
 */
import { useTranslation } from 'react-i18next'

// Common statuses shared across the app (candidates + active/inactive entities).
const DEFAULT_MAP = {
  actief:     { bg: '#F0FDF4', color: 'var(--color-success)' },
  active:     { bg: '#F0FDF4', color: 'var(--color-success)' },
  nietactief: { bg: '#FFF7ED', color: '#C2410C' },
  inactive:   { bg: '#FFF7ED', color: '#C2410C' },
  extern:     { bg: 'var(--color-secondary-bg)', color: '#1D4ED8' },
}

export default function StatusBadge({ status, map = {}, size = 12 }) {
  const { t } = useTranslation('common')
  const key = String(status ?? '').toLowerCase()
  const s = { ...DEFAULT_MAP, ...map }[key] ?? { bg: '#F9FAFB', color: '#6B7280' }
  // Caller-provided label wins; otherwise translate known defaults; else show raw status.
  const label = map[key]?.label
    ?? (DEFAULT_MAP[key] ? t(`status.${key}`, { defaultValue: status }) : (status ?? '—'))
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', borderRadius: 20,
      padding: '2px 9px', fontSize: size, fontWeight: 500,
      background: s.bg, color: s.color, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}
