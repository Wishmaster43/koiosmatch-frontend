/**
 * Shared run (execution) formatters + status badge. One source of truth for the
 * RunsTable report and the workflow editor's runs panel, so run rendering stays
 * consistent and is never duplicated. Labels resolve via the `reports` namespace.
 */
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { Ban, CheckCircle, XCircle, RotateCcw, Clock } from 'lucide-react'
import { formatDateTimeStr } from '@/lib/localDate'
import SoftChip from '@/components/ui/SoftChip'
import CalloutBox from '@/components/ui/CalloutBox'

// Short readable date + time — delegates to the ONE shared formatter (heraudit
// I18N-2: this file, messageParts and ordersTableParts each hand-built the same
// string; a locale change now lands in lib/datetime once).
// eslint-disable-next-line react-refresh/only-export-components -- shared formatter every run table/drawer in this file imports; HMR-nicety warning only
export const formatDT = formatDateTimeStr

// Format a millisecond duration as ms / s / m s (or em-dash if empty).
// eslint-disable-next-line react-refresh/only-export-components -- shared formatter every run table/drawer in this file imports; HMR-nicety warning only
export function formatDuration(ms?: number | null) {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

// One status's visual treatment.
interface StatusMeta { bg: string; color: string; Icon: ComponentType<{ size?: number }> }

// Run status → colour + icon. Label = t('runs.status.<key>').
// `cancelled` (RUN-CONTROL-1 stop button) is deliberately NEUTRAL grey — a
// stopped run is not a failure; red stays reserved for `failed`.
// eslint-disable-next-line react-refresh/only-export-components -- shared meta map every run table/drawer in this file imports; HMR-nicety warning only
export const STATUS_META: Record<string, StatusMeta> = {
  success:   { bg: 'var(--color-success-bg)', color: 'var(--color-success-text)', Icon: CheckCircle },
  // Ink is --color-on-danger-bg — the raw danger colour reads only 3.95:1 on its
  // own pastel, AA fail (Opus r3.5).
  failed:    { bg: 'var(--color-danger-bg)',  color: 'var(--color-on-danger-bg)',  Icon: XCircle },
  running:   { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)', Icon: RotateCcw },
  pending:   { bg: 'var(--hover-bg)',         color: 'var(--text-muted)',    Icon: Clock },
  waiting:   { bg: 'var(--hover-bg)',         color: 'var(--text-muted)',    Icon: Clock },
  cancelled: { bg: 'var(--hover-bg)',         color: 'var(--text-muted)',    Icon: Ban },
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

// WF-DRYRUN-FE-1: a dry-run "skipped" step (a send module blocked in a dry run)
// reads as a DISTINCT soft chip, never as a real outcome — StatusBadge's own
// fallback treatment would blur it into "just another unknown status". Every
// other step status still renders via the shared StatusBadge above.
export function StepStatusBadge({ status, ok }: { status?: string; ok?: boolean }) {
  const { t } = useTranslation('reports')
  if (status === 'skipped') {
    return <SoftChip label={t('runs.status.skipped', { defaultValue: 'Skipped' })} color="var(--color-info)" round size={11} />
  }
  return <StatusBadge status={status ?? (ok ? 'success' : 'failed')} />
}

// WF-DRYRUN-FE-1: the ONE dry-run banner, shown wherever a run's own detail
// renders (RunDetailDrawer / WorkflowHistoryView's inline expand / LogsPanel) —
// one canonical message so it never drifts into three re-worded copies.
export function DryRunBanner() {
  const { t } = useTranslation('reports')
  return (
    <CalloutBox variant="info">
      {t('runs.dryRun.banner', { defaultValue: 'Dry run: send steps skipped' })}
    </CalloutBox>
  )
}
