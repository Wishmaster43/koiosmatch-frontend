/**
 * TasksReport — tasks report (GET /reports/tasks, RAPPORTEN-SUITE-1 "portie 6").
 * Mirrors OpportunitiesReport 1:1: same envelope family, same calm bars via the
 * shared SegmentBars, the window rendered prominently from the RESPONSE. Drill
 * XOR params follow the seven-way tasks contract: status|type|priority|assignee|
 * team|branch|date (+bucket=week next to a week bar's date). Every axis sums to
 * `total`; status/type/priority key on the LOOKUP ID (never the slug) and their
 * 'none' sentinels + orphan-uuid rows are normal, drillable bars. The KPI strip
 * is display-only: the XOR carries no open/done/overdue segment (no fake
 * affordances — a stat without a real drill path never looks clickable).
 */
import { useState } from 'react'
import { BodyText } from '@/components/ui/typography'
import { useTranslation } from 'react-i18next'
import ReportKpiBand from './ReportKpiBand'
import { reportCardStyle as card } from './ReportSectionCard'
import ReportStateBlock from './ReportStateBlock'
import ReportGrid from './ReportGrid'
import ReportChartCard from './ReportChartCard'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import ReportDrillDrawer from './ReportDrillDrawer'
import type { DrillSpec } from './ReportDrillDrawer'
import { useTasksReport } from './useTasksReport'
import { gateDrillClick } from './reportDrillGate'
import { EMPTY_REPORT_FILTERS, buildReportQueryParams } from './reportFilterParams'
import type { ReportFilterState } from './reportFilterParams'
import SegmentBars from './SegmentBars'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import { useDateFormat } from '@/lib/datetime'
import type { ReportPeriod, CandidateOwnerSegment, CandidateTimeseriesPoint } from '@/types/analytics'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { getReportKpiCatalog, getReportKpiDefaultOrder, reportKpiSettingsKey } from './kpiCatalog'
import { resolveReportKpiOrder } from './resolveReportKpiOrder'
import { getCompareSlug } from './reportCompareSupport'
import { useReportCompare } from './useReportCompare'
import ReportCompareMetric from './ReportCompareMetric'
import { COMPARE_OFF } from './reportCompareMode'
import type { ReportCompareMode } from './reportCompareMode'

// The plain single-value XOR axes; `assignee` has its own D2 shape below.
type Axis = 'status' | 'type' | 'priority' | 'team' | 'branch'

// Minimal surface the generic bar renderer needs — status rows carry a lookup
// colour, the other axes do not (SegmentBars falls back to the primary tint).
type AxisSeg = { value: string; label: string; count: number; color?: string | null }

export default function TasksReport({ period, filters = EMPTY_REPORT_FILTERS, compare = COMPARE_OFF }: { period: ReportPeriod; filters?: ReportFilterState; compare?: ReportCompareMode }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { data, loading, error, refetch } = useTasksReport(period, filters)

  const total   = data?.total ?? 0
  const hasData = !loading && !error && total > 0

  // RAPPORT-COMPARE-1: mirrors CandidatesReport's hosting exactly.
  const compareSlug = getCompareSlug('tasks')
  const compareBaseParams = { ...buildReportQueryParams(period, 'tasks', filters) }
  const { data: compareData } = useReportCompare(compareSlug, data?.from, data?.to, compare, compareBaseParams)
  const totalCompare = compare.kind !== 'off' ? (compareData?.total as { current: number; previous: number; delta: number; delta_pct: number | null } | undefined) : undefined

  // One shared drawer for the whole page — a KPI-card click and an axis/bucket
  // click both open the SAME drawer (replacing whatever was open before). Exactly
  // one XOR param per open drill — ALWAYS layered on top of the report's own
  // active filters (`baseParams`), never just `period`, so the drawer counts the
  // exact same set the bar was drawn from.
  const [drill, setDrill] = useState<DrillSpec | null>(null)
  const windowSub = () => `${formatDate(data?.from)} – ${formatDate(data?.to)}`
  const baseParams = buildReportQueryParams(period, 'tasks', filters)
  const openSegment = (seg: { label: string; count: number }, xorParam: Record<string, unknown>) =>
    setDrill({
      title: seg.label, value: seg.count, subtitle: windowSub(),
      rowsEndpoint: '/reports/tasks/drill', rowsParams: { ...baseParams, ...xorParam },
      adviceEndpoint: '/reports/tasks/advice', adviceParams: { ...baseParams, ...xorParam },
    })
  const openBucket = (pt: CandidateTimeseriesPoint) => setDrill({
    title: pt.label, value: pt.value, subtitle: windowSub(),
    // A week bar's `date` is the point's own key; the drawer then counts the WHOLE
    // week (bucket=week) so bar and drawer total always agree.
    rowsEndpoint: '/reports/tasks/drill',
    rowsParams: { ...baseParams, date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}) },
    adviceEndpoint: '/reports/tasks/advice',
    adviceParams: { ...baseParams, date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}) },
  })

  // Generic axis-bar renderer: 'none' sentinels and orphaned (deleted-lookup)
  // values are all normal array entries — each drills on its RAW value (the
  // lookup ID for status/type/priority, never a slug), exactly like any other
  // segment (no special-casing, see SegmentBars).
  const bars = (axis: Axis, segs: AxisSeg[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('tasks', (value: string) => {
      const seg = segs.find(s => s.value === value)
      if (seg) openSegment(seg, { [axis]: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.value, label: s.label, count: s.count, color: s.color ?? null }))} />
  }

  // Assignee axis (D2 shape: owner_id/name → the `assignee` param; a NULL
  // assignee arrives as the 'none' row, "Niet toegewezen").
  const assigneeBars = (segs: CandidateOwnerSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('tasks', (value: string) => {
      const seg = segs.find(s => s.owner_id === value)
      if (seg) openSegment({ label: seg.name, count: seg.count }, { assignee: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.owner_id, label: s.name, count: s.count, color: null }))} />
  }

  const onSeriesPick = gateDrillClick('tasks', (dateKey: string) => {
    const pt = data?.timeseries.series.find(p => p.date === dateKey)
    if (pt) openBucket(pt)
  })

  // KPI-TAKEN-1 (naronde wave 1b): the nine-card strip reads the server's own
  // kpis[] suite verbatim — value and drawer share ONE backend predicate per key
  // (BuildsTaskKpis/kpiSegmentQuery), so a card's number and its drill rows can
  // never diverge. A key the server omitted (or a pre-suite cached envelope)
  // renders the house dash with no drill — never a value from another
  // population (the old summary-based cards paired the is_done flag with
  // completed_at drills, the exact mismatch that got this strip rejected).
  // The drill accepts the full panel-filter vocabulary (measured:
  // getReportsTasksKpisDrill), so baseParams rides along like the axis drills.
  const kpiByServerKey = new Map((data?.kpis ?? []).map(k => [k.key, k.count]))
  const openKpiDrill = (kpi: string, label: string, value: string | number) =>
    gateDrillClick('tasks', () => setDrill({
      title: label, value, subtitle: windowSub(),
      rowsEndpoint: '/reports/tasks/kpis/drill', rowsParams: { ...baseParams, kpi },
    }))
  // Semantic colour only where the number is a SIGNAL and non-zero (§4: colour
  // carries meaning; a calm zero stays uncoloured).
  const KPI_COLOR: Partial<Record<string, string>> = {
    overdue: 'var(--color-danger)', due_today: 'var(--color-warning)',
    due_this_week: 'var(--color-warning)', without_assignee: 'var(--color-warning)',
    done_in_period: 'var(--color-success)',
  }
  const SUITE_LABEL_KEY: Record<string, string> = {
    total: 'tasks.kpi.total', open: 'tasks.kpi.open', overdue: 'tasks.kpi.overdue',
    done_in_period: 'tasks.kpi.doneInPeriod', created_in_period: 'tasks.kpi.createdInPeriod',
    due_today: 'tasks.kpi.dueToday', due_this_week: 'tasks.kpi.dueThisWeek',
    without_assignee: 'tasks.kpi.withoutAssignee', avg_completion_days: 'tasks.kpi.avgCompletionDays',
  }
  const openKpiParams = drill?.rowsParams as Record<string, unknown> | undefined
  const kpiByKey: Record<string, KpiSpec> = Object.fromEntries(
    Object.entries(SUITE_LABEL_KEY).map(([key, labelKey]) => {
      const label = t(labelKey)
      const raw = kpiByServerKey.get(key)
      const has = raw != null
      // avg_completion_days is a computed average in days, not a row count.
      const value = !has ? '—'
        : key === 'avg_completion_days' ? t('tasks.kpi.daysValue', { days: Math.round(raw as number) })
        : raw
      return [key, {
        key, label, value,
        color: has && raw !== 0 ? KPI_COLOR[key] : undefined,
        active: openKpiParams?.kpi === key,
        sub: key === 'total' && totalCompare ? <ReportCompareMetric metric={totalCompare} polarity="up-good" /> : undefined,
        onClick: has ? openKpiDrill(key, label, value) : undefined,
      } satisfies KpiSpec]
    }))
  // Which nine keys render, and in what order, is the tenant's Settings → Reports
  // choice (falls back to today's order when nothing is stored, or a stored key
  // has vanished — RAPPORT-KPI-INSTELBAAR).
  const settingsValues = useAllSettings()
  const catalogKeys = getReportKpiCatalog('tasks').map(c => c.key)
  const defaultOrder = getReportKpiDefaultOrder('tasks')
  const stored = getJsonSetting<string[] | undefined>(settingsValues, reportKpiSettingsKey('tasks'), undefined)
  const { order: kpiOrder, fellBack } = resolveReportKpiOrder(stored, catalogKeys, defaultOrder)
  const kpis: KpiSpec[] = kpiOrder.map(key => kpiByKey[key]).filter((k): k is KpiSpec => k != null)

  return (
    <div>
      {/* KPI strip — workload health, above the tabs (candidate-page order) */}
      {hasData && (
        <ReportKpiBand kpis={kpis} notice={fellBack ? t('tasks.kpiOrderFellBack') : undefined} />
      )}

      {/* The report's data window, rendered prominently from the RESPONSE —
          DD-MM-YYYY (never ISO, §3B DATUM-1). */}
      {!loading && !error && data && (
        <BodyText as="div" style={{ fontWeight: 500, marginBottom: 12 }}>
          {t('tasks.window', { from: formatDate(data.from), to: formatDate(data.to) })}
        </BodyText>
      )}

      {(!hasData || !data) && (
        <div style={{ ...card, overflow: 'hidden' }}>
          <ReportStateBlock
            loading={loading} error={error} empty={!loading && !error && total === 0}
            loadingLabel={t('tasks.loading')} errorLabel={t('tasks.error')} emptyLabel={t('tasks.empty')}
            onRetry={() => refetch()}
          />
        </div>
      )}

      {hasData && data && (
        <ReportGrid>
          {/* Created over time — week/day timeseries, bucket set server-side. */}
          <ReportChartCard span={2} title={t('tasks.series')}
            chart={<ReportTimeseriesChart series={data.timeseries.series} onPick={onSeriesPick} />} />

          {/* Status axis — ID-keyed (slug is not unique-protected); always sums
              to total ('none' folding + orphan-uuid rows included). */}
          <ReportChartCard title={t('tasks.axes.status')} chart={bars('status', data.by_status)} />
          <ReportChartCard title={t('tasks.axes.type')} chart={bars('type', data.by_type)} />
          <ReportChartCard title={t('tasks.axes.priority')} chart={bars('priority', data.by_priority)} />
          <ReportChartCard title={t('tasks.axes.assignee')} chart={assigneeBars(data.by_assignee)} />
          <ReportChartCard title={t('tasks.axes.team')} chart={bars('team', data.by_team)} />
          <ReportChartCard title={t('tasks.axes.branch')} chart={bars('branch', data.by_branch)} />
        </ReportGrid>
      )}

      {/* One shared drill drawer for the whole page. */}
      <ReportDrillDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
