/**
 * LogsPanel — the workflow's run viewer in the right side panel: lists the real
 * executions of this workflow (status, time, candidate count, duration) with
 * expandable step results. Empty on failure, never fabricated. Extracted from
 * WorkflowCanvasEditor. RUN-CONTROL-1: a running/waiting run gets a stop button,
 * each step card shows its own timestamp + its OWN output slice (StepOutputSlice).
 */
import { useState, useEffect } from 'react'
import { X, List, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { StatusBadge, formatDT, formatDuration } from '@/components/reports/runFormat'
import { CANCELLABLE, StopRunButton } from './runControl'
import { useModuleCatalog } from './useModuleCatalog'
import StepOutputSlice from './StepOutputSlice'
import type { RunRow, RunStep } from '@/types/reports'

// Step time range, e.g. "14:03:11 → 14:03:14" (seconds matter inside one run).
function stepTime(step: RunStep): string | null {
  const fmt = (v?: string | null) => v
    ? new Date(v).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null
  const from = fmt(step.started_at)
  const to = fmt(step.finished_at)
  if (!from) return null
  return to && to !== from ? `${from} → ${to}` : from
}

export default function LogsPanel({ workflowId, liveRun, onClose }: { workflowId?: string | number; liveRun?: RunRow | null; onClose: () => void }) {
  const { t } = useTranslation('reports')
  // New run-control strings live in the workflows namespace (this wave's keys).
  const { t: tw } = useTranslation('workflows')
  const [runs,     setRuns]     = useState<RunRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState<string | number | null>(null)
  // Per-run stop feedback (the 422 "already finished" reason from the backend).
  const [stopError, setStopError] = useState<{ id: string | number; message: string } | null>(null)
  // Bundle-shape catalog (output_fields per module type) for the per-step slices.
  const { catalog } = useModuleCatalog()

  // WF-R3: surface the live run (polled) at the top, with its steps auto-expanded,
  // so the panel updates in real-time while the run executes.
  const displayRuns = liveRun?.id != null
    ? [liveRun, ...runs.filter(r => (r.id ?? '') !== liveRun.id)]
    : runs
  useEffect(() => { if (liveRun?.id != null) setExpanded(liveRun.id) }, [liveRun?.id])

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

  // After a successful stop: reflect it locally right away (the live poll and the
  // next fetch confirm); cancelled steps are closed server-side.
  const markCancelled = (id: string | number) => {
    setStopError(null)
    setRuns(prev => prev.map(r => r.id === id ? { ...r, status: 'cancelled' } : r))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <List size={14} color="var(--color-primary)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t('runs.title')}</span>
        </div>
        <button onClick={onClose} aria-label={t('common:close')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
          <X size={15} />
        </button>
      </div>

      {/* Run list — loading / empty / real executions */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>{t('runs.loading')}</div>
        )}
        {!loading && displayRuns.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>{t('runs.empty')}</div>
        )}
        {!loading && displayRuns.map((run, idx) => {
          const id = run.id ?? idx
          const isOpen = expanded === id
          // Prefer the enriched live-state rows (duration/summary/items); the legacy
          // step_results shape (label+status only) is a fallback for old runs.
          const steps = (run.steps?.length ? run.steps : run.step_results) ?? []
          const stoppable = run.id != null && CANCELLABLE.has(String(run.status))
          return (
            <div key={id} style={{ borderBottom: '1px solid var(--border)' }}>
              {/* Row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px' }}>
                <button type="button"
                  onClick={() => steps.length && setExpanded(isOpen ? null : id)}
                  style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: steps.length ? 'pointer' : 'default', gap: 8, textAlign: 'left', padding: 0 }}>
                  <StatusBadge status={run.status} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* The run timestamp is the card's primary line (RUN-CONTROL-1). */}
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>
                      {formatDT(run.started_at ?? run.created_at)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {t('runs.drawer.candidates')}: {run.candidates_count ?? run.candidates ?? '—'} · {t('runs.drawer.duration')}: {formatDuration(run.duration_ms ?? run.duration)}
                    </div>
                    {run.error_message && (
                      <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 2 }}>{run.error_message}</div>
                    )}
                    {stopError?.id === id && (
                      <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 2 }}>{stopError.message}</div>
                    )}
                  </div>
                  {steps.length > 0 && (
                    <ChevronDown size={12} color="var(--border)"
                      style={{ flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                  )}
                </button>
                {/* Stop — only while the run can still be cancelled (running/waiting). */}
                {stoppable && (
                  <StopRunButton runId={run.id as string | number} compact
                    onStopped={() => markCancelled(id)}
                    onError={message => setStopError({ id, message: message || tw('runControl.stopFailed') })} />
                )}
              </div>

              {/* Expanded step results — timestamp + duration + the step's OWN output slice */}
              {isOpen && steps.length > 0 && (
                <div style={{ padding: '0 16px 12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {steps.map((step, i) => {
                    const time = stepTime(step)
                    return (
                      <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                            {step.label ?? step.type ?? t('runs.drawer.step', { n: i + 1 })}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            {step.duration_ms != null && (
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDuration(step.duration_ms)}</span>
                            )}
                            <StatusBadge status={step.status ?? (step.ok ? 'success' : 'failed')} />
                          </span>
                        </div>
                        {/* WHEN this step ran — prominent on every card (RUN-CONTROL-1). */}
                        {time && (
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', fontFamily: 'monospace', marginTop: 4 }}>{time}</div>
                        )}
                        {step.error != null && (
                          <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 4 }}>{String(step.error)}</div>
                        )}
                        {/* One-line outcome, e.g. "460 gesynct · 2 overgeslagen". */}
                        {typeof step.summary === 'string' && step.summary && (
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-success)', marginTop: 4 }}>{step.summary}</div>
                        )}
                        {/* Router step: per-route distribution — "→ Dagdienst: 12/40". */}
                        {Array.isArray(step.routing) && step.routing.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 6 }}>
                            {step.routing.map((r, ri) => (
                              <div key={ri} style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                → <span style={{ fontWeight: 600, color: 'var(--text)' }}>{r.to_label ?? '—'}</span>: {r.matched ?? 0}/{r.total ?? 0}
                              </div>
                            ))}
                          </div>
                        )}
                        {/* This step's own emitted records (collapsible; closed above 10 rows). */}
                        <StepOutputSlice step={step} catalog={catalog} />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
