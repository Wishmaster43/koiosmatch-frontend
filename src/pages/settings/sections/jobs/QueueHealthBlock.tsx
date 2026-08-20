/**
 * QueueHealthBlock — Taakbeheer top-of-screen health strip (QUEUE-WATCH-1).
 * Reads the additive `queue_status` block from GET /admin/jobs: a calm danger
 * notice when Horizon or the scheduler is down, one quiet success-tokenpaar
 * line + supervisor chips when everything is healthy, and a prominent
 * incident banner when the server-side watcher is alerting. Renders nothing
 * when `queue_status` is absent (older server — additive field, CLAUDE.md §10).
 */
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useDateFormat } from '@/lib/datetime'
import type { QueueStatus } from './jobsApi'
import { SectionTitle } from '@/components/ui/typography'

// 5-minute granularity per the contract — round down to whole minutes, never
// fabricate sub-minute precision the backend doesn't actually measure.
function minutesAgo(seconds: number | null): number | null {
  if (seconds == null) return null
  return Math.floor(seconds / 60)
}

// One supervisor's live status as a small soft chip (never a solid fill — §4).
function SupervisorChip({ name, status }: { name: string; status: string }) {
  const ok = status === 'running' || status === 'active'
  const color = ok ? 'var(--color-success)' : 'var(--color-danger)'
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
      color, background: `color-mix(in srgb, ${color} 12%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} 40%, transparent)` }}>
      {name}: {status}
    </span>
  )
}

export default function QueueHealthBlock({ queueStatus }: { queueStatus?: QueueStatus }) {
  const { t } = useTranslation('settings')
  const { formatDateTime } = useDateFormat()

  // Additive field tolerance: an older server sends no queue_status at all.
  if (!queueStatus) return null

  const { horizon_running, master_last_seen_seconds, supervisors, scheduler_last_tick_at, watch } = queueStatus
  const schedulerDown = !scheduler_last_tick_at
  const seenMinutes = minutesAgo(master_last_seen_seconds)

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Prominent incident banner — only while the server-side watcher is actively alerting. */}
      {watch?.alerting && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 10,
          borderRadius: 8, background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger)' }}>
          <AlertTriangle size={16} style={{ color: 'var(--color-danger-text)', flexShrink: 0 }} />
          <SectionTitle as="span">
            {t('jobs.health.incidentBanner', { since: formatDateTime(watch.open_incident_since) })}
          </SectionTitle>
        </div>
      )}

      {!horizon_running && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 10,
          borderRadius: 8, background: 'var(--color-danger-bg)', border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)' }}>
          <AlertTriangle size={16} style={{ color: 'var(--color-danger-text)', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: 'var(--text)' }}>{t('jobs.health.horizonDown')}</span>
        </div>
      )}

      {schedulerDown && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 10,
          borderRadius: 8, background: 'var(--color-danger-bg)', border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)' }}>
          <AlertTriangle size={16} style={{ color: 'var(--color-danger-text)', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: 'var(--text)' }}>{t('jobs.health.schedulerDown')}</span>
        </div>
      )}

      {/* Everything healthy: one quiet success line (the tokenpair, never a mix — §4). */}
      {horizon_running && !schedulerDown && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', flexWrap: 'wrap',
          borderRadius: 8, background: 'var(--color-success-bg)', border: '1px solid var(--color-success)' }}>
          <CheckCircle2 size={15} style={{ color: 'var(--color-success-text)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--text)' }}>
            {seenMinutes == null ? t('jobs.health.healthy') : t('jobs.health.healthySeen', { minutes: seenMinutes })}
          </span>
          {supervisors?.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 'auto' }}>
              {supervisors.map((s) => <SupervisorChip key={s.name} name={s.name} status={s.status} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
