/**
 * QueueOverviewTab — Taakbeheer → Overzicht: per-queue and per-tenant backlog
 * health (pending/reserved counts + oldest ages) plus the worker heartbeat
 * heuristic (active/stalled/idle) and the total failed-job count. Read-only —
 * interventions live on the Jobs/Failed tabs. Polls via useQueueSummary (15s,
 * visible-tab only).
 */
import { useTranslation } from 'react-i18next'
import { RefreshCw, Layers, Building2 } from 'lucide-react'
import StatusPill from '@/components/ui/StatusPill'
import { formatDuration } from '@/components/reports/runFormat'

// Heartbeat status → semantic colour (never a plain grey "off" state — §4).
const STATUS_COLOR = { active: 'var(--color-success)', stalled: 'var(--color-danger)', idle: 'var(--text-muted)' }

// The API reports ages in whole seconds (or null); formatDuration expects ms —
// null * 1000 would silently become 0 in JS, so convert explicitly.
const ageMs = (seconds) => (seconds == null ? null : seconds * 1000)

// One queue or tenant bucket card — counts + ages + heartbeat pill.
function BucketCard({ t, name, bucket }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>{name}</span>
        <StatusPill label={t(`jobs.status.${bucket.status}`, bucket.status)} color={STATUS_COLOR[bucket.status] ?? 'var(--text-muted)'} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: 12 }}>
        <span style={{ color: 'var(--text-muted)' }}>{t('jobs.pending')}</span>
        <span style={{ color: 'var(--text)', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{bucket.pending}</span>
        <span style={{ color: 'var(--text-muted)' }}>{t('jobs.reserved')}</span>
        <span style={{ color: 'var(--text)', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{bucket.reserved}</span>
        <span style={{ color: 'var(--text-muted)' }}>{t('jobs.oldestPending')}</span>
        <span style={{ color: 'var(--text)', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{formatDuration(ageMs(bucket.oldest_pending_age_seconds))}</span>
        <span style={{ color: 'var(--text-muted)' }}>{t('jobs.oldestReserved')}</span>
        <span style={{ color: 'var(--text)', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{formatDuration(ageMs(bucket.oldest_reserved_age_seconds))}</span>
      </div>
    </div>
  )
}

export default function QueueOverviewTab({ summary, phase, onRefresh, onGoToFailed }) {
  const { t } = useTranslation('settings')
  const byQueue = summary?.by_queue ?? []
  const byTenant = summary?.by_tenant ?? []
  const failedTotal = summary?.failed_total ?? 0

  return (
    <div>
      {/* Non-database queue driver = this screen inspects the WRONG store (BE audit
          15-07 sends data.driver precisely so we can warn instead of showing zeros). */}
      {summary?.driver && summary.driver !== 'database' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', marginBottom: 12,
          borderRadius: 8, background: 'var(--color-warning-bg)', border: '1px solid color-mix(in srgb, var(--color-warning) 40%, transparent)' }}>
          <span style={{ fontSize: 12, color: 'var(--text)' }}>{t('jobs.driverWarning', { driver: summary.driver })}</span>
        </div>
      )}
      {/* Toolbar: worst-case heartbeat + failed count + manual refresh (auto-polls every 15s). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {summary?.status && (
          <StatusPill label={t(`jobs.status.${summary.status}`, summary.status)} color={STATUS_COLOR[summary.status] ?? 'var(--text-muted)'} />
        )}
        <button type="button" onClick={onGoToFailed} disabled={!failedTotal}
          style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999, border: 'none', cursor: failedTotal ? 'pointer' : 'default',
            color: failedTotal ? 'var(--color-danger)' : 'var(--text-muted)',
            background: failedTotal ? 'color-mix(in srgb, var(--color-danger) 12%, transparent)' : 'var(--hover-bg)' }}>
          {t('jobs.failedTotal', { count: failedTotal })}
        </button>
        <button type="button" onClick={onRefresh}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, height: 30, padding: '0 10px', fontSize: 12,
            border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
          <RefreshCw size={12} className={phase === 'loading' ? 'animate-spin' : undefined} /> {t('jobs.refresh')}
        </button>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('jobs.autoRefresh')}</span>
      </div>

      {phase === 'error' && <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: 8 }}>{t('jobs.loadError')}</p>}

      {phase !== 'error' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              <Layers size={12} /> {t('jobs.byQueue')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {phase === 'loading' && byQueue.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('common.loadingShort')}</p>}
              {phase === 'ready' && byQueue.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('jobs.noQueues')}</p>}
              {byQueue.map((b) => <BucketCard key={b.queue} t={t} name={b.queue} bucket={b} />)}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              <Building2 size={12} /> {t('jobs.byTenant')}
            </div>
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
