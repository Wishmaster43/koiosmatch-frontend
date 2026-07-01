/**
 * RunDetailDrawer — slide-over showing one workflow run: its status, key metrics,
 * a timeline of run metadata and the per-step INPUT/OUTPUT list (via RunStepList).
 * Shared by the global RunsTable and the workflow editor's history view so the
 * run drill-down is defined once (§3A). Focus is trapped while open.
 */
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useTranslation } from 'react-i18next'
import { Zap, Clock, Users, X, AlertTriangle } from 'lucide-react'
import { formatDT, formatDuration, StatusBadge } from './runFormat'
import RunStepList from './RunStepList'
import type { RunRow } from '@/types/reports'

export default function RunDetailDrawer({ run, onClose, zIndex = 50 }: {
  run: RunRow
  onClose: () => void
  zIndex?: number
}) {
  const { t } = useTranslation('reports')
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const steps = run.step_results ?? run.steps ?? []

  return (
    <>
      <div className="fixed inset-0" style={{ background: 'rgba(0,0,0,0.25)', zIndex }} onClick={onClose} />

      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={run.workflow_name as string | undefined} tabIndex={-1}
        className="fixed top-0 bottom-0 right-0 flex flex-col bg-[var(--surface)]"
        style={{ width: 500, zIndex: zIndex + 1, boxShadow: '-4px 0 30px rgba(0,0,0,0.12)' }}>

        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Zap size={15} color="var(--color-primary)" />
                <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
                  {run.workflow_name ?? t('runs.drawer.workflowFallback', { id: run.workflow_id ?? run.id })}
                </span>
                <StatusBadge status={run.status} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {t('runs.drawer.startedColon')} {formatDT(run.started_at ?? run.created_at)}
              </div>
            </div>
            <button onClick={onClose} aria-label={t('common:close')}
              style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                       background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                       borderRadius: 6, marginLeft: 10, flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Metrics */}
        <div style={{ display: 'flex', gap: 1, background: 'var(--hover-bg)',
                      borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {[
            { label: t('runs.drawer.candidates'), value: run.candidates_count ?? run.candidates ?? '—', Icon: Users },
            { label: t('runs.drawer.duration'),   value: formatDuration(run.duration_ms ?? run.duration), Icon: Clock },
          ].map(b => (
            <div key={b.label} style={{ flex: 1, padding: '10px 16px', textAlign: 'center', background: 'var(--surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <b.Icon size={12} color="var(--text-muted)" />
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{b.value}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{b.label}</div>
            </div>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {/* Timeline */}
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase',
                        letterSpacing: '0.05em', marginBottom: 10 }}>
            {t('runs.drawer.timeline')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
            {[
              { label: t('runs.drawer.started'),   value: formatDT(run.started_at  ?? run.created_at) },
              { label: t('runs.drawer.finished'),  value: formatDT(run.finished_at ?? run.completed_at) },
              { label: t('runs.drawer.trigger'),   value: run.trigger ?? run.trigger_type },
              { label: t('runs.drawer.createdBy'), value: run.triggered_by ?? run.user_name },
            ].filter(r => r.value && r.value !== '—').map(r => (
              <div key={r.label} style={{ display: 'flex', gap: 8, padding: '7px 0',
                                          borderBottom: '1px solid var(--hover-bg)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 140, flexShrink: 0 }}>{r.label}</span>
                <span style={{ fontSize: 12, color: 'var(--text)' }}>{r.value}</span>
              </div>
            ))}
          </div>

          {/* Step results with expandable INPUT/OUTPUT */}
          {steps.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase',
                            letterSpacing: '0.05em', marginBottom: 10 }}>
                {t('runs.drawer.stepResults')} ({steps.length})
              </div>
              <div style={{ marginBottom: 20 }}>
                <RunStepList steps={steps} />
              </div>
            </>
          )}

          {/* Error message */}
          {run.error_message && (
            <div style={{ background: 'var(--color-danger-bg)', border: '1px solid #FCA5A5', borderRadius: 8,
                          padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <AlertTriangle size={13} color="var(--color-danger)" />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-danger)' }}>{t('runs.drawer.error')}</span>
              </div>
              <pre style={{ fontSize: 11, color: 'var(--text)', whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all', margin: 0, fontFamily: 'monospace' }}>
                {run.error_message}
              </pre>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
