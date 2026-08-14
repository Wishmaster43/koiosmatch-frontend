/**
 * WorkflowsReport — automation-run report (GET /reports/workflows,
 * RAPPORTEN-SUITE-2). Mirrors TasksReport 1:1 (same envelope family, same calm
 * bars via the shared SegmentBars, window from the RESPONSE). Three-way XOR
 * drill: status|workflow|trigger (+date, +bucket=week next to a week bar). The
 * KPI strip reads the run-health summary straight off the backend envelope —
 * success_rate as a percentage, avg_duration_seconds via the shared run
 * formatter (which expects milliseconds, hence the *1000).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReportKpiBand from './ReportKpiBand'
import { reportCardStyle as card, reportSectionHeadStyle as head } from './ReportSectionCard'
import ReportStateBlock from './ReportStateBlock'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import ReportDrillDrawer from './ReportDrillDrawer'
import type { DrillSpec } from './ReportDrillDrawer'
import { useWorkflowsReport } from './useWorkflowsReport'
import { gateDrillClick } from './reportDrillGate'
import SegmentBars from './SegmentBars'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import { useDateFormat } from '@/lib/datetime'
import { formatPercent } from '@/lib/formatters'
import { formatDuration } from '@/components/reports/runFormat'
import type { ReportPeriod, CandidateSegment, ApplicationTopSegment, CandidateTimeseriesPoint } from '@/types/analytics'

type ColorAxis = 'status'
type PlainAxis = 'workflow' | 'trigger'

export default function WorkflowsReport({ period }: { period: ReportPeriod }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { data, loading, error, refetch } = useWorkflowsReport(period)

  const total   = data?.total ?? 0
  const hasData = !loading && !error && total > 0

  // Drill-down: any axis-segment bar or timeseries bucket explains itself (the
  // runs behind it + Koios advice). Exactly one XOR param per open drill.
  const [drill, setDrill] = useState<DrillSpec | null>(null)
  const windowSub = () => `${formatDate(data?.from)} – ${formatDate(data?.to)}`
  const openSegment = (seg: { label: string; count: number }, xorParam: Record<string, unknown>) => setDrill({
    title: seg.label, value: seg.count, subtitle: windowSub(),
    rowsEndpoint: '/reports/workflows/drill', rowsParams: { ...xorParam, period },
    adviceEndpoint: '/reports/workflows/advice', adviceParams: { ...xorParam, period },
  })
  const openBucket = (pt: CandidateTimeseriesPoint) => setDrill({
    title: pt.label, value: pt.value, subtitle: windowSub(),
    // A week bar's `date` is the point's own key; the drawer then counts the WHOLE
    // week (bucket=week) so bar and drawer total always agree.
    rowsEndpoint: '/reports/workflows/drill',
    rowsParams: { date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}), period },
    adviceEndpoint: '/reports/workflows/advice',
    adviceParams: { date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}), period },
  })

  const colorBars = (axis: ColorAxis, segs: CandidateSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('workflows', (value: string) => {
      const seg = segs.find(s => s.value === value)
      if (seg) openSegment(seg, { [axis]: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.value, label: s.label, count: s.count, color: s.color }))} />
  }

  // Plain top-20 axes (workflow/trigger) — no lookup colour.
  const plainBars = (axis: PlainAxis, segs: ApplicationTopSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('workflows', (value: string) => {
      const seg = segs.find(s => s.value === value)
      if (seg) openSegment(seg, { [axis]: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.value, label: s.label, count: s.count, color: null }))} />
  }

  const onSeriesPick = gateDrillClick('workflows', (dateKey: string) => {
    const pt = data?.timeseries.series.find(p => p.date === dateKey)
    if (pt) openBucket(pt)
  })

  // Run-health KPI strip from the envelope's summary. success_rate is a 0-100
  // percentage; avg_duration_seconds is whole seconds but the shared
  // formatDuration expects milliseconds — hence the *1000 conversion.
  const s = data?.summary
  const kpis: KpiSpec[] = [
    { key: 'runs',       label: t('workflows.summary.runs'),       value: s?.runs ?? total },
    { key: 'completed',  label: t('workflows.summary.completed'),  value: s?.completed ?? 0 },
    { key: 'failed',     label: t('workflows.summary.failed'),     value: s?.failed ?? 0 },
    { key: 'cancelled',  label: t('workflows.summary.cancelled'),  value: s?.cancelled ?? 0 },
    { key: 'running',    label: t('workflows.summary.running'),    value: s?.running ?? 0 },
    { key: 'successRate', label: t('workflows.summary.successRate'),
      value: formatPercent(s?.success_rate) },
    { key: 'avgDuration', label: t('workflows.summary.avgDuration'),
      value: s?.avg_duration_seconds != null ? formatDuration(s.avg_duration_seconds * 1000) : '—' },
    // Distinct-category counts off the axis arrays — a plain stat, not a single
    // segment value, so there is no XOR param to drill on.
    { key: 'workflowsCount', label: t('workflows.summary.workflowsCount'), value: data?.by_workflow.length ?? 0 },
    { key: 'triggersCount', label: t('workflows.summary.triggersCount'), value: data?.by_trigger.length ?? 0 },
  ]

  return (
    <div>
      {/* KPI strip — run health, above the tabs (candidate-page order) */}
      {hasData && (
        <ReportKpiBand kpis={kpis} />
      )}

      {/* The report's data window, rendered prominently from the RESPONSE —
          DD-MM-YYYY (never ISO, §3B DATUM-1). */}
      {!loading && !error && data && (
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 12 }}>
          {t('workflows.window', { from: formatDate(data.from), to: formatDate(data.to) })}
        </div>
      )}

      <div style={{ ...card, overflow: 'hidden' }}>
        <ReportStateBlock
          loading={loading} error={error} empty={!loading && !error && total === 0}
          loadingLabel={t('workflows.loading')} errorLabel={t('workflows.error')} emptyLabel={t('workflows.empty')}
          onRetry={() => refetch()}
        />
        {hasData && data && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Runs over time — week/day timeseries, bucket set server-side. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('workflows.series')}</h3>
              <ReportTimeseriesChart series={data.timeseries.series} onPick={onSeriesPick} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('workflows.axes.status')}</h3>
              {colorBars('status', data.by_status.map(s => ({ ...s, color: s.color ?? null })))}
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('workflows.axes.workflow')}</h3>
              {plainBars('workflow', data.by_workflow)}
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('workflows.axes.trigger')}</h3>
              {plainBars('trigger', data.by_trigger)}
            </section>
          </div>
        )}
      </div>

      {/* Dynamic drill-down: explains the clicked segment/bucket + Koios advice */}
      <ReportDrillDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
