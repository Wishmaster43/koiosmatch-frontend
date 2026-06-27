/**
 * Shared run (execution) formatters + status badge. One source of truth for the
 * RunsTable report and the workflow editor's runs panel, so run rendering stays
 * consistent and is never duplicated. Labels resolve via the `reports` namespace.
 */
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle, XCircle, RotateCcw, Clock } from 'lucide-react'

const PAD = (n: number) => String(n).padStart(2, '0')

// Format an ISO datetime into a short readable date + time (or em-dash if empty).
export function formatDT(dt?: string | number | Date | null) {
  if (!dt) return '—'
  const d = new Date(dt)
  return `${PAD(d.getDate())}-${PAD(d.getMonth() + 1)}-${d.getFullYear()} ${PAD(d.getHours())}:${PAD(d.getMinutes())}`
}

// Format a millisecond duration as ms / s / m s (or em-dash if empty).
export function formatDuration(ms?: number | null) {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

// One status's visual treatment.
interface StatusMeta { bg: string; color: string; Icon: ComponentType<{ size?: number }> }

// Run status → colour + icon. Label = t('runs.status.<key>').
export const STATUS_META: Record<string, StatusMeta> = {
  success: { bg: 'var(--color-success-bg)', color: 'var(--color-success)', Icon: CheckCircle },
  failed:  { bg: 'var(--color-danger-bg)',  color: 'var(--color-danger)',  Icon: XCircle },
  running: { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)', Icon: RotateCcw },
  pending: { bg: 'var(--hover-bg)',         color: 'var(--text-muted)',    Icon: Clock },
}

// Coloured pill with icon + translated label for a run/step status.
export function StatusBadge({ status }: { status?: string }) {
  const { t } = useTranslation('reports')
  const m = (status ? STATUS_META[status] : undefined) ?? { bg: 'var(--hover-bg)', color: 'var(--text-muted)', Icon: Clock }
  const Icon = m.Icon
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: m.bg, color: m.color,
                   fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>
      <Icon size={10} />
      {status ? t(`runs.status.${status}`, { defaultValue: status }) : '—'}
    </span>
  )
}
