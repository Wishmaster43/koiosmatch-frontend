/**
 * MetricsTab — Taakbeheer → Metrics (TAAKBEHEER-HORIZON-1 fase 2): Horizon's own
 * snapshotted throughput/gemiddelde duur per job en per queue (`horizon:snapshot`
 * runs every 5 minutes, see routes/console.php). Metadata only. Polls every 15s
 * while the tab is visible, mirrors RecentJobsTab.
 */
import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import { fetchJobMetrics } from './jobsApi'
import { BTN_H } from '@/config/buttonMetrics'

const TH = { padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const TD = { padding: '9px 12px', fontSize: 12.5, color: 'var(--text)', borderBottom: '1px solid var(--hover-bg)' }

// One metrics table (jobs or queues) — same column shape either way.
function MetricsTable({ rows, nameHeader, t }) {
  if (rows.length === 0) return <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: 8 }}>{t('jobs.metrics.empty')}</p>

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'auto', background: 'var(--surface)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>
          <th style={TH}>{nameHeader}</th>
          <th style={TH}>{t('jobs.metrics.colThroughput')}</th>
          <th style={TH}>{t('jobs.metrics.colRuntime')}</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td style={{ ...TD, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{r.name}</td>
              <td style={TD}>{r.throughput}</td>
              <td style={TD}>{Math.round(r.runtime_ms_avg)} ms</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function MetricsTab() {
  const { t } = useTranslation('settings')
  const [metrics, setMetrics] = useState({ jobs: [], queues: [] })
  const [phase, setPhase] = useState('loading')

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

  // Initial load, then a 15s visible-tab poll (matches Overzicht/Recent).
  useEffect(() => { load() }, [load])
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) load() }, 15000)
    return () => clearInterval(timer)
  }, [load])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <button type="button" onClick={load}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, height: BTN_H, padding: '0 10px', fontSize: 12,
            border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
          <RefreshCw size={12} className={phase === 'loading' ? 'animate-spin' : undefined} /> {t('jobs.refresh')}
        </button>
      </div>

      {phase === 'error' && <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: 8 }}>{t('jobs.loadError')}</p>}

      {phase !== 'error' && (
        <>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>{t('jobs.metrics.byJob')}</h3>
          <MetricsTable rows={metrics.jobs} nameHeader={t('jobs.metrics.colJob')} t={t} />

          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: '20px 0 8px' }}>{t('jobs.metrics.byQueue')}</h3>
          <MetricsTable rows={metrics.queues} nameHeader={t('jobs.metrics.colQueue')} t={t} />
        </>
      )}
    </div>
  )
}
