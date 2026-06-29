/**
 * LogsPanel — the workflow's run history in the right side panel: lists the real
 * executions of this workflow (status, time, candidate count, duration) with
 * expandable step results. Empty on failure, never fabricated. Extracted from
 * WorkflowCanvasEditor.
 */
import { useState, useEffect } from 'react'
import { X, List, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { StatusBadge, formatDT, formatDuration } from '@/components/reports/runFormat'
import type { RunRow } from '@/types/reports'

export default function LogsPanel({ workflowId, onClose }: { workflowId?: string | number; onClose: () => void }) {
  const { t } = useTranslation('reports')
  const [runs,     setRuns]     = useState<RunRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState<string | number | null>(null)

  // Load this workflow's real executions; empty on failure, never fabricated.
  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    api.get('/workflow-runs', { signal: ctrl.signal })
      .then(res => {
        const rows = res.data?.data ?? res.data ?? []
        const mine = workflowId == null ? rows : rows.filter((r: RunRow) => (r.workflow_id ?? r.workflowId) === workflowId)
        mine.sort((a: RunRow, b: RunRow) => +new Date(b.started_at ?? b.created_at ?? 0) - +new Date(a.started_at ?? a.created_at ?? 0))
        setRuns(mine)
      })
      .catch(() => setRuns([]))
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [workflowId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <List size={14} color="var(--color-primary)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t('runs.title')}</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
          <X size={15} />
        </button>
      </div>

      {/* Run list — loading / empty / real executions */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>{t('runs.loading')}</div>
        )}
        {!loading && runs.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>{t('runs.empty')}</div>
        )}
        {!loading && runs.map((run, idx) => {
          const id = run.id ?? idx
          const isOpen = expanded === id
          const steps = run.step_results ?? run.steps ?? []
          return (
            <div key={id} style={{ borderBottom: '1px solid var(--border)' }}>
              {/* Row */}
              <button type="button"
                onClick={() => steps.length && setExpanded(isOpen ? null : id)}
                style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: steps.length ? 'pointer' : 'default', gap: 8, textAlign: 'left' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                <StatusBadge status={run.status} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {formatDT(run.started_at ?? run.created_at)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {t('runs.drawer.candidates')}: {run.candidates_count ?? run.candidates ?? '—'} · {t('runs.drawer.duration')}: {formatDuration(run.duration_ms ?? run.duration)}
                  </div>
                  {run.error_message && (
                    <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 2 }}>{run.error_message}</div>
                  )}
                </div>
                {steps.length > 0 && (
                  <ChevronDown size={12} color="var(--border)"
                    style={{ flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                )}
              </button>

              {/* Expanded step results — real shape only, nothing fabricated */}
              {isOpen && steps.length > 0 && (
                <div style={{ padding: '0 16px 12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {steps.map((step, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text)' }}>
                        {step.label ?? step.type ?? t('runs.drawer.step', { n: i + 1 })}
                      </span>
                      <StatusBadge status={step.status ?? (step.ok ? 'success' : 'failed')} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
