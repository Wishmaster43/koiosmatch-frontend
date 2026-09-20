/**
 * MetricsTab — Taakbeheer → Metrics (TAAKBEHEER-HORIZON-1 fase 2): Horizon's own
 * snapshotted throughput/gemiddelde duur per job en per queue (`horizon:snapshot`
 * runs every 5 minutes, see routes/console.php). Metadata only. Polls every 15s
 * while the tab is visible, mirrors RecentJobsTab.
 */
import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { fetchJobMetrics, type JobMetrics, type JobMetricRow } from './jobsApi'
import { formatDuration } from '@/components/reports/runFormat'
import { SectionTitle, Caption } from '@/components/ui/typography'
import { JobsRefreshButton, JobsErrorNotice } from './jobsShared'
import { useVisiblePoll } from '@/hooks/useVisiblePoll'

// Layout only — text identity (11px muted) lives in the Caption atom rendered
// inside these cells (HUISSTIJL-1: identity never re-declared locally).
const TH = { padding: '9px 12px', textAlign: 'left' as const, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' as const }
const TD = { padding: '9px 12px', fontSize: 12.5, color: 'var(--text)', borderBottom: '1px solid var(--hover-bg)' }

// Props for one metrics table (jobs or queues) — same column shape either way.
interface MetricsTableProps {
  rows: JobMetricRow[] // the snapshot rows for this table
  nameHeader: string // translated header for the name column
  t: TFunction // settings namespace translator
}

// One metrics table (jobs or queues) — same column shape either way.
function MetricsTable({ rows, nameHeader, t }: MetricsTableProps) {
  if (rows.length === 0) return <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: 8 }}>{t('jobs.metrics.empty')}</p>

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'auto', background: 'var(--surface)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>
          <th style={TH}><Caption style={{ fontWeight: 600 }}>{nameHeader}</Caption></th>
          <th style={TH}><Caption style={{ fontWeight: 600 }}>{t('jobs.metrics.colThroughput')}</Caption></th>
          <th style={TH}><Caption style={{ fontWeight: 600 }}>{t('jobs.metrics.colRuntime')}</Caption></th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td style={{ ...TD, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{r.name}</td>
              <td style={TD}>{r.throughput}</td>
              <td style={TD}>{formatDuration(Math.round(r.runtime_ms_avg))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Empty snapshot shape, used until the first fetch resolves.
const EMPTY_METRICS: JobMetrics = { jobs: [], queues: [] }

// Polls Horizon's per-job/per-queue throughput snapshot every 15s while the tab is visible (see the module doc above for what's actually measured).
export default function MetricsTab() {
  const { t } = useTranslation('settings')
  const [metrics, setMetrics] = useState<JobMetrics>(EMPTY_METRICS)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')

  // Refetches the snapshot; keeps the phase at 'ready' during a background poll so the table doesn't flash back to a loading state on every refresh.
  const load = useCallback(async () => {
    setPhase((p) => (p === 'ready' ? 'ready' : 'loading'))
    try {
      const data = await fetchJobMetrics()
      setMetrics(data)
      setPhase('ready')
    } catch {
      setPhase('error')
    }
  }, [])

  // Initial load.
  useEffect(() => { load() }, [load])

  // Poll while visible (shared useVisiblePoll).
  useVisiblePoll(load, 15000)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <JobsRefreshButton phase={phase} onRefresh={load} label={t('jobs.refresh')} />
      </div>

      {phase === 'error' && <JobsErrorNotice label={t('jobs.loadError')} />}

      {phase !== 'error' && (
        <>
          <SectionTitle style={{ margin: '0 0 8px' }}>{t('jobs.metrics.byJob')}</SectionTitle>
          <MetricsTable rows={metrics.jobs} nameHeader={t('jobs.metrics.colJob')} t={t} />

          <SectionTitle style={{ margin: '20px 0 8px' }}>{t('jobs.metrics.byQueue')}</SectionTitle>
          <MetricsTable rows={metrics.queues} nameHeader={t('jobs.metrics.colQueue')} t={t} />
        </>
      )}
    </div>
  )
}
