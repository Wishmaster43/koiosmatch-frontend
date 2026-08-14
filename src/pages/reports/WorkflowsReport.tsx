/**
 * WorkflowsReport — automation-run report (GET /reports/workflows,
 * RAPPORTEN-SUITE-2). Mirrors CandidatesReport's drill-list pattern (
 * RAPPORTEN-DRILLLIST-1): every axis section and the timeseries own an
 * ALWAYS-VISIBLE list beside their chart (ReportChartWithDrillList), seeded
 * with that section's own top segment on mount, never a shared overlay.
 * Three-way XOR drill: status|workflow|trigger (+date, +bucket=week next
 * to a week bar). The KPI strip reads the run-health summary straight off
 * the backend envelope — success_rate as a percentage, avg_duration_seconds
 * via the shared run formatter (which expects milliseconds, hence the
 * *1000).
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReportKpiBand from './ReportKpiBand'
import { reportCardStyle as card, reportSectionHeadStyle as head } from './ReportSectionCard'
import ReportStateBlock from './ReportStateBlock'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import type { DrillSpec } from './ReportDrillDrawer'
import { useWorkflowsReport } from './useWorkflowsReport'
import { gateDrillClick } from './reportDrillGate'
import SegmentBars from './SegmentBars'
import ReportChartWithDrillList from './ReportChartWithDrillList'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import { useDateFormat } from '@/lib/datetime'
import { formatPercent } from '@/lib/formatters'
import { formatDuration } from '@/components/reports/runFormat'
import type { ReportPeriod, CandidateSegment, ApplicationTopSegment, CandidateTimeseriesPoint } from '@/types/analytics'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { getReportKpiCatalog, getReportKpiDefaultOrder, reportKpiSettingsKey } from './kpiCatalog'
import { resolveReportKpiOrder } from './resolveReportKpiOrder'

type ColorAxis = 'status'
type PlainAxis = 'workflow' | 'trigger'
type DrillKey = ColorAxis | PlainAxis | 'series'

export default function WorkflowsReport({ period }: { period: ReportPeriod }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { data, loading, error, refetch } = useWorkflowsReport(period)

  const total   = data?.total ?? 0
  const hasData = !loading && !error && total > 0

  // Drill-down: every axis section and the timeseries own an ALWAYS-VISIBLE list
  // beside their chart — one key per section, never a single global `drill`, so
  // clicking a segment in one chart never changes another chart's list.
  const [drills, setDrills] = useState<Partial<Record<DrillKey, DrillSpec>>>({})
  const windowSub = () => `${formatDate(data?.from)} – ${formatDate(data?.to)}`
  const openSegment = (key: DrillKey, seg: { label: string; count: number }, xorParam: Record<string, unknown>) =>
    setDrills(d => ({ ...d, [key]: {
      title: seg.label, value: seg.count, subtitle: windowSub(),
      rowsEndpoint: '/reports/workflows/drill', rowsParams: { ...xorParam, period },
      adviceEndpoint: '/reports/workflows/advice', adviceParams: { ...xorParam, period },
    } }))
  const openBucket = (pt: CandidateTimeseriesPoint) => setDrills(d => ({ ...d, series: {
    title: pt.label, value: pt.value, subtitle: windowSub(),
    // A week bar's `date` is the point's own key; the list then counts the WHOLE
    // week (bucket=week) so bar and list total always agree.
    rowsEndpoint: '/reports/workflows/drill',
    rowsParams: { date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}), period },
    adviceEndpoint: '/reports/workflows/advice',
    adviceParams: { date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}), period },
  } }))

  const colorBars = (axis: ColorAxis, segs: CandidateSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('workflows', (value: string) => {
      const seg = segs.find(s => s.value === value)
      if (seg) openSegment(axis, seg, { [axis]: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.value, label: s.label, count: s.count, color: s.color }))} />
  }

  // Plain top-20 axes (workflow/trigger) — no lookup colour.
  const plainBars = (axis: PlainAxis, segs: ApplicationTopSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('workflows', (value: string) => {
      const seg = segs.find(s => s.value === value)
      if (seg) openSegment(axis, seg, { [axis]: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.value, label: s.label, count: s.count, color: null }))} />
  }

  const onSeriesPick = gateDrillClick('workflows', (dateKey: string) => {
    const pt = data?.timeseries.series.find(p => p.date === dateKey)
    if (pt) openBucket(pt)
  })

  // Default each section's list to its own top segment on mount so no panel is
  // ever blank — mirrors clicking that segment's own bar, never a client-side guess.
  useEffect(() => {
    if (!data) return
    const top = <T,>(segs: T[], count: (s: T) => number) => segs.length ? segs.reduce((a, b) => (count(b) > count(a) ? b : a)) : null
    const topStatus   = top(data.by_status, s => s.count)
    const topWorkflow = top(data.by_workflow, s => s.count)
    const topTrigger  = top(data.by_trigger, s => s.count)
    if (topStatus)   openSegment('status', topStatus, { status: topStatus.value })
    if (topWorkflow) openSegment('workflow', topWorkflow, { workflow: topWorkflow.value })
    if (topTrigger)  openSegment('trigger', topTrigger, { trigger: topTrigger.value })
    if (data.timeseries.series.length) openBucket(data.timeseries.series[data.timeseries.series.length - 1])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.from, data?.to])

  // Run-health KPI strip from the envelope's summary. success_rate is a 0-100
  // percentage; avg_duration_seconds is whole seconds but the shared
  // formatDuration expects milliseconds — hence the *1000 conversion.
  const s = data?.summary
  const kpiByKey: Record<string, KpiSpec> = {
    runs:       { key: 'runs',       label: t('workflows.summary.runs'),       value: s?.runs ?? total },
    completed:  { key: 'completed',  label: t('workflows.summary.completed'),  value: s?.completed ?? 0 },
    failed:     { key: 'failed',     label: t('workflows.summary.failed'),     value: s?.failed ?? 0 },
    cancelled:  { key: 'cancelled',  label: t('workflows.summary.cancelled'),  value: s?.cancelled ?? 0 },
    running:    { key: 'running',    label: t('workflows.summary.running'),    value: s?.running ?? 0 },
    successRate: { key: 'successRate', label: t('workflows.summary.successRate'),
      value: formatPercent(s?.success_rate) },
    avgDuration: { key: 'avgDuration', label: t('workflows.summary.avgDuration'),
      value: s?.avg_duration_seconds != null ? formatDuration(s.avg_duration_seconds * 1000) : '—' },
    // Distinct-category counts off the axis arrays — a plain stat, not a single
    // segment value, so there is no XOR param to drill on.
    workflowsCount: { key: 'workflowsCount', label: t('workflows.summary.workflowsCount'), value: data?.by_workflow.length ?? 0 },
    triggersCount: { key: 'triggersCount', label: t('workflows.summary.triggersCount'), value: data?.by_trigger.length ?? 0 },
  }
  // Which nine keys render, and in what order, is the tenant's Settings → Reports
  // choice (falls back to today's order when nothing is stored, or a stored key
  // has vanished — RAPPORT-KPI-INSTELBAAR).
  const settingsValues = useAllSettings()
  const catalogKeys = getReportKpiCatalog('workflows').map(c => c.key)
  const defaultOrder = getReportKpiDefaultOrder('workflows')
  const stored = getJsonSetting<string[] | undefined>(settingsValues, reportKpiSettingsKey('workflows'), undefined)
  const { order: kpiOrder, fellBack } = resolveReportKpiOrder(stored, catalogKeys, defaultOrder)
  const kpis: KpiSpec[] = kpiOrder.map(key => kpiByKey[key]).filter((k): k is KpiSpec => k != null)

  return (
    <div>
      {/* KPI strip — run health, above the tabs (candidate-page order) */}
      {hasData && (
        <ReportKpiBand kpis={kpis} notice={fellBack ? t('workflows.kpiOrderFellBack') : undefined} />
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
            {/* Runs over time — week/day timeseries, bucket set server-side. Its own
                always-visible list sits beside it, never a shared overlay. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('workflows.series')}</h3>
              <ReportChartWithDrillList drill={drills.series ?? null} placeholderLabel={t('workflows.series')}
                chart={<ReportTimeseriesChart series={data.timeseries.series} onPick={onSeriesPick} />} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('workflows.axes.status')}</h3>
              <ReportChartWithDrillList drill={drills.status ?? null} placeholderLabel={t('workflows.axes.status')}
                chart={colorBars('status', data.by_status.map(s => ({ ...s, color: s.color ?? null })))} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('workflows.axes.workflow')}</h3>
              <ReportChartWithDrillList drill={drills.workflow ?? null} placeholderLabel={t('workflows.axes.workflow')}
                chart={plainBars('workflow', data.by_workflow)} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('workflows.axes.trigger')}</h3>
              <ReportChartWithDrillList drill={drills.trigger ?? null} placeholderLabel={t('workflows.axes.trigger')}
                chart={plainBars('trigger', data.by_trigger)} />
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
