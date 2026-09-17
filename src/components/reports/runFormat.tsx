/**
 * Shared run (execution) formatters + status badge. One source of truth for the
 * RunsTable report and the workflow editor's runs panel, so run rendering stays
 * consistent and is never duplicated. Labels resolve via the `reports` namespace.
 */
import { useTranslation } from 'react-i18next'
import { Ban, CheckCircle, XCircle, RotateCcw, Clock, ShieldAlert } from 'lucide-react'
import { formatDateTimeStr } from '@/lib/localDate'
import { formatSeconds } from '@/lib/formatters'
import SoftChip from '@/components/ui/SoftChip'
import CalloutBox from '@/components/ui/CalloutBox'
import MetadataBadge, { type BadgeMeta } from '@/components/ui/MetadataBadge'

// Short readable date + time — delegates to the ONE shared formatter (heraudit
// I18N-2: this file, messageParts and ordersTableParts each hand-built the same
// string; a locale change now lands in lib/datetime once).
// eslint-disable-next-line react-refresh/only-export-components -- shared formatter every run table/drawer in this file imports; HMR-nicety warning only
export const formatDT = formatDateTimeStr

// Format a millisecond duration as ms / s / m s (or em-dash if empty).
// GETALLEN-1: `locale` has no hardcoded default here — every caller in THIS
// file's own folder passes the active locale via useLocale()/useDateFormat();
// the default is kept only so the handful of callers outside this bucket
// (workflow editor's runs panel, settings jobs tabs) keep compiling unchanged
// until they are touched for another reason.
// eslint-disable-next-line react-refresh/only-export-components -- shared formatter every run table/drawer in this file imports; HMR-nicety warning only
export function formatDuration(ms?: number | null, locale: string = 'nl-NL') {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${formatSeconds(ms, locale)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

// Run status → colour + icon. Label = t('runs.status.<key>').
// `cancelled` (RUN-CONTROL-1 stop button) is deliberately NEUTRAL grey — a
// stopped run is not a failure; red stays reserved for `failed`.
// eslint-disable-next-line react-refresh/only-export-components -- shared meta map every run table/drawer in this file imports; HMR-nicety warning only
export const STATUS_META: Record<string, BadgeMeta> = {
  success:   { bg: 'var(--color-success-bg)', color: 'var(--color-success-text)', Icon: CheckCircle },
  // Ink is --color-on-danger-bg — the raw danger colour reads only 3.95:1 on its
  // own pastel, AA fail (Opus r3.5).
  failed:    { bg: 'var(--color-danger-bg)',  color: 'var(--color-on-danger-bg)',  Icon: XCircle },
  running:   { bg: 'var(--color-warning-bg)', color: 'var(--color-on-warning-bg)', Icon: RotateCcw },
  pending:   { bg: 'var(--hover-bg)',         color: 'var(--text-muted)',    Icon: Clock },
  waiting:   { bg: 'var(--hover-bg)',         color: 'var(--text-muted)',    Icon: Clock },
  cancelled: { bg: 'var(--hover-bg)',         color: 'var(--text-muted)',    Icon: Ban },
  // LIMITS-FE-F7: a run halted by a connector limit (BE WorkflowRun::STATUSES)
  // — warning token (not danger: it is a cap, not a failed step) + its own icon.
  blocked:   { bg: 'var(--color-warning-bg)', color: 'var(--color-on-warning-bg)', Icon: ShieldAlert },
}


// Coloured pill with icon + translated label for a run/step status. `reason`
// (the run's block reason when blocked, see blockedReason above) rides the
// badge's title/aria so the cap reason is reachable without opening the run drawer.
export function StatusBadge({ status, reason }: { status?: string; reason?: string | null }) {
  const { t } = useTranslation('reports')
  return (
    <MetadataBadge
      value={status}
      meta={STATUS_META}
      labelOf={(key) => t(`runs.status.${key}`, { defaultValue: status })}
      fallbackIcon={Clock}
      title={reason ?? undefined}
    />
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
