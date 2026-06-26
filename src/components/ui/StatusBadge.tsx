/**
 * StatusBadge — shared colored status pill.
 *
 * Replaces the ~11 near-identical local StatusBadge copies across the report
 * tables/drawers. Pass a `map` to add or override colors/labels for statuses that
 * are specific to a screen (e.g. shift statuses); unknown statuses fall back to grey.
 * Default labels come from i18n (common.status.*); a `map` override can supply its own.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

interface StatusStyle {
  bg?: string
  color?: string
  label?: ReactNode
}

// Common statuses shared across the app (candidates + active/inactive entities).
const DEFAULT_MAP: Record<string, StatusStyle> = {
  actief:     { bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
  active:     { bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
  nietactief: { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)' },
  inactive:   { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)' },
  extern:     { bg: 'var(--color-secondary-bg)', color: 'var(--color-secondary)' },
}

interface StatusBadgeProps {
  status?: string | null
  map?: Record<string, StatusStyle>
  size?: number
}

export default function StatusBadge({ status, map = {}, size = 12 }: StatusBadgeProps) {
  const { t } = useTranslation('common')
  const key = String(status ?? '').toLowerCase()
  const s = { ...DEFAULT_MAP, ...map }[key] ?? { bg: 'var(--hover-bg)', color: 'var(--text-muted)' }
  // Caller-provided label wins; otherwise translate known defaults; else show raw status.
  const label = map[key]?.label
    ?? (DEFAULT_MAP[key] ? t(`status.${key}`, { defaultValue: status ?? undefined }) : (status ?? '—'))
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
