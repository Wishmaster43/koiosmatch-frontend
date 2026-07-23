/**
 * WorkflowHistoryView — the editor's GESCHIEDENIS tab: the run history for one
 * workflow. Fetches this workflow's runs, renders a compact Make-style table
 * (started · trigger · status · duration) and opens the shared RunDetailDrawer
 * (run meta + per-step INPUT/OUTPUT) on row click. Handles the four UI states.
 */
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, History, Play, Clock as ClockIcon } from 'lucide-react'
import { useReportList } from '@/components/reports/useReportList'
import { formatDuration, StatusBadge } from '@/components/reports/runFormat'
import RunDetailDrawer from '@/components/reports/RunDetailDrawer'
import type { RunRow } from '@/types/reports'

const TH: CSSProperties = { padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600,
  color: 'var(--text-muted)', background: 'var(--hover-bg)', borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap', userSelect: 'none' }
const TD: CSSProperties = { padding: '12px 16px', fontSize: 13, color: 'var(--text)',
  borderBottom: '1px solid var(--hover-bg)' }

export default function WorkflowHistoryView({ workflowId, initialRun }: {
  workflowId?: string | number
  // LOGS-DRILL-1: arriving from the Logs panel's history-jump — auto-open this
  // run's drawer. A fresh wrapper object per jump (compared by identity), so the
  // same run re-opens on a second jump while a closed drawer never self-reopens.
  initialRun?: { row: RunRow } | null
}) {
  const { t } = useTranslation('reports')
  // Runs are scoped to this workflow; the drawer opens above the editor overlay.
  const { rows, loading } = useReportList<RunRow>(workflowId != null ? `/workflows/${workflowId}/runs` : '/workflow-runs')
  const [drill, setDrill] = useState<RunRow | null>(null)

  // LOGS-DRILL-1: open the requested run exactly once per jump (object identity).
  // Prefer the freshly fetched list row; the carried row is the fallback so a run
  // outside this page still opens instead of silently no-oping (verify finding).
  const consumedRun = useRef<{ row: RunRow } | null>(null)
  useEffect(() => {
    if (initialRun == null || loading || consumedRun.current === initialRun) return
    consumedRun.current = initialRun
    setDrill(rows.find(r => String(r.id) === String(initialRun.row.id)) ?? initialRun.row)
  }, [initialRun, loading, rows])

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <History size={16} color="var(--color-primary)" />
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{t('runs.editorTitle')}</h2>
          {!loading && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {t('runs.editorCount', { count: rows.length })}
            </span>
          )}
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>

          {/* Loading */}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                          padding: 48, color: 'var(--text-muted)', fontSize: 13 }}>
              <Loader2 size={15} className="animate-spin" /> {t('runs.loading')}
            </div>
          )}

          {/* Empty */}
          {!loading && rows.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          gap: 10, padding: 48, textAlign: 'center' }}>
              <History size={28} color="var(--border)" />
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>{t('runs.editorEmpty')}</p>
            </div>
          )}

          {/* Success */}
          {!loading && rows.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH}>{t('runs.cols.started')}</th>
                  <th style={TH}>{t('runs.cols.trigger')}</th>
                  <th style={TH}>{t('runs.cols.status')}</th>
                  <th style={TH}>{t('runs.cols.duration')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id ?? i}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setDrill(r)}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 500 }}>
                        {r.started_at ? new Date(r.started_at).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {r.started_at ? new Date(r.started_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </td>
                    <td style={{ ...TD, fontSize: 12, color: 'var(--text-muted)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        {(r.trigger ?? r.trigger_type) === 'schedule'
                          ? <ClockIcon size={12} /> : <Play size={12} />}
                        {r.trigger ?? r.trigger_type ?? '—'}
                        {r.triggered_by ? ` · ${r.triggered_by}` : ''}
                      </span>
                    </td>
                    <td style={TD}><StatusBadge status={r.status} /></td>
                    <td style={{ ...TD, fontSize: 12, color: 'var(--text-muted)' }}>
                      {formatDuration(r.duration_ms ?? r.duration)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {drill && <RunDetailDrawer run={drill} onClose={() => setDrill(null)} zIndex={60} />}
    </div>
  )
}
