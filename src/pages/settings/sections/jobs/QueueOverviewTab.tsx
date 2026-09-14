/**
 * QueueOverviewTab — Taakbeheer → Overzicht: per-queue and per-tenant backlog
 * health (pending/reserved counts + oldest ages) plus the worker heartbeat
 * heuristic (active/stalled/idle) and the total failed-job count. Read-only —
 * interventions live on the Jobs/Failed tabs. Polls via useQueueSummary (15s,
 * visible-tab only).
 */
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Layers, Building2 } from 'lucide-react'
import StatusPill from '@/components/ui/StatusPill'
import { formatDuration } from '@/components/reports/runFormat'
import Button from '@/components/ui/Button'
import { Mono, SectionTitle, Caption, GroupLabel, monoStyle } from '@/components/ui/typography'
import { tintBorder } from '@/lib/tint'
import { JobsRefreshButton, JobsErrorNotice } from './jobsShared'
import type { QueueSummary, QueueBucket } from './jobsApi'

// Heartbeat status → semantic colour (never a plain grey "off" state — §4).
const STATUS_COLOR: Record<string, string> = { active: 'var(--color-success)', stalled: 'var(--color-danger)', idle: 'var(--text-muted)' }

// The API reports ages in whole seconds (or null); formatDuration expects ms —
// null * 1000 would silently become 0 in JS, so convert explicitly.
const ageMs = (seconds?: number | null): number | null => (seconds == null ? null : seconds * 1000)

// Props for one queue or tenant bucket card.
interface BucketCardProps {
  t: TFunction // settings namespace translator
  name: string // queue name, or tenant id / label
  bucket: QueueBucket // counts + ages + heartbeat status for this bucket
}

// One queue or tenant bucket card — counts + ages + heartbeat pill.
function BucketCard({ t, name, bucket }: BucketCardProps) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <SectionTitle as="span" style={monoStyle}>{name}</SectionTitle>
        <StatusPill label={t(`jobs.status.${bucket.status}`, bucket.status)} color={STATUS_COLOR[bucket.status] ?? 'var(--text-muted)'} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: 12 }}>
        <span style={{ color: 'var(--text-muted)' }}>{t('jobs.pending')}</span>
        <Mono style={{ color: 'var(--text)', textAlign: 'right' }}>{bucket.pending}</Mono>
        <span style={{ color: 'var(--text-muted)' }}>{t('jobs.reserved')}</span>
        <Mono style={{ color: 'var(--text)', textAlign: 'right' }}>{bucket.reserved}</Mono>
        <span style={{ color: 'var(--text-muted)' }}>{t('jobs.oldestPending')}</span>
        <Mono style={{ color: 'var(--text)', textAlign: 'right' }}>{formatDuration(ageMs(bucket.oldest_pending_age_seconds))}</Mono>
        <span style={{ color: 'var(--text-muted)' }}>{t('jobs.oldestReserved')}</span>
        <Mono style={{ color: 'var(--text)', textAlign: 'right' }}>{formatDuration(ageMs(bucket.oldest_reserved_age_seconds))}</Mono>
      </div>
    </div>
  )
}

// Props: summary comes from the parent's useQueueSummary poll; phase drives loading/error, onRefresh/onGoToFailed are toolbar actions.
interface QueueOverviewTabProps {
  summary: QueueSummary | null // latest backlog snapshot, or null before the first load
  phase: 'loading' | 'ready' | 'error' // parent-owned load phase
  onRefresh: () => void // manual refresh (also polled automatically)
  onGoToFailed: () => void // switch the parent's sub-tab to Failed
}

// See the file's top doc above; read-only backlog health, polled every 15s while visible.
export default function QueueOverviewTab({ summary, phase, onRefresh, onGoToFailed }: QueueOverviewTabProps) {
  const { t } = useTranslation('settings')
  const byQueue = summary?.by_queue ?? []
  const byTenant = summary?.by_tenant ?? []
  const failedTotal = summary?.failed_total ?? 0

  return (
    <div>
      {/* QUEUE-INSPECT-REDIS (23-07): the backend inspector is DRIVER-AWARE now —
          database reads the jobs table, redis reads the live Horizon backlog. Only an
          unknown driver (sync/sqs/…) still means "this screen inspects the wrong store". */}
      {summary?.driver && !['database', 'redis'].includes(summary.driver) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', marginBottom: 12,
          borderRadius: 8, background: 'var(--color-warning-bg)', border: tintBorder('var(--color-warning)') }}>
          <span style={{ fontSize: 12, color: 'var(--text)' }}>{t('jobs.driverWarning', { driver: summary.driver })}</span>
        </div>
      )}
      {/* Toolbar: worst-case heartbeat + failed count + manual refresh (auto-polls every 15s). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {summary?.status && (
          <StatusPill label={t(`jobs.status.${summary.status}`, summary.status)} color={STATUS_COLOR[summary.status] ?? 'var(--text-muted)'} />
        )}
        <Button variant={failedTotal ? 'dangerSoft' : 'secondary'} size="sm" onClick={onGoToFailed} disabled={!failedTotal}>
          {t('jobs.failedTotal', { count: failedTotal })}
        </Button>
        <JobsRefreshButton phase={phase} onRefresh={onRefresh} label={t('jobs.refresh')} />
        <Caption>{t('jobs.autoRefresh')}</Caption>
      </div>

      {phase === 'error' && <JobsErrorNotice label={t('jobs.loadError')} />}

      {phase !== 'error' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          <div>
            <GroupLabel style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Layers size={12} /> {t('jobs.byQueue')}
            </GroupLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {phase === 'loading' && byQueue.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('common.loadingShort')}</p>}
              {phase === 'ready' && byQueue.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('jobs.noQueues')}</p>}
              {byQueue.map((b) => <BucketCard key={b.queue} t={t} name={b.queue} bucket={b} />)}
            </div>
          </div>

          <div>
            <GroupLabel style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Building2 size={12} /> {t('jobs.byTenant')}
            </GroupLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {phase === 'loading' && byTenant.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('common.loadingShort')}</p>}
              {phase === 'ready' && byTenant.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('jobs.noTenants')}</p>}
              {byTenant.map((b) => <BucketCard key={b.tenant_id} t={t} name={b.tenant_id === 'central' ? t('jobs.centralTenant') : b.tenant_id} bucket={b} />)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
