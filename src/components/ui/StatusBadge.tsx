/**
 * StatusBadge — shared status chip for map-keyed statuses (report tables/drawers).
 * Pass a `map` to add or override colours/labels for screen-specific statuses;
 * unknown statuses fall back to grey. Default labels come from i18n (common.status.*).
 * Renders through SoftChip since the C-CHIP unification (2026-07-06) — the `bg`
 * field is legacy: the soft tint now derives from `color` alone.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import SoftChip from './SoftChip'

interface StatusStyle {
  bg?: string
  color?: string
  label?: ReactNode
}

// Common statuses shared across the app (candidates + active/inactive entities).
// Canonical keys are English; the Dutch spellings stay as input aliases because
// incoming DATA (e.g. Shiftmanager) may still carry them (ID-ENGELS-1).
const DEFAULT_MAP: Record<string, StatusStyle> = {
  active:     { color: 'var(--color-success-text)' },
  actief:     { color: 'var(--color-success-text)' },
  inactive:   { color: 'var(--color-warning-text)' },
  nietactief: { color: 'var(--color-warning-text)' },
  external:   { color: 'var(--color-secondary)' },
  extern:     { color: 'var(--color-secondary)' },
}

interface StatusBadgeProps {
  status?: string | null
  map?: Record<string, StatusStyle>
  size?: number
}

// Shared status chip (see file docblock above): a caller's map can add/override
// colours and labels, an unrecognised status falls back to a grey chip.
export default function StatusBadge({ status, map = {}, size = 12 }: StatusBadgeProps) {
  const { t } = useTranslation('common')
  const key = String(status ?? '').toLowerCase()
  const s = { ...DEFAULT_MAP, ...map }[key] ?? { color: 'var(--text-muted)' }
  // Caller-provided label wins; otherwise translate known defaults; else show raw status.
  const label = map[key]?.label
    ?? (DEFAULT_MAP[key] ? t(`status.${key}`, { defaultValue: status ?? undefined }) : (status ?? '—'))
  return <SoftChip label={label} color={s.color} round size={size} />
}
