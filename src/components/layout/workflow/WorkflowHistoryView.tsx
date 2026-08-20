/**
 * WorkflowHistoryView — the editor's GESCHIEDENIS tab: the run history for one
 * workflow. Fetches this workflow's runs, renders a compact Make-style table
 * (started · trigger · status · duration) and opens the shared RunDetailDrawer
 * (run meta + per-step INPUT/OUTPUT) on row click. Handles the four UI states.
 */
import { Fragment, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { History, Play, Clock as ClockIcon, ChevronRight, ChevronDown, Users, Clock } from 'lucide-react'
import { useReportList } from '@/components/reports/useReportList'
import { useDateFormat } from '@/lib/datetime'
import { formatDuration, StatusBadge } from '@/components/reports/runFormat'
import RunDetailDrawer from '@/components/reports/RunDetailDrawer'
import { PageTitle } from '@/components/ui/typography'
import Button from '@/components/ui/Button'
// RUN-HIST-EXPAND-1 (batch 4, P39): the chevron opens an inline row reusing the
// drawer's own step viewer — no forked step-rendering, no extra fetch.
import RunStepList from '@/components/reports/RunStepList'
import type { RunRow } from '@/types/reports'
import Spinner from '@/components/ui/Spinner'

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
  // App-wide active locale (§5) — never a hardcoded 'nl-NL' toLocale*String call.
  const { formatDate, formatTime } = useDateFormat()
  const [drill, setDrill] = useState<RunRow | null>(null)
  // RUN-HIST-EXPAND-1: which rows are inline-expanded (chevron), independent of
  // the drawer — several rows can stay open at once, purely from the list response.
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggleExpanded = (id: string) => setExpanded(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

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
          <PageTitle>{t('runs.editorTitle')}</PageTitle>
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
              <Spinner size={15} /> {t('runs.loading')}
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
                  <th style={{ ...TH, width: 32 }} aria-hidden="true" />
                  <th style={TH}>{t('runs.cols.started')}</th>
                  <th style={TH}>{t('runs.cols.trigger')}</th>
                  <th style={TH}>{t('runs.cols.status')}</th>
                  <th style={TH}>{t('runs.cols.duration')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  // RUN-HIST-EXPAND-1: id keyed off the row's own identity, falling
                  // back to index so rows without an id still expand independently.
                  const rowKey = String(r.id ?? i)
                  const isOpen = expanded.has(rowKey)
                  const steps = r.step_results ?? r.steps ?? []
                  return (
                  <Fragment key={rowKey}>
                  <tr
                    style={{ cursor: 'pointer' }}
                    onClick={() => setDrill(r)}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ ...TD, textAlign: 'center' }}>
                      {/* Chevron toggles the inline row without opening the drawer (P39). */}
                      <Button variant="ghost" iconOnly aria-expanded={isOpen} aria-label={t('runs.cols.expand')}
                        onClick={e => { e.stopPropagation(); toggleExpanded(rowKey) }}>
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </Button>
                    </td>
                    <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 500 }}>{formatDate(r.started_at)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatTime(r.started_at)}</div>
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
                  {/* Inline expanded detail: rides the list response, no extra fetch.
                      A RUNNING run shows here as a static snapshot — it does not poll
                      like the drawer does; reopening the row refreshes it from the list. */}
                  {isOpen && (
                    <tr>
                      <td colSpan={5} style={{ ...TD, background: 'var(--hover-bg)', padding: '14px 16px 18px 44px' }}>
                        <div style={{ display: 'flex', gap: 1, marginBottom: 14, maxWidth: 320 }}>
                          {[
                            { label: t('runs.drawer.candidates'), value: r.candidates_count ?? r.candidates ?? '—', Icon: Users },
                            { label: t('runs.drawer.duration'), value: formatDuration(r.duration_ms ?? r.duration), Icon: Clock },
                          ].map(b => (
                            <div key={b.label} style={{ flex: 1, padding: '8px 14px', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                                <b.Icon size={11} color="var(--text-muted)" />
                                {/* eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- a stat-block NUMBER readout, not a page/section title */}
                                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{b.value}</span>
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{b.label}</div>
                            </div>
                          ))}
                        </div>
                        {steps.length > 0 ? (
                          <>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase',
                                          letterSpacing: '0.05em', marginBottom: 8 }}>
                              {t('runs.drawer.stepResults')} ({steps.length})
                            </div>
                            <RunStepList steps={steps} />
                          </>
                        ) : (
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('runs.drawer.noData')}</div>
                        )}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* HUISSTIJL-1: RunDetailDrawer (src/components/reports, out of scope) types
          `zIndex?: number` — the literal 60 can't become a CSS var string without
          touching that file; kept as-is. */}
      {drill && <RunDetailDrawer run={drill} onClose={() => setDrill(null)} zIndex={60} />}
    </div>
  )
}
