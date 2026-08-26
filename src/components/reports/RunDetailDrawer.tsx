/**
 * RunDetailDrawer — slide-over showing one workflow run: its status, key metrics,
 * a timeline of run metadata and the per-step INPUT/OUTPUT list (via RunStepList).
 * Shared by the global RunsTable and the workflow editor's history view so the
 * run drill-down is defined once (§3A). Focus is trapped while open.
 */
import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useTranslation } from 'react-i18next'
import { Zap, Clock, Users, X, AlertTriangle } from 'lucide-react'
import { formatDT, formatDuration, StatusBadge, DryRunBanner } from './runFormat'
import RunStepList from './RunStepList'
import RunLineage from './RunLineage'
import { StopRunButton, CANCELLABLE } from '@/components/layout/workflow/runControl'
import { PageTitle, Caption, GroupLabel } from '@/components/ui/typography'
import type { RunRow } from '@/types/reports'

// Slide-over for one workflow run: header/status/metrics, a timeline of run
// metadata, lineage and the per-step input/output list; polls while live.
export default function RunDetailDrawer({ run, onClose, zIndex = 50 }: {
  run: RunRow
  onClose: () => void
  zIndex?: number
}) {
  const { t } = useTranslation('reports')
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  // Live view (WF-R3): while the run is RUNNING/WAITING, poll its workflow's run
  // list every 3s so pending/running step states and attempts update in place.
  const [live, setLive] = useState<RunRow | null>(null)
  // RUN-CONTROL-1: the stop button's backend reason (e.g. 422 "already finished").
  const [stopError, setStopError] = useState<string | null>(null)
  const shown = live ?? run

  // One fetch of this run's fresh row — shared by the poll interval AND the
  // immediate refresh right after a successful stop (no waiting out the 3s tick).
  // Resolves the fresh row (or undefined) so callers can react to its status.
  const fetchLive = useCallback(async (): Promise<RunRow | undefined> => {
    if (run.workflow_id == null) return undefined
    try {
      const res = await api.get(`/workflows/${run.workflow_id}/runs`)
      const body = res.data as { data?: RunRow[] } | RunRow[] | undefined
      const rows = (Array.isArray(body) ? body : body?.data ?? []) as RunRow[]
      const fresh = rows.find(r => String(r.id) === String(run.id))
      if (fresh) setLive(fresh)
      return fresh
    } catch {
      return undefined
    }
  }, [run.id, run.workflow_id])

  // Poll every 3s only while the opened run is still in a cancellable (live)
  // state; the interval stops itself the moment a poll sees a terminal status.
  useEffect(() => {
    setLive(null)
    if (!CANCELLABLE.has(String(run.status))) return
    const timer = setInterval(() => {
      fetchLive().then(fresh => { if (fresh && !CANCELLABLE.has(String(fresh.status))) clearInterval(timer) })
    }, 3000)
    return () => clearInterval(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.id, run.status, run.workflow_id])

  // After a successful stop: drop any prior error and refresh immediately so the
  // badge/step list reflect `cancelled` right away instead of on the next tick.
  const handleStopped = useCallback(() => {
    setStopError(null)
    fetchLive()
  }, [fetchLive])

  const steps = shown.step_results ?? shown.steps ?? []

  return (
    <>
      <div className="fixed inset-0" style={{ background: 'rgba(0,0,0,0.25)', zIndex }} onClick={onClose} />

      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={run.workflow_name as string | undefined} tabIndex={-1}
        className="fixed top-0 bottom-0 right-0 flex flex-col bg-[var(--surface)]"
        style={{ width: 500, zIndex: zIndex + 1, boxShadow: 'var(--shadow-drawer)' }}>

        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Zap size={15} color="var(--color-primary)" />
                {/* PageTitle's own 15px scale — weight overridden to 700 to keep the
                    pre-existing visual weight exactly (default is 600). */}
                <PageTitle as="span" style={{ fontWeight: 700 }}>
                  {run.workflow_name ?? t('runs.drawer.workflowFallback', { id: run.workflow_id ?? run.id })}
                </PageTitle>
                <StatusBadge status={shown.status} />
                {/* RUN-CONTROL-1: this Make-style inspector stays read-only otherwise —
                    the stop button is the one exception for a still-live run. */}
                {CANCELLABLE.has(String(shown.status)) && shown.id != null && (
                  <StopRunButton runId={shown.id} compact onStopped={handleStopped} onError={setStopError} />
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {t('runs.drawer.startedColon')} {formatDT(shown.started_at ?? shown.created_at)}
              </div>
              {stopError && (
                <div style={{ fontSize: 11, color: 'var(--color-danger-text)', marginTop: 4 }}>{stopError}</div>
              )}
            </div>
            {/* Close icon button with an imperative hover highlight Button does not
                provide, pre-existing and out of this ink/tint task's scope. */}
            <button onClick={onClose} aria-label={t('common:close')}
              // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- see comment above
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
            { label: t('runs.drawer.candidates'), value: shown.candidates_count ?? shown.candidates ?? '—', Icon: Users },
            { label: t('runs.drawer.duration'),   value: formatDuration(shown.duration_ms ?? shown.duration), Icon: Clock },
          ].map(b => (
            <div key={b.label} style={{ flex: 1, padding: '10px 16px', textAlign: 'center', background: 'var(--surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <b.Icon size={12} color="var(--text-muted)" />
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{b.value}</span>
              </div>
              <Caption as="div" style={{ marginTop: 1 }}>{b.label}</Caption>
            </div>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {/* WF-DRYRUN-FE-1: dry-run banner — only when the RUN-LEVEL flag says so
              (never derived from context, which mutates step-to-step). */}
          {shown.dry_run && <div style={{ marginBottom: 16 }}><DryRunBanner /></div>}

          {/* Timeline */}
          <GroupLabel style={{ marginBottom: 10 }}>
            {t('runs.drawer.timeline')}
          </GroupLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
            {[
              { label: t('runs.drawer.started'),   value: formatDT(shown.started_at  ?? shown.created_at) },
              { label: t('runs.drawer.finished'),  value: formatDT(shown.finished_at ?? shown.completed_at) },
              { label: t('runs.drawer.trigger'),   value: shown.trigger ?? shown.trigger_type },
              { label: t('runs.drawer.createdBy'), value: shown.triggered_by ?? shown.user_name },
              // WF-LOG-WHO-1 (Danny 22-07): the run's subject candidate — name + display ref.
              { label: t('runs.drawer.candidate'), value: shown.candidate
                  ? `${shown.candidate.name || '—'}${shown.candidate.reference_number ? ` (${shown.candidate.reference_number})` : ''}`
                  : null },
              // RUN-GUID-1 (Danny 23-07 "GUID ID ERBIJ"): the run's GUID, monospace +
              // click-to-copy, so a run is referable in support/debug conversations.
              { label: t('runs.drawer.runId'), value: shown.id != null ? String(shown.id) : null, mono: true },
            ].filter(r => r.value && r.value !== '—').map(r => (
              <div key={r.label} style={{ display: 'flex', gap: 8, padding: '7px 0',
                                          borderBottom: '1px solid var(--hover-bg)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 140, flexShrink: 0 }}>{r.label}</span>
                {'mono' in r && r.mono ? (
                  // Inline monospace copy-id affordance styled as plain text,
                  // pre-existing and out of this ink/tint task's scope.
                  <button type="button" title={t('runs.drawer.copyId')}
                    onClick={() => { void navigator.clipboard?.writeText(String(r.value)) }}
                    // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- see comment above
                    style={{ fontSize: 11.5, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace",
                             background: 'none', border: 'none', padding: 0, cursor: 'copy',
                             textAlign: 'left', wordBreak: 'break-all' }}>
                    {r.value}
                  </button>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--text)' }}>{r.value}</span>
                )}
              </div>
            ))}
          </div>

          {/* WF-RELATIONS-FE-1: the call-chain lineage — renders nothing for a
              root-level run (no parent), the honest empty case. */}
          <RunLineage run={shown} />

          {/* Step results with expandable INPUT/OUTPUT */}
          {steps.length > 0 && (
            <>
              <GroupLabel style={{ marginBottom: 10 }}>
                {t('runs.drawer.stepResults')} ({steps.length})
              </GroupLabel>
              <div style={{ marginBottom: 20 }}>
                <RunStepList steps={steps} />
              </div>
            </>
          )}

          {/* Error message */}
          {shown.error_message && (
            // eslint-disable-next-line no-restricted-syntax -- DATA: danger-border companion colour, mirrors the same literal used in MessageDrawer/EmailSettings/WhatsAppSettings
            <div style={{ background: 'var(--color-danger-bg)', border: '1px solid #FCA5A5', borderRadius: 8,
                          padding: '12px 14px' }}>
              {/* Ink is --color-on-danger-bg — the raw danger colour reads only 3.95:1
                  on its own pastel, AA fail (Opus r3.5). */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <AlertTriangle size={13} color="var(--color-on-danger-bg)" />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-on-danger-bg)' }}>{t('runs.drawer.error')}</span>
              </div>
              <pre style={{ fontSize: 11, color: 'var(--text)', whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all', margin: 0, fontFamily: 'monospace' }}>
                {shown.error_message}
              </pre>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
